import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import EdamamService from '../services/edamam-service';
import RecipeCacheService from '../services/recipe-cache-service';

const RecipeSearch = () => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    cuisineType: '',
    mealType: '',
    dishType: '',
    health: [],
    diet: []
  });
  const [showFilters, setShowFilters] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Dynamic recent searches - track user search history
  const [recentSearches, setRecentSearches] = useState([]);

  // Popular recipes from API
  const [popularRecipes, setPopularRecipes] = useState([]);
  const [loadingPopular, setLoadingPopular] = useState(false);

  useEffect(() => {
    // Load popular recipes on component mount using cache service
    loadPopularRecipesFromCache();
    // Load recent searches from storage (you could use AsyncStorage here)
    loadRecentSearches();
  }, []);

  const loadPopularRecipesFromCache = async () => {
    setLoadingPopular(true);
    try {
      console.log('📱 Loading popular recipes from cache...');
      
      // Get cached recipes (will fetch if cache is empty/expired)
      const cached = await RecipeCacheService.getPopularRecipes(8);
      
      if (cached.length > 0) {
        console.log(`✅ Loaded ${cached.length} popular recipes from cache`);
        const formattedRecipes = cached.map(recipe => ({
          id: recipe.id,
          title: recipe.title,
          image: recipe.image,
          fullData: recipe.fullData,
          category: recipe.category,
          calories: recipe.calories,
          time: recipe.time,
          difficulty: recipe.difficulty,
          rating: recipe.rating
        }));
        
        setPopularRecipes(formattedRecipes);
      } else {
        console.log('⚠️ No cached recipes available, will fetch fresh');
        await handleRefreshPopularRecipes();
      }
    } catch (error) {
      console.error('❌ Error loading popular recipes from cache:', error);
      // Fallback to direct API call if cache fails
      await fetchPopularRecipes();
    } finally {
      setLoadingPopular(false);
    }
  };

  const handleRefreshPopularRecipes = async () => {
    setLoadingPopular(true);
    try {
      console.log('🔄 Refreshing popular recipes...');
      
      // Get API usage stats first
      const apiStats = RecipeCacheService.getApiUsageStats();
      console.log('📊 API Stats:', apiStats);
      
      // Force refresh the cache
      const freshRecipes = await RecipeCacheService.forceRefreshPopularRecipes();
      
      if (freshRecipes && freshRecipes.length > 0) {
        console.log(`✅ Refreshed with ${freshRecipes.length} recipes`);
        
        // Get a random selection for display
        const displayRecipes = RecipeCacheService.shuffleArray([...freshRecipes])
          .slice(0, 8)
          .map(recipe => ({
            id: recipe.id,
            title: recipe.title,
            image: recipe.image,
            fullData: recipe.fullData,
            category: recipe.category,
            calories: recipe.calories,
            time: recipe.time,
            difficulty: recipe.difficulty,
            rating: recipe.rating
          }));
        
        setPopularRecipes(displayRecipes);
        
        // Show success message with API info
        if (apiStats.apiCallsThisMinute > 0) {
          console.log(`ℹ️ Used ${apiStats.apiCallsThisMinute}/${apiStats.rateLimit} API calls`);
        }
        
      } else {
        throw new Error('No recipes received from refresh');
      }
    } catch (error) {
      console.error('❌ Error refreshing popular recipes:', error);
      
      // Show more specific error messages
      if (error.message.includes('rate limit')) {
        Alert.alert(
          'Rate Limit Reached', 
          error.message + '\n\nTip: Popular recipes are cached for 7 days to conserve API calls.',
          [{ text: 'OK' }]
        );
      } else if (error.message.includes('Cache is only')) {
        // This is actually a success case - we shuffled existing recipes
        console.log('ℹ️ Shuffled existing recipes for variety');
      } else {
        Alert.alert(
          'Refresh Error', 
          error.message || 'Failed to refresh popular recipes. Please try again later.',
          [{ text: 'OK' }]
        );
      }
    } finally {
      setLoadingPopular(false);
    }
  };

  const loadRecentSearches = () => {
    // For now, we'll use local state. In a real app, you'd use AsyncStorage
    // Example: const stored = await AsyncStorage.getItem('recentSearches');
    // setRecentSearches(stored ? JSON.parse(stored) : []);
  };

  const addToRecentSearches = (query) => {
    if (!query.trim()) return;
    
    setRecentSearches(prev => {
      // Remove if already exists to avoid duplicates
      const filtered = prev.filter(search => search.toLowerCase() !== query.toLowerCase());
      // Add to beginning and limit to 5 items
      const updated = [query, ...filtered].slice(0, 5);
      
      // In a real app, you'd save to AsyncStorage here
      // AsyncStorage.setItem('recentSearches', JSON.stringify(updated));
      
      return updated;
    });
  };

  const fetchPopularRecipes = async () => {
    // Fallback function for emergency use
    setLoadingPopular(true);
    try {
      console.log('⚠️ Using fallback popular recipes method');
      
      // Use basic fallback data
      const fallbackRecipes = [
        {
          id: 'fallback_1',
          title: 'Chicken Dish',
          image: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=200&h=200&fit=crop',
          category: 'protein',
          time: 30
        },
        {
          id: 'fallback_2',
          title: 'Pasta Recipe',
          image: 'https://images.unsplash.com/photo-1621996346565-e3dbc353d946?w=200&h=200&fit=crop',
          category: 'pasta',
          time: 25
        },
        {
          id: 'fallback_3',
          title: 'Fresh Salad',
          image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&h=200&fit=crop',
          category: 'salad',
          time: 10
        },
        {
          id: 'fallback_4',
          title: 'Sweet Dessert',
          image: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=200&h=200&fit=crop',
          category: 'dessert',
          time: 45
        }
      ];

      setPopularRecipes(fallbackRecipes);
    } catch (error) {
      console.error('❌ Even fallback failed:', error);
    } finally {
      setLoadingPopular(false);
    }
  };

  const removeRecentSearch = (index) => {
    setRecentSearches(prev => {
      const updated = prev.filter((_, i) => i !== index);
      // In a real app, save to AsyncStorage
      // AsyncStorage.setItem('recentSearches', JSON.stringify(updated));
      return updated;
    });
  };

  const clearAllRecentSearches = () => {
    setRecentSearches([]);
    // In a real app, clear from AsyncStorage
    // AsyncStorage.removeItem('recentSearches');
  };

  const handleSearch = async (query = searchQuery) => {
    if (!query.trim()) {
      Alert.alert('Search Required', 'Please enter a recipe name or ingredient to search for.');
      return;
    }

    // Add to recent searches
    addToRecentSearches(query.trim());

    setLoading(true);
    setHasSearched(true);

    try {
      console.log('🔍 Searching for recipes:', query);
      
      // Check API limits before searching
      const apiStats = RecipeCacheService.getApiUsageStats();
      if (!apiStats.canMakeApiCall) {
        Alert.alert(
          'Search Limit Reached', 
          `Please wait ${apiStats.secondsUntilReset} seconds before searching again.\n\nAPI Limit: ${apiStats.rateLimit} searches per minute.`,
          [{ text: 'OK' }]
        );
        setLoading(false);
        return;
      }
      
      const searchOptions = {
        from: 0,
        to: 20,
        ...filters
      };

      const result = await EdamamService.searchRecipes(query, searchOptions);
      
      // Track the API call
      await RecipeCacheService.trackApiCall();

      if (result.success) {
        setRecipes(result.data.recipes);
        console.log(`✅ Found ${result.data.recipes.length} recipes`);
        
        if (result.cached) {
          console.log(`💾 Results loaded from cache (no API call used)`);
        } else {
          console.log(`📊 API calls used: ${apiStats.apiCallsThisMinute + 1}/${apiStats.rateLimit} this minute`);
        }
      } else {
        Alert.alert('Search Error', result.error || 'Failed to search recipes. Please try again.');
        setRecipes([]);
      }
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('Error', 'Something went wrong while searching. Please try again.');
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSearch = (query) => {
    setSearchQuery(query);
    handleSearch(query);
  };

  const handleRecentSearchTap = (search) => {
    setSearchQuery(search);
    handleSearch(search);
  };

  const clearSearchResults = () => {
    setHasSearched(false);
    setRecipes([]);
    setSearchQuery('');
  };

  const renderRecipeCard = ({ item }) => (
    <TouchableOpacity style={styles.recipeCard} onPress={() => handleRecipePress(item)}>
      <Image 
        source={{ uri: item.image }} 
        style={styles.recipeImage}
        resizeMode="cover"
      />
      <View style={styles.recipeInfo}>
        <Text style={styles.recipeTitle} numberOfLines={2}>{item.label}</Text>
        <Text style={styles.recipeSource}>by {item.source}</Text>
        
        <View style={styles.recipeStats}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>⏱️ {item.totalTime || 'N/A'}min</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>🔥 {item.calories} cal</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>👥 {item.yield} servings</Text>
          </View>
        </View>

        {item.dietLabels.length > 0 && (
          <View style={styles.labelsContainer}>
            {item.dietLabels.slice(0, 2).map((label, index) => (
              <View key={index} style={styles.dietLabel}>
                <Text style={styles.labelText}>{label}</Text>
              </View>
            ))}
          </View>
        )}

        {item.healthLabels.length > 0 && (
          <View style={styles.labelsContainer}>
            {item.healthLabels.slice(0, 3).map((label, index) => (
              <View key={index} style={styles.healthLabel}>
                <Text style={styles.labelText}>{label}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const handleRecipePress = (recipe) => {
    // Navigate to detailed recipe view
    router.push({
      pathname: '/recipe-detail',
      params: { recipeData: JSON.stringify(recipe) }
    });
  };

  const handlePopularRecipePress = (recipe) => {
    // For popular recipes, we need to fetch full recipe data first
    if (recipe.fullData) {
      handleRecipePress(recipe.fullData);
    } else {
      // If we only have basic data, show a simple alert or search for the recipe
      Alert.alert('Recipe', `${recipe.title}\n\nTap search to find more details about this recipe.`);
    }
  };

  const quickSearches = EdamamService.getPopularSearches();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* API Usage Stats - Only show in development */}

      
      {/* Search Header */}
      <View style={styles.searchHeader}>
        <View style={styles.searchContainer}>
          {hasSearched && (
            <TouchableOpacity 
              style={styles.backButton}
              onPress={clearSearchResults}
            >
              <Ionicons name="arrow-back" size={20} color="#666" />
            </TouchableOpacity>
          )}
          <Ionicons name="search-outline" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for recipes and ingredients"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={() => handleSearch()}
            returnKeyType="search"
          />
          <TouchableOpacity style={styles.filterButton}>
            <Ionicons name="options-outline" size={20} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.cameraButton}>
            <Ionicons name="camera-outline" size={20} color="#666" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Search Results - Show when user has searched */}
        {hasSearched && recipes.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Search Results</Text>
              <Text style={styles.resultsCount}>{recipes.length} recipes found</Text>
            </View>
            
            <FlatList
              data={recipes}
              renderItem={renderRecipeCard}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              scrollEnabled={false} // Disable internal scrolling since we're in a ScrollView
              numColumns={1}
            />
          </View>
        )}

        {/* No Results Message */}
        {hasSearched && recipes.length === 0 && !loading && (
          <View style={styles.section}>
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No recipes found</Text>
              <Text style={styles.emptySubtext}>Try a different search term or check your spelling</Text>
            </View>
          </View>
        )}

        {/* Loading State */}
        {loading && (
          <View style={styles.section}>
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4CAF50" />
              <Text style={styles.loadingText}>Searching for recipes...</Text>
            </View>
          </View>
        )}

        {/* Recent Searches - Show only when not searching or no results */}
        {!hasSearched && recentSearches.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Searches</Text>
              <TouchableOpacity onPress={clearAllRecentSearches}>
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            </View>
            
            {recentSearches.map((search, index) => (
              <TouchableOpacity 
                key={index} 
                style={styles.recentSearchItem}
                onPress={() => handleRecentSearchTap(search)}
              >
                <Ionicons name="search-outline" size={16} color="#666" style={styles.recentSearchIcon} />
                <Text style={styles.recentSearchText}>{search}</Text>
                <TouchableOpacity 
                  style={styles.removeButton}
                  onPress={() => removeRecentSearch(index)}
                >
                  <Ionicons name="close" size={16} color="#666" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Popular Recipes - Show only when not searching */}
        {!hasSearched && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Popular Recipes</Text>
              <TouchableOpacity 
                onPress={handleRefreshPopularRecipes}
                disabled={loadingPopular}
              >
                <Text style={[styles.viewAllText, loadingPopular && styles.disabledText]}>
                  {loadingPopular ? 'Refreshing...' : 'Refresh'}
                </Text>
              </TouchableOpacity>
            </View>
            
            {loadingPopular ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4CAF50" />
                <Text style={styles.loadingText}>
                  {popularRecipes.length > 0 ? 'Refreshing recipes...' : 'Loading popular recipes...'}
                </Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.popularRecipesContainer}>
                {popularRecipes.map((recipe, index) => (
                  <TouchableOpacity 
                    key={recipe.id} 
                    style={[styles.popularRecipeCard, index === 0 && styles.firstCard]}
                    onPress={() => handlePopularRecipePress(recipe)}
                  >
                    <Image 
                      source={{ uri: recipe.image }} 
                      style={styles.popularRecipeImage}
                      onError={() => console.log('Image load error for:', recipe.title)}
                    />
                    <Text style={styles.popularRecipeTitle}>{recipe.title}</Text>
                    {recipe.category && (
                      <Text style={styles.recipeCategory}>{recipe.category}</Text>
                    )}
                    {recipe.time && (
                      <Text style={styles.recipeTime}>⏱️ {recipe.time}min</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        )}
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="home-outline" size={24} color="#666" />
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.navItem, styles.activeNavItem]}>
          <Ionicons name="search-outline" size={24} color="#4CAF50" />
          <Text style={[styles.navLabel, styles.activeNavLabel]}>Search</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.centerNavButton}>
          <View style={styles.centerNavIcon}>
            <Ionicons name="add" size={28} color="#fff" />
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="list-outline" size={24} color="#666" />
          <Text style={styles.navLabel}>Pantry</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="person-outline" size={24} color="#666" />
          <Text style={styles.navLabel}>Profile</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  searchHeader: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
    backgroundColor: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 25,
    paddingHorizontal: 15,
    height: 50,
  },
  searchIcon: {
    marginRight: 10,
  },
  backButton: {
    padding: 5,
    marginRight: 5,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  filterButton: {
    padding: 5,
    marginLeft: 10,
  },
  cameraButton: {
    padding: 5,
    marginLeft: 5,
  },
  content: {
    flex: 1,
    backgroundColor: '#fff',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  clearText: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: '500',
  },
  viewAllText: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: '500',
  },
  resultsCount: {
    fontSize: 14,
    color: '#666',
    fontWeight: '400',
  },
  recipeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: 'hidden',
  },
  recipeImage: {
    width: '100%',
    height: 200,
  },
  recipeInfo: {
    padding: 15,
  },
  recipeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 5,
  },
  recipeSource: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 10,
  },
  recipeStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  labelsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 5,
  },
  dietLabel: {
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 5,
    marginBottom: 5,
  },
  healthLabel: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 5,
    marginBottom: 5,
  },
  labelText: {
    fontSize: 10,
    color: '#2c3e50',
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    fontSize: 18,
    color: '#7f8c8d',
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#bdc3c7',
    marginTop: 5,
    textAlign: 'center',
  },
  recentSearchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f0f0f0',
  },
  recentSearchIcon: {
    marginRight: 15,
  },
  recentSearchText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  removeButton: {
    padding: 5,
  },
  popularRecipesContainer: {
    marginLeft: -20,
  },
  popularRecipeCard: {
    alignItems: 'center',
    marginLeft: 20,
    width: 80,
  },
  firstCard: {
    marginLeft: 20,
  },
  popularRecipeImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
    marginBottom: 8,
  },
  popularRecipeTitle: {
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 2,
  },
  recipeCategory: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    textTransform: 'capitalize',
    marginBottom: 2,
  },
  recipeTime: {
    fontSize: 10,
    color: '#4CAF50',
    textAlign: 'center',
    fontWeight: '500',
  },
  disabledText: {
    opacity: 0.5,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderTopWidth: 0.5,
    borderTopColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  navItem: {
    alignItems: 'center',
    flex: 1,
  },
  activeNavItem: {
    // Active state styling
  },
  navLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontWeight: '500',
  },
  activeNavLabel: {
    color: '#4CAF50',
  },
  centerNavButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 10,
  },
  centerNavIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4CAF50',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
});

export default RecipeSearch;
