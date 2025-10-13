import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import TopographicBackground from '../components/TopographicBackground';
import RecipeMatcherService from '../services/recipe-matcher-service';
import { useCustomAuth } from '../hooks/use-custom-auth';
import AuthGuard from '../components/AuthGuard';

export default function SavedRecipesScreen() {
  const { user } = useCustomAuth();
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // Wait for user to be loaded before fetching recipes
    if (user?.email) {
      loadSavedRecipes();
    }
  }, [user]);

  const loadSavedRecipes = async () => {
    if (!user?.email) {
      console.log('⏳ Waiting for user to load...');
      return;
    }

    try {
      console.log('📥 Loading saved recipes for:', user.email);
      setLoading(true);
      const recipes = await RecipeMatcherService.getSavedRecipes(user.email);
      console.log('✅ Loaded recipes:', recipes.length);
      setSavedRecipes(recipes);
    } catch (error) {
      console.error('❌ Error loading saved recipes:', error);
      Alert.alert('Error', 'Failed to load saved recipes');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSavedRecipes();
    setRefreshing(false);
  };

  const handleRecipePress = (savedRecipe) => {
    const recipe = savedRecipe.recipe;
    const recipeData = savedRecipe.isCustom
      ? { ...recipe, isCustom: true }
      : recipe;

    console.log('📖 Opening recipe detail:', { 
      isCustom: savedRecipe.isCustom,
      recipeSource: savedRecipe.recipeSource,
      hasRecipe: !!recipe 
    });

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
              console.log('🗑️ Removing recipe from favorites:', {
                recipeSource: savedRecipe.recipeSource,
                aiRecipeID: savedRecipe.aiRecipeID,
                edamamRecipeURI: savedRecipe.edamamRecipeURI
              });

              // Create recipe object with proper structure for unsaveRecipe
              const recipe = {
                ...savedRecipe.recipe,
                isCustom: savedRecipe.recipeSource === 'ai',
                recipeID: savedRecipe.aiRecipeID,
                uri: savedRecipe.edamamRecipeURI
              };

              const result = await RecipeMatcherService.unsaveRecipe(user.email, recipe);
              
              if (result.success) {
                console.log('✅ Recipe removed successfully');
                setSavedRecipes(prev => prev.filter(r => 
                  savedRecipe.recipeSource === 'ai'
                    ? r.aiRecipeID !== savedRecipe.aiRecipeID
                    : r.edamamRecipeURI !== savedRecipe.edamamRecipeURI
                ));
                Alert.alert('Removed', 'Recipe removed from favorites');
              } else {
                console.error('❌ Failed to remove recipe:', result.error);
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

  const renderRecipeCard = ({ item }) => {
    const recipe = item.recipe;
    const isAI = item.recipeSource === 'ai';
    
    return (
      <TouchableOpacity
        style={styles.recipeCard}
        onPress={() => handleRecipePress(item)}
        activeOpacity={0.7}
      >
        <Image
          source={{ uri: recipe.recipeImage || recipe.image }}
          style={styles.recipeImage}
          resizeMode="cover"
        />
        
        {/* AI Badge */}
        {isAI && (
          <View style={styles.aiBadge}>
            <Ionicons name="sparkles" size={12} color="#fff" />
            <Text style={styles.aiBadgeText}>SousChef AI</Text>
          </View>
        )}
        
        <View style={styles.recipeInfo}>
          <Text style={styles.recipeTitle} numberOfLines={2}>
            {recipe.recipeName || recipe.label}
          </Text>
          
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={14} color="#666" />
              <Text style={styles.metaText}>
                {recipe.cookTime || recipe.totalTime || 'N/A'} min
              </Text>
            </View>
            
            <View style={styles.metaItem}>
              <Ionicons name="eye-outline" size={14} color="#666" />
              <Text style={styles.metaText}>
                {item.viewCount || 0} views
              </Text>
            </View>
          </View>

          {item.notes && (
            <View style={styles.notesContainer}>
              <Ionicons name="document-text-outline" size={14} color="#FF6B6B" />
              <Text style={styles.notesText} numberOfLines={1}>
                {item.notes}
              </Text>
            </View>
          )}

          <Text style={styles.savedDate}>
            Saved {new Date(item.lastViewed).toLocaleDateString()}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleRemoveRecipe(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="heart" size={24} color="#FF6B6B" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="bookmark-outline" size={80} color="#ccc" />
      <Text style={styles.emptyTitle}>No Saved Recipes</Text>
      <Text style={styles.emptyText}>
        Save your favorite recipes by tapping the heart icon when viewing them
      </Text>
      <TouchableOpacity
        style={styles.searchButton}
        onPress={() => router.push('/recipe-search')}
      >
        <Text style={styles.searchButtonText}>Search Recipes</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <TopographicBackground />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B6B" />
          <Text style={styles.loadingText}>Loading saved recipes...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <AuthGuard>
      <SafeAreaView style={styles.container}>
        <TopographicBackground />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Saved Recipes</Text>
          <Text style={styles.headerSubtitle}>
            {savedRecipes.length} {savedRecipes.length === 1 ? 'recipe' : 'recipes'}
          </Text>
        </View>
      </View>

      {/* Recipe List */}
      <FlatList
        data={savedRecipes}
        renderItem={renderRecipeCard}
        keyExtractor={(item) => 
          item.recipeSource === 'ai' 
            ? `ai-${item.aiRecipeID}` 
            : `edamam-${item.edamamRecipeURI || item.favoriteID}`
        }
        contentContainerStyle={[
          styles.listContent,
          savedRecipes.length === 0 && styles.emptyListContent
        ]}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#FF6B6B']}
            tintColor="#FF6B6B"
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
    </AuthGuard>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    marginRight: 12,
    padding: 8,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  listContent: {
    padding: 16,
  },
  emptyListContent: {
    flex: 1,
  },
  recipeCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  recipeImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#f0f0f0',
  },
  aiBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(138, 43, 226, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  aiBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  recipeInfo: {
    padding: 16,
  },
  recipeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: '#666',
  },
  notesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF5F5',
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  notesText: {
    flex: 1,
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  savedDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  removeButton: {
    position: 'absolute',
    top: 216,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  searchButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
