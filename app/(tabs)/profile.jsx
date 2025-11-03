import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCustomAuth } from '../../hooks/use-custom-auth';
import RecipeMatcherService from '../../services/recipe-matcher-service';
import RecipeHistoryService from '../../services/recipe-history-service';
import AuthGuard from '../../components/auth-guard';
import ProfileHeader from '../../components/profile/profile-header';
import ProfileTabs from '../../components/profile/profile-tabs';
import FavoritesTab from '../../components/profile/favorites-tab';
import HistoryTab from '../../components/profile/history-tab';
import EmptyState from '../../components/profile/empty-state';
import ProfileActions from '../../components/profile/profile-actions';

const Profile = () => {
  const { user, customUserData, signOut, fetchCustomUserData } = useCustomAuth();
  const [activeTab, setActiveTab] = useState('scheduled');
  const [profileData, setProfileData] = useState({
    name: 'User',
    email: 'user@example.com',
    verified: true
  });
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [recipeHistory, setRecipeHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    // Update profile data if user information is available
    if (user) {
      setProfileData({
        name: customUserData?.userName || user.email?.split('@')[0] || 'User',
        email: user.email || 'No email available',
        verified: user.email_confirmed_at !== null
      });
      
      // Load saved recipes when user is available (lazy load - only on mount)
      if (activeTab === 'favorites') {
        loadSavedRecipes();
      }
    }
  }, [user, customUserData]);

  const loadSavedRecipes = async () => {
    if (!user?.email) return;
    
    try {
      setLoadingRecipes(true);
      const recipes = await RecipeMatcherService.getSavedRecipes(user.email);
      setSavedRecipes(recipes);
    } catch (error) {
      console.error('❌ Error loading saved recipes:', error);
    } finally {
      setLoadingRecipes(false);
    }
  };

  const loadRecipeHistory = async () => {
    if (!customUserData?.userID) return;
    
    try {
      setLoadingHistory(true);
      const history = await RecipeHistoryService.getRecipeHistory(customUserData.userID);
      setRecipeHistory(history);
    } catch (error) {
      console.error('❌ Error loading recipe history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    
    // Load recipes when favorites tab is selected
    if (tab === 'favorites' && savedRecipes.length === 0 && !loadingRecipes) {
      loadSavedRecipes();
    }
    
    // Load history when history tab is selected
    if (tab === 'history' && recipeHistory.length === 0 && !loadingHistory) {
      loadRecipeHistory();
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    
    try {
      // Refresh user data
      if (user?.email) {
        await fetchCustomUserData(user.email);
      }
      
      // Refresh current tab content
      if (activeTab === 'favorites') {
        await loadSavedRecipes();
      } else if (activeTab === 'history') {
        await loadRecipeHistory();
      }
      
    } catch (error) {
      console.error('Error refreshing profile:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Log out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Log out', 
          onPress: async () => {
            try {
              await signOut();
              router.replace('/signin');
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to log out. Please try again.');
            }
          },
          style: 'destructive'
        }
      ]
    );
  };

  const handleBack = () => {
    router.back();
  };

  const handleRecipePress = (savedRecipe) => {
    const recipe = savedRecipe.recipe;
    
    // Ensure recipe data has all necessary fields
    let recipeData;
    if (savedRecipe.isCustom) {
      // AI recipe - add isCustom flag
      recipeData = { ...recipe, isCustom: true };
    } else {
      // Edamam recipe - ensure it has uri field for favorites functionality
      recipeData = { 
        ...recipe,
        uri: recipe.uri || savedRecipe.edamamRecipeURI,
        isCustom: false
      };
    }

    router.push({
      pathname: '/recipe-detail',
      params: { recipeData: JSON.stringify(recipeData) }
    });
  };

  const handleRemoveRecipe = async (savedRecipe) => {
    Alert.alert(
      'Remove Recipe',
      'Are you sure you want to remove this recipe from your favorites?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const recipe = {
                ...savedRecipe.recipe,
                isCustom: savedRecipe.recipeSource === 'ai',
                recipeID: savedRecipe.aiRecipeID,
                uri: savedRecipe.edamamRecipeURI
              };

              const result = await RecipeMatcherService.unsaveRecipe(user.email, recipe);
              
              if (result.success) {
                setSavedRecipes(prev => prev.filter(r => 
                  savedRecipe.recipeSource === 'ai'
                    ? r.aiRecipeID !== savedRecipe.aiRecipeID
                    : r.edamamRecipeURI !== savedRecipe.edamamRecipeURI
                ));
                Alert.alert('Removed', 'Recipe removed from favorites');
              } else {
                Alert.alert('Error', 'Failed to remove recipe');
              }
            } catch (error) {
              console.error('Error removing recipe:', error);
              Alert.alert('Error', 'Something went wrong');
            }
          }
        }
      ]
    );
  };

  const handleHistoryRecipePress = (historyItem) => {
    const recipe = historyItem.recipeData;
    
    router.push({
      pathname: '/recipe-detail',
      params: { recipeData: JSON.stringify(recipe) }
    });
  };

  const handleRemoveHistory = async (historyItem) => {
    Alert.alert(
      'Remove from History',
      'Are you sure you want to remove this from your cooking history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await RecipeHistoryService.deleteRecipeFromHistory(historyItem.historyID);
              
              if (result.success) {
                setRecipeHistory(prev => prev.filter(h => h.historyID !== historyItem.historyID));
                Alert.alert('Removed', 'Recipe removed from history');
              } else {
                Alert.alert('Error', 'Failed to remove recipe from history');
              }
            } catch (error) {
              console.error('Error removing history:', error);
              Alert.alert('Error', 'Something went wrong');
            }
          }
        }
      ]
    );
  };

  const renderRecipeCard = ({ item }) => {
    const recipe = item.recipe;
    const isAI = item.recipeSource === 'ai';
    
    return (
      <TouchableOpacity
        style={styles.favoriteRecipeCard}
        onPress={() => handleRecipePress(item)}
        activeOpacity={0.7}
      >
        <Image
          source={{ uri: recipe.recipeImage || recipe.image }}
          style={styles.favoriteRecipeImage}
          resizeMode="cover"
        />
        
        {/* AI Badge */}
        {isAI && (
          <View style={styles.aiBadge}>
            <Ionicons name="sparkles" size={10} color="#fff" />
            <Text style={styles.aiBadgeText}>AI</Text>
          </View>
        )}
        
        <View style={styles.favoriteRecipeInfo}>
          <Text style={styles.favoriteRecipeTitle} numberOfLines={2}>
            {recipe.recipeName || recipe.label}
          </Text>
          
          <View style={styles.favoriteRecipeMeta}>
            <Ionicons name="time-outline" size={12} color="#999" />
            <Text style={styles.favoriteRecipeMetaText}>
              {recipe.cookTime || recipe.totalTime || 'N/A'} min
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.favoriteRemoveButton}
          onPress={() => handleRemoveRecipe(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="heart" size={18} color="#FF6B6B" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'scheduled':
        return (
          <View style={styles.tabContent}>
            <EmptyState
              icon="calendar-outline"
              title="No scheduled items"
              subtitle="Items you schedule will appear here"
            />
          </View>
        );
      case 'favorites':
        return (
          <View style={styles.tabContent}>
            <FavoritesTab
              recipes={savedRecipes}
              loading={loadingRecipes}
              onRecipePress={handleRecipePress}
              onRemoveRecipe={handleRemoveRecipe}
            />
          </View>
        );
      case 'history':
        return (
          <View style={styles.tabContent}>
            <HistoryTab
              history={recipeHistory}
              loading={loadingHistory}
              onRecipePress={handleHistoryRecipePress}
              onRemoveHistory={handleRemoveHistory}
            />
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <AuthGuard>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={handleBack}
        >
          <Ionicons name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.placeholderRight} />
      </View>
      
      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#4CAF50']} // Android spinner color
          />
        }
      >
        {/* Profile Section */}
        <ProfileHeader profileData={profileData} />
        
        {/* Tabs Navigation */}
        <ProfileTabs activeTab={activeTab} onTabChange={handleTabChange} />
        
        {/* Tab Content */}
        {renderTabContent()}
        
        {/* Account Actions */}
        <ProfileActions />
        
        {/* Logout Button */}
        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
        
        <Text style={styles.versionText}>Version 1.0.0 (Build 1)</Text>
      </ScrollView>
    </SafeAreaView>
    </AuthGuard>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholderRight: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
    minHeight: 200,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  logoutButton: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 24,
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  logoutText: {
    fontSize: 16,
    color: '#333',
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#aaa',
    marginBottom: 30,
  },
});

export default Profile;
