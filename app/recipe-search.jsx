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
import cacheService from '../services/supabase-cache-service';
import SousChefAIService from '../services/souschef-ai-service';
import AuthGuard from '../components/AuthGuard';
import { useCustomAuth } from '../hooks/use-custom-auth';

const RecipeSearch = () => {
  const router = useRouter();
  const { user } = useCustomAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [aiRecipeCount, setAiRecipeCount] = useState(0); // Track how many AI recipes generated
  const [canGenerateMore, setCanGenerateMore] = useState(false); // Show "Generate Another" button
  const [currentSearchQuery, setCurrentSearchQuery] = useState(''); // Store current search for "Generate Another"
  const [filters, setFilters] = useState({
    cuisineType: '',
    mealType: '',
    dishType: '',
    health: [],
    diet: []
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState([]);

  // Edamam API Health Labels (diets + allergies combined)
  const healthLabels = [
    'Balanced',
    'High-Fiber',
    'High-Protein',
    'Low-Carb',
    'Low-Fat',
    'Low-Sodium',
    'Dairy-Free',
    'Egg-Free',
    'Fish-Free',
    'Gluten-Free',
    'Keto-Friendly',
    'Kidney-Friendly',
    'Kosher',
    'Mediterranean',
    'No-Oil-Added',
    'Paleo',
    'Peanut-Free',
    'Pescatarian',
    'Pork-Free',
    'Red-Meat-Free',
    'Sesame-Free',
    'Shellfish-Free',
    'Soy-Free',
    'Sugar-Free',
    'Tree-Nut-Free',
    'Vegan',
    'Vegetarian',
    'Wheat-Free'
  ];
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
      console.log('📱 Loading popular recipes from Supabase cache...');
      
      // Get cached recipes from Supabase (auto-fetches from API if cache is empty/expired)
      const cached = await cacheService.getPopularRecipes();
      
      if (cached && cached.length > 0) {
        console.log(`✅ Loaded ${cached.length} popular recipes from cache`);
        
        // Take first 8 recipes
        const limitedRecipes = cached.slice(0, 8);
        
        const formattedRecipes = limitedRecipes.map((recipe, index) => ({
          id: recipe.uri || `recipe-${index}`,
          title: recipe.label || recipe.title,
          image: recipe.image,
          fullData: recipe,
          category: recipe.cuisineType?.[0] || recipe.category || 'General',
          calories: Math.round(recipe.calories / recipe.yield) || recipe.calories || 0,
          time: recipe.totalTime || recipe.time || 30,
          difficulty: recipe.difficulty || 'Medium',
          rating: recipe.rating || 4.5
        }));
        
        setPopularRecipes(formattedRecipes);
      } else {
        console.log('⚠️ No cached recipes available, will fetch fresh');
        await handleRefreshPopularRecipes();
      }
    } catch (error) {
      console.error('❌ Error loading popular recipes from cache:', error);
      // Fallback: fetch fresh popular recipes
      await handleRefreshPopularRecipes();
    } finally {
      setLoadingPopular(false);
    }
  };

  const handleRefreshPopularRecipes = async () => {
    setLoadingPopular(true);
    try {
      console.log('🔄 Refreshing popular recipes from API...');
      
      // Force refresh the cache (bypasses cache, fetches fresh from API)
      const freshRecipes = await cacheService.getPopularRecipes(true); // true = forceRefresh
      
      if (freshRecipes && freshRecipes.length > 0) {
        console.log(`✅ Refreshed with ${freshRecipes.length} recipes from API`);
        
        // Shuffle for variety and take first 8
        const shuffled = [...freshRecipes].sort(() => Math.random() - 0.5);
        const displayRecipes = shuffled.slice(0, 8).map((recipe, index) => ({
          id: recipe.uri || `recipe-${index}`,
          title: recipe.label || recipe.title,
          image: recipe.image,
          fullData: recipe,
          category: recipe.cuisineType?.[0] || recipe.category || 'General',
          calories: Math.round(recipe.calories / recipe.yield) || recipe.calories || 0,
          time: recipe.totalTime || recipe.time || 30,
          difficulty: recipe.difficulty || 'Medium',
          rating: recipe.rating || 4.5
        }));
        
        setPopularRecipes(displayRecipes);
        console.log('✅ Popular recipes updated and cached in Supabase (expires in 6h)');
      } else {
        throw new Error('No recipes received from API');
      }
    } catch (error) {
      console.error('❌ Error refreshing popular recipes:', error);
      
      Alert.alert(
        'Refresh Error', 
        'Failed to refresh popular recipes. Please try again later.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoadingPopular(false);
    }
  };

  const loadRecentSearches = () => {
    // For now, we'll use local state. In a real app, you'd use AsyncStorage
    // Example: const stored = await AsyncStorage.getItem('recentSearches');
    // setRecentSearches(stored ? JSON.parse(stored) : []);
  };

  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  const toggleFilter = (filter) => {
    setSelectedFilters(prev => {
      if (prev.includes(filter)) {
        // Remove filter if already selected
        return prev.filter(f => f !== filter);
      } else {
        // Add filter if not selected
        return [...prev, filter];
      }
    });
  };

  const clearAllFilters = () => {
    setSelectedFilters([]);
  };

  const getFilterCount = () => {
    return selectedFilters.length;
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
        health: selectedFilters,
        ...filters
      };

      // Use Supabase cache service (automatically handles caching and API calls)
      const recipes = await cacheService.getSearchResults(query, searchOptions);
      const result = { success: true, data: { recipes } };

      if (result.success && result.data.recipes.length > 0) {
        // ✅ Step 1: Edamam API returned recipes
        setRecipes(result.data.recipes);
        setCanGenerateMore(false); // No AI needed
        setAiRecipeCount(0);
        console.log(`✅ Found ${result.data.recipes.length} recipes from Edamam`);
        
        if (result.cached) {
          console.log(`💾 Results loaded from cache (no API call used)`);
        } else {
          console.log(`📊 API calls used: ${apiStats.apiCallsThisMinute + 1}/${apiStats.rateLimit} this minute`);
        }
        setLoading(false);
      } else if (result.success && result.data.recipes.length === 0) {
        // ❌ Step 2: No results from Edamam - Check tbl_recipes
        console.log('ℹ️ No results from Edamam API, checking tbl_recipes...');
        
        const dbResult = await SousChefAIService.checkExistingRecipes(query, filters);
        
        if (dbResult.found && dbResult.recipes.length > 0) {
          // ✅ Found recipes in tbl_recipes!
          console.log(`✅ Found ${dbResult.count} recipes in tbl_recipes`);
          
          // Format database recipes to match Edamam structure
          const formattedDbRecipes = dbResult.recipes.map(recipe => ({
            id: recipe.recipeID,
            uri: `souschef://recipe/${recipe.recipeID}`,
            label: recipe.recipeName,
            image: recipe.recipeImage,
            source: recipe.generatedBy || 'SousChef AI',
            url: null,
            yield: recipe.servings,
            dietLabels: recipe.dietLabels || [],
            healthLabels: recipe.healthLabels || [],
            cautions: recipe.allergens || [],
            ingredientLines: recipe.ingredients.map(ing => 
              `${ing.quantity} ${ing.unit} ${ing.name}${ing.notes ? ` (${ing.notes})` : ''}`
            ),
            ingredients: recipe.ingredients,
            calories: recipe.calories,
            totalTime: recipe.cookingTime,
            cuisineType: [recipe.cuisineType],
            mealType: [recipe.mealType],
            dishType: [recipe.dishType],
            isCustom: true,
            recipeID: recipe.recipeID,
            instructions: recipe.instructions,
            difficulty: recipe.difficulty
          }));
          
          setRecipes(formattedDbRecipes);
          setCanGenerateMore(formattedDbRecipes.length < 5); // Allow generating more if less than 5
          setAiRecipeCount(0);
          setCurrentSearchQuery(query);
          setLoading(false);
          
          Alert.alert(
            '📚 Found Existing Recipes',
            `We found ${dbResult.count} ${dbResult.count === 1 ? 'recipe' : 'recipes'} from our database!${formattedDbRecipes.length < 5 ? '\n\nWant more? Tap "Generate Another" to create new recipes with AI.' : ''}`,
            [{ text: 'Great!', style: 'default' }]
          );
        } else {
          // ❌ Step 3: No results anywhere - Generate 1 AI recipe
          console.log('ℹ️ No existing recipes found, generating 1 AI recipe...');
          setLoading(false);
          setGeneratingAI(true);
          setCurrentSearchQuery(query);
          
          try {
            // Get user's pantry items
            let pantryItems = [];
            if (user?.email) {
              pantryItems = await SousChefAIService.getUserPantryItems(user.email);
              console.log(`📦 Found ${pantryItems.length} pantry items`);
            }
            
            // Generate 1 AI recipe (with duplicate detection)
            const aiResult = await SousChefAIService.generateSingleRecipe(
              query,
              filters,
              pantryItems,
              0, // First recipe
              [] // No existing recipes yet
            );
            
            if (aiResult.success && aiResult.recipe) {
              // Format AI recipe
              const formattedRecipe = {
                id: aiResult.recipe.recipeID,
                uri: `souschef://recipe/${aiResult.recipe.recipeID}`,
                label: aiResult.recipe.recipeName,
                image: aiResult.recipe.recipeImage,
                source: 'SousChef AI',
                url: null,
                yield: aiResult.recipe.servings,
                dietLabels: aiResult.recipe.dietLabels || [],
                healthLabels: aiResult.recipe.healthLabels || [],
                cautions: aiResult.recipe.allergens || [],
                ingredientLines: aiResult.recipe.ingredients.map(ing => 
                  `${ing.quantity} ${ing.unit} ${ing.name}${ing.notes ? ` (${ing.notes})` : ''}`
                ),
                ingredients: aiResult.recipe.ingredients,
                calories: aiResult.recipe.calories,
                totalTime: aiResult.recipe.cookingTime,
                cuisineType: [aiResult.recipe.cuisineType],
                mealType: [aiResult.recipe.mealType],
                dishType: [aiResult.recipe.dishType],
                isCustom: true,
                recipeID: aiResult.recipe.recipeID,
                instructions: aiResult.recipe.instructions,
                difficulty: aiResult.recipe.difficulty
              };
              
              setRecipes([formattedRecipe]);
              setAiRecipeCount(1);
              setCanGenerateMore(true); // Enable "Generate Another"
              console.log(`✅ Generated 1 AI recipe (1/5)`);
              
              Alert.alert(
                '🤖 AI Recipe Created!',
                `No existing recipes found, so SousChef AI created a custom recipe just for you!${pantryItems.length > 0 ? '\n\n✨ Personalized with your pantry items!' : ''}\n\nWant more options? Tap "Generate Another" (up to 5 total).`,
                [{ text: 'Awesome!', style: 'default' }]
              );
            } else {
              console.error('❌ AI generation failed:', aiResult.error);
              Alert.alert(
                'No Recipes Found',
                'Sorry, we couldn\'t find or generate any recipes. Please try a different search term.',
                [{ text: 'OK' }]
              );
              setRecipes([]);
              setCanGenerateMore(false);
            }
          } catch (aiError) {
            console.error('❌ AI generation error:', aiError);
            Alert.alert(
              'Generation Failed',
              `Could not generate AI recipe: ${aiError.message}`,
              [{ text: 'OK' }]
            );
            setRecipes([]);
            setCanGenerateMore(false);
          } finally {
            setGeneratingAI(false);
          }
        }
      } else {
        // API error
        Alert.alert('Search Error', result.error || 'Failed to search recipes. Please try again.');
        setRecipes([]);
        setLoading(false);
      }
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('Error', 'Something went wrong while searching. Please try again.');
      setRecipes([]);
      setLoading(false);
      setGeneratingAI(false);
    }
  };

  const handleGenerateAnother = async () => {
    if (aiRecipeCount >= 5) {
      Alert.alert(
        'Limit Reached',
        'You\'ve reached the maximum of 5 AI-generated recipes per search. Try a new search for more recipes!',
        [{ text: 'OK' }]
      );
      return;
    }

    setGeneratingAI(true);

    try {
      console.log(`🤖 Generating another recipe (${aiRecipeCount + 1}/5)...`);

      // Get user's pantry items
      let pantryItems = [];
      if (user?.email) {
        pantryItems = await SousChefAIService.getUserPantryItems(user.email);
      }

      // Generate 1 more AI recipe (pass existing recipes for duplicate detection)
      const aiResult = await SousChefAIService.generateSingleRecipe(
        currentSearchQuery,
        filters,
        pantryItems,
        aiRecipeCount, // Pass current count
        recipes // Pass existing recipes to avoid duplicates
      );

      if (aiResult.success && aiResult.recipe) {
        // Format new recipe
        const formattedRecipe = {
          id: aiResult.recipe.recipeID,
          uri: `souschef://recipe/${aiResult.recipe.recipeID}`,
          label: aiResult.recipe.recipeName,
          image: aiResult.recipe.recipeImage,
          source: 'SousChef AI',
          url: null,
          yield: aiResult.recipe.servings,
          dietLabels: aiResult.recipe.dietLabels || [],
          healthLabels: aiResult.recipe.healthLabels || [],
          cautions: aiResult.recipe.allergens || [],
          ingredientLines: aiResult.recipe.ingredients.map(ing => 
            `${ing.quantity} ${ing.unit} ${ing.name}${ing.notes ? ` (${ing.notes})` : ''}`
          ),
          ingredients: aiResult.recipe.ingredients,
          calories: aiResult.recipe.calories,
          totalTime: aiResult.recipe.cookingTime,
          cuisineType: [aiResult.recipe.cuisineType],
          mealType: [aiResult.recipe.mealType],
          dishType: [aiResult.recipe.dishType],
          isCustom: true,
          recipeID: aiResult.recipe.recipeID,
          instructions: aiResult.recipe.instructions,
          difficulty: aiResult.recipe.difficulty
        };

        // Add to existing recipes
        setRecipes(prevRecipes => [...prevRecipes, formattedRecipe]);
        const newCount = aiRecipeCount + 1;
        setAiRecipeCount(newCount);
        
        // Disable button if reached 5
        if (newCount >= 5) {
          setCanGenerateMore(false);
        }

        console.log(`✅ Generated another recipe (${newCount}/5)`);

        Alert.alert(
          '✨ New Recipe Added!',
          `Recipe ${newCount} of 5 created!${newCount < 5 ? '\n\nWant more? Tap "Generate Another" again.' : '\n\nThat\'s the maximum! Try a new search for more recipes.'}`,
          [{ text: 'Nice!', style: 'default' }]
        );
      } else {
        console.error('❌ AI generation failed:', aiResult.error);
        Alert.alert(
          'Generation Failed',
          'Could not generate another recipe. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('❌ Generate another error:', error);
      Alert.alert(
        'Error',
        `Failed to generate recipe: ${error.message}`,
        [{ text: 'OK' }]
      );
    } finally {
      setGeneratingAI(false);
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

  // Quick search suggestions (static, no API call needed)
  const quickSearches = [
    { id: '1', icon: '🍕', label: 'Pizza', query: 'pizza' },
    { id: '2', icon: '🍝', label: 'Pasta', query: 'pasta' },
    { id: '3', icon: '🍔', label: 'Burger', query: 'burger' },
    { id: '4', icon: '🥗', label: 'Salad', query: 'salad' },
    { id: '5', icon: '🍛', label: 'Curry', query: 'curry' },
    { id: '6', icon: '🌮', label: 'Tacos', query: 'tacos' },
    { id: '7', icon: '🍜', label: 'Ramen', query: 'ramen' },
    { id: '8', icon: '🥘', label: 'Stew', query: 'stew' }
  ];

  return (
    <AuthGuard>
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
          <TouchableOpacity style={styles.filterButton} onPress={toggleFilters}>
            <Ionicons name="options-outline" size={20} color="#666" />
            {getFilterCount() > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{getFilterCount()}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.cameraButton}>
            <Ionicons name="camera-outline" size={20} color="#666" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Expandable Filter Section */}
      {showFilters && (
        <View style={styles.filterSection}>
          <View style={styles.filterHeader}>
            <Text style={styles.filterTitle}>Filters</Text>
            <TouchableOpacity onPress={toggleFilters}>
              <Text style={styles.clearFiltersText}>Show Less</Text>
            </TouchableOpacity>
          </View>
          <ScrollView 
            style={styles.filterScrollView}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.filterChipsContainer}>
              {healthLabels.map((label) => (
                <TouchableOpacity
                  key={label}
                  style={[
                    styles.filterChip,
                    selectedFilters.includes(label) && styles.filterChipActive
                  ]}
                  onPress={() => toggleFilter(label)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      selectedFilters.includes(label) && styles.filterChipTextActive
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

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

            {/* Generate Another Button */}
            {canGenerateMore && !generatingAI && (
              <TouchableOpacity 
                style={styles.generateAnotherButton}
                onPress={handleGenerateAnother}
                activeOpacity={0.7}
              >
                <View style={styles.generateAnotherContent}>
                  <Ionicons name="sparkles" size={24} color="#fff" />
                  <View style={styles.generateAnotherTextContainer}>
                    <Text style={styles.generateAnotherText}>
                      Generate Another Recipe
                    </Text>
                    <Text style={styles.generateAnotherSubtext}>
                      {aiRecipeCount}/5 AI recipes created
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={24} color="#fff" />
                </View>
              </TouchableOpacity>
            )}
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

        {/* AI Generation State */}
        {generatingAI && (
          <View style={styles.section}>
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#8A2BE2" />
              <Text style={styles.loadingText}>🤖 SousChef AI is creating custom recipes...</Text>
              <Text style={styles.loadingSubtext}>Generating images and cooking instructions</Text>
              <Text style={styles.loadingSubtext}>This may take 30-60 seconds</Text>
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
    </AuthGuard>
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
  filterBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  filterSection: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  clearFiltersText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
  },
  filterScrollView: {
    maxHeight: 200,
  },
  filterChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 8,
  },
  filterChipActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  filterChipText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#fff',
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
    fontWeight: '600',
  },
  loadingSubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
    fontStyle: 'italic',
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
  generateAnotherButton: {
    backgroundColor: '#8A2BE2',
    borderRadius: 12,
    marginTop: 20,
    marginBottom: 10,
    shadowColor: '#8A2BE2',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
    overflow: 'hidden',
  },
  generateAnotherContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
  },
  generateAnotherTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  generateAnotherText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  generateAnotherSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    marginTop: 2,
  },
});

export default RecipeSearch;
