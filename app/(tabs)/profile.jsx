import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  RefreshControl,
  Platform,
} from 'react-native';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCustomAuth } from '../../hooks/use-custom-auth';
import { useTabContext } from '../../contexts/tab-context';
import RecipeMatcherService from '../../services/recipe-matcher-service';
import RecipeHistoryService from '../../services/recipe-history-service';
import RecipeSchedulingService from '../../services/recipe-scheduling-service';
import AuthGuard from '../../components/auth-guard';
import ProfileHeader from '../../components/profile/profile-header';
import ProfileTabs from '../../components/profile/profile-tabs';
import FavoritesTab from '../../components/profile/favorites-tab';
import HistoryTab from '../../components/profile/history-tab';
import ScheduledTab from '../../components/profile/scheduled-tab';
import EmptyState from '../../components/profile/empty-state';
import ProfileActions from '../../components/profile/profile-actions';
import FAQsModal from '../../components/profile/faqs-modal';
import HowToUseModal from '../../components/profile/how-to-use-modal';
import TermsPoliciesModal from '../../components/profile/terms-policies-modal';
import ProfileEditModal from '../../components/profile/profile-edit-modal';
import RestartModal from '../../components/profile/restart-modal';
import { LogoutAlert } from '../../components/common/app-alert';

const Profile = () => {
  const { user, customUserData, signOut, fetchCustomUserData, updateProfile } = useCustomAuth();
  const [activeTab, setActiveTab] = useState('scheduled');
  const [profileData, setProfileData] = useState({
    name: 'User',
    email: 'user@example.com',
    verified: true,
    avatar: null,
  });
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [recipeHistory, setRecipeHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [scheduledRecipes, setScheduledRecipes] = useState([]);
  const [loadingScheduled, setLoadingScheduled] = useState(false);
  const [faqsModalVisible, setFaqsModalVisible] = useState(false);
  const [howToUseModalVisible, setHowToUseModalVisible] = useState(false);
  const [termsModalVisible, setTermsModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [restartModalVisible, setRestartModalVisible] = useState(false);
  const [logoutAlertVisible, setLogoutAlertVisible] = useState(false);
  const [tabsLoaded, setTabsLoaded] = useState({
    favorites: false,
    history: false,
    scheduled: false,
  });

  const scrollViewRef = useRef(null);
  const { subscribe } = useTabContext();

  // Handle tab press events (scroll to top)
  useEffect(() => {
    const unsubscribe = subscribe((event) => {
      if (event.type === 'tabPress' && event.isAlreadyActive && event.route.includes('profile')) {
        // Use a small timeout to ensure the scroll happens after any potential layout updates
        setTimeout(() => {
          if (scrollViewRef.current) {
            scrollViewRef.current.scrollTo({ y: 0, animated: true });
          }
        }, 10);
      }
    });
    return unsubscribe;
  }, [subscribe]);

  useEffect(() => {
    // Update profile data if user information is available
    if (user) {
      setProfileData({
        name: customUserData?.userName || user.email?.split('@')[0] || 'User',
        email: user.email || 'No email available',
        verified: user.email_confirmed_at !== null,
        avatar: customUserData?.profileAvatar || null,
      });

      // Load saved recipes when user is available (lazy load - only on mount)
      if (activeTab === 'favorites') {
        loadSavedRecipes();
      }

      // Load scheduled recipes when on scheduled tab
      if (activeTab === 'scheduled') {
        loadScheduledRecipes();
      }
    }
  }, [user, customUserData, activeTab]);

  const loadSavedRecipes = async () => {
    if (!user?.email) {
      console.log('⚠️ No user email available for loading favorites');
      setLoadingRecipes(false);
      return;
    }

    try {
      setLoadingRecipes(true);
      console.log('📥 Loading saved recipes for:', user.email);
      let recipes = await RecipeMatcherService.getSavedRecipes(user.email);

      // Debug: Check structure of first recipe
      if (recipes.length > 0) {
        console.log('🔍 First saved recipe structure:', {
          hasRecipe: !!recipes[0].recipe,
          recipeKeys: recipes[0].recipe ? Object.keys(recipes[0].recipe) : [],
          recipeSource: recipes[0].recipeSource,
          fullItem: recipes[0]
        });
      }

      setSavedRecipes(recipes);
      console.log('✅ Loaded', recipes.length, 'saved recipes');
    } catch (error) {
      console.error('❌ Error loading saved recipes:', error);
    } finally {
      setLoadingRecipes(false);
    }
  };

  const loadRecipeHistory = async () => {
    console.log('🔄 loadRecipeHistory called!');

    if (!customUserData?.userID) {
      console.log('⚠️ No user ID available for loading history');
      setLoadingHistory(false);
      return;
    }

    try {
      setLoadingHistory(true);
      console.log('📥 Loading recipe history for user:', customUserData.userID);
      const history = await RecipeHistoryService.getRecipeHistory(customUserData.userID);

      // Format history data - parse recipeData JSONB if needed
      const formattedHistory = history.map(item => {
        let recipe = item.recipeData;

        console.log('📝 Formatting history item:', {
          hasRecipeData: !!item.recipeData,
          recipeDataType: typeof item.recipeData,
          recipeName: item.recipeName
        });

        // Parse recipeData if it's a string (JSONB from database)
        if (typeof recipe === 'string') {
          try {
            recipe = JSON.parse(recipe);
            console.log('✅ Parsed JSONB recipeData for history item');
          } catch (parseError) {
            console.error('❌ Failed to parse recipeData:', parseError);
            recipe = { label: item.recipeName, image: null };
          }
        }

        // Detect recipe source (AI or Edamam)
        const recipeSource = recipe?.recipeID ? 'ai' : 'edamam';

        const formatted = {
          ...item,
          recipe: recipe || { label: item.recipeName, image: null },
          recipeSource: recipeSource
        };

        console.log('✨ Formatted history item:', {
          hasRecipe: !!formatted.recipe,
          recipeSource: formatted.recipeSource,
          recipeKeys: formatted.recipe ? Object.keys(formatted.recipe).slice(0, 5) : []
        });

        return formatted;
      });

      setRecipeHistory(formattedHistory);
      console.log('✅ Loaded', formattedHistory.length, 'history items');

      // 🔄 Refresh expired Edamam images in background
      const hasExpiredImages = formattedHistory.some(r => r.recipe?._imageExpired);
      if (hasExpiredImages) {
        console.log('🔄 Refreshing expired history images in background...');
        RecipeMatcherService.refreshExpiredImages(formattedHistory)
          .then(refreshedHistory => {
            console.log('✅ History images refreshed, updating state');
            setRecipeHistory(refreshedHistory);
          })
          .catch(error => {
            console.error('❌ Error refreshing history images:', error);
          });
      }

    } catch (error) {
      console.error('❌ Error loading recipe history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadScheduledRecipes = async () => {
    if (!customUserData?.userID) {
      console.log('⚠️ No user ID available for loading scheduled recipes');
      setLoadingScheduled(false);
      return;
    }

    try {
      setLoadingScheduled(true);
      console.log('📅 Loading scheduled recipes for user:', customUserData.userID);
      const scheduled = await RecipeSchedulingService.getScheduledRecipes(customUserData.userID, false);
      setScheduledRecipes(scheduled);
      console.log('✅ Loaded', scheduled.length, 'scheduled recipes');
    } catch (error) {
      console.error('❌ Error loading scheduled recipes:', error);
    } finally {
      setLoadingScheduled(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);

    // Load recipes when favorites tab is selected
    if (tab === 'favorites') {
      if (!tabsLoaded.favorites) {
        loadSavedRecipes();
        setTabsLoaded(prev => ({ ...prev, favorites: true }));
      }
    }

    // Load history when history tab is selected
    if (tab === 'history') {
      if (!tabsLoaded.history) {
        loadRecipeHistory();
        setTabsLoaded(prev => ({ ...prev, history: true }));
      }
    }

    // Load scheduled when scheduled tab is selected
    if (tab === 'scheduled') {
      if (!tabsLoaded.scheduled) {
        loadScheduledRecipes();
        setTabsLoaded(prev => ({ ...prev, scheduled: true }));
      }
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
      } else if (activeTab === 'scheduled') {
        await loadScheduledRecipes();
      }

    } catch (error) {
      console.error('Error refreshing profile:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleEditProfileSave = async ({ name, avatar }) => {
    if (!user?.email) {
      return;
    }

    try {
      const updated = await updateProfile({ userName: name, profileAvatar: avatar });

      setProfileData((prev) => ({
        ...prev,
        name: updated?.userName ?? name,
        avatar: updated?.profileAvatar ?? avatar ?? null,
      }));

      setEditModalVisible(false);
      setRestartModalVisible(true);
    } catch (error) {
      console.error('Error updating profile:', error);
      // Optionally handle error silently or with a toast/snackbar
    } finally {
    }
  };

  const handleLogout = async () => {
    setLogoutAlertVisible(true);
  };

  const confirmLogout = async () => {
    try {
      await signOut();
      router.replace('/signin');
    } catch (error) {
      console.error('Logout error:', error);
      // Optionally handle error silently or with a toast/snackbar
    } finally {
      setLogoutAlertVisible(false);
    }
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
      }
    } catch (error) {
      console.error('Error removing recipe:', error);
    }
  };

  const handleHistoryRecipePress = (historyItem) => {
    const recipe = historyItem.recipeData;

    router.push({
      pathname: '/recipe-detail',
      params: { recipeData: JSON.stringify(recipe) }
    });
  };

  const handleRemoveHistory = async (historyItem) => {
    try {
      const result = await RecipeHistoryService.deleteRecipeFromHistory(historyItem.historyID);
      if (result.success) {
        setRecipeHistory(prev => prev.filter(h => h.historyID !== historyItem.historyID));
      }
    } catch (error) {
      console.error('Error removing history:', error);
    }
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
            <ScheduledTab
              scheduledRecipes={scheduledRecipes}
              onDelete={() => loadScheduledRecipes()}
              onRefresh={loadScheduledRecipes}
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
              onRefresh={loadRecipeHistory}
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
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#81A969']}
            />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Profile</Text>
          </View>

          {/* Profile Section */}
          <ProfileHeader profileData={profileData} onEditPress={() => setEditModalVisible(true)} />

          {/* Tabs Navigation */}
          <ProfileTabs activeTab={activeTab} onTabChange={handleTabChange} />

          {/* Tab Content */}
          {renderTabContent()}

          {/* Account Actions */}
          <ProfileActions
            onFAQPress={() => setFaqsModalVisible(true)}
            onHowToUsePress={() => setHowToUseModalVisible(true)}
            onTermsPress={() => setTermsModalVisible(true)}
          />

          {/* Logout Button */}
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Text style={styles.logoutText}>Log out</Text>
          </TouchableOpacity>

          <Text style={styles.versionText}>Version 1.0 | Made by Group 1 4ITH</Text>
        </ScrollView>

        {/* Modals */}
        <FAQsModal
          visible={faqsModalVisible}
          onClose={() => setFaqsModalVisible(false)}
        />

        <HowToUseModal
          visible={howToUseModalVisible}
          onClose={() => setHowToUseModalVisible(false)}
        />

        <TermsPoliciesModal
          visible={termsModalVisible}
          onClose={() => setTermsModalVisible(false)}
        />

        {editModalVisible && (
          <ProfileEditModal
            visible
            initialName={profileData.name}
            initialAvatar={profileData.avatar}
            onClose={() => setEditModalVisible(false)}
            onSave={handleEditProfileSave}
          />
        )}
        {/* Restart Modal */}
        <RestartModal visible={restartModalVisible} onClose={() => setRestartModalVisible(false)} />

        <LogoutAlert
          visible={logoutAlertVisible}
          onConfirm={confirmLogout}
          onCancel={() => setLogoutAlertVisible(false)}
        />
      </SafeAreaView>
    </AuthGuard>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    paddingHorizontal: wp('5%'),
    paddingTop: hp('7%'),
    paddingBottom: hp('2%'),
    backgroundColor: '#F8F9FA',
  },
  headerTitle: {
    fontSize: wp('7.5%'),
    fontWeight: 'bold',
    color: '#000',
  },
  placeholderRight: {
    width: wp('10%'),
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollViewContent: {
    paddingBottom: hp('12%'), // Extra padding to account for bottom navbar
  },
  tabContent: {
    flex: 1,
    minHeight: hp('25%'),
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('2.5%'),
    backgroundColor: '#F8F9FA',
  },
  logoutButton: {
    marginHorizontal: wp('8%'),
    marginTop: hp('3%'),
    marginBottom: hp('2%'),
    backgroundColor: '#fff',
    paddingVertical: hp('2%'),
    borderRadius: wp('8%'),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#81A969',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 6,
  },
  logoutText: {
    fontSize: wp('4%'),
    color: '#81A969',
    fontWeight: '600',
  },
  versionText: {
    textAlign: 'center',
    fontSize: wp('3%'),
    color: '#aaa',
    marginBottom: hp('3%'),
  },
  modalButton: {
    backgroundColor: '#81A969',
    paddingVertical: hp('2%'),
    borderRadius: wp('8%'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonText: {
    fontSize: wp('4%'),
    color: '#fff',
    fontWeight: '600',
  },
});

export default Profile;
