import React, { useState, useEffect, useRef } from 'react';
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
  StatusBar,
  Platform,
  RefreshControl,
  Linking,
  Modal
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import cacheService from '../../services/supabase-cache-service';
import SousChefAIService from '../../services/souschef-ai-service';
import SpellCorrector from '../../utils/spell-corrector';
import recipeImageCacheService from '../../services/recipe-image-cache-service';
import CachedImage from '../../components/common/cached-image';
import AuthGuard from '../../components/auth-guard';
import { useCustomAuth } from '../../hooks/use-custom-auth';
import { useTabContext } from '../../contexts/tab-context';
import LoadingOverlay from '../../components/food-recognition/loading-overlay';
import AIRecipeSuccessModal from '../../components/food-recognition/ai-recipe-success-modal';
import GenerateAnotherSuccessModal from '../../components/food-recognition/generate-another-success-modal';
import LimitReachedModal from '../../components/food-recognition/limit-reached-modal';

const RecipeSearch = () => {
  const router = useRouter();
  const { user } = useCustomAuth();
  const { subscribe } = useTabContext();
  const params = useLocalSearchParams(); // Add this to receive params
  const scrollViewRef = useRef(null);
  const popularRecipesRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [aiRecipeCount, setAiRecipeCount] = useState(0); // Track how many AI recipes generated
  const [canGenerateMore, setCanGenerateMore] = useState(false); // Show "Generate Another" button
  const [currentSearchQuery, setCurrentSearchQuery] = useState(''); // Store current search for "Generate Another"
  const [showGenerateButton, setShowGenerateButton] = useState(false); // Show "Generate AI Recipe" button when no results
  const [isValidSearchTerm, setIsValidSearchTerm] = useState(false); // Track if search term is valid for AI generation
  const [aiSuccessModalVisible, setAiSuccessModalVisible] = useState(false);
  const [aiSuccessData, setAiSuccessData] = useState({ recipeName: '', pantryItemCount: 0 });
  const [generateAnotherModalVisible, setGenerateAnotherModalVisible] = useState(false);
  const [generateAnotherData, setGenerateAnotherData] = useState({ recipeName: '', pantryItemCount: 0, totalRecipes: 0, canGenerateMore: false });
  const [limitReachedModalVisible, setLimitReachedModalVisible] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0); // Progress for AI generation
  const [filters, setFilters] = useState({
    allergy: [],   // 14 allergen-free options (health labels)
    dietary: [],   // 13 lifestyle/restriction options (health labels)
    diet: []       // 6 nutritional profile options (diet labels)
  });
  const [showFilters, setShowFilters] = useState(false);

  // Suggestions Modal State
  const [suggestionsModalVisible, setSuggestionsModalVisible] = useState(false);
  const [recipeSuggestions, setRecipeSuggestions] = useState([]);
  const [currentPantryItems, setCurrentPantryItems] = useState([]);
  const [suggestionLoading, setSuggestionLoading] = useState(false);

  // Allergies (14 allergen-free options)
  const allergyLabels = [
    'celery-free',
    'crustacean-free',
    'dairy-free',
    'egg-free',
    'fish-free',
    'gluten-free',
    'lupine-free',
    'mustard-free',
    'peanut-free',
    'sesame-free',
    'shellfish-free',
    'soy-free',
    'tree-nut-free',
    'wheat-free'
  ];

  // Dietary Preferences (14 lifestyle/restriction options) - these are Edamam HEALTH labels
  const dietaryLabels = [
    'alcohol-free',
    'keto-friendly',
    'kidney-friendly',
    'kosher',
    'low-potassium',
    'no-oil-added',
    'sugar-conscious',
    'paleo',
    'pescatarian',
    'pork-free',
    'red-meat-free',
    'vegan',
    'vegetarian'
  ];

  // Diets (6 Edamam diet labels)
  const dietLabels = [
    'balanced',
    'high-fiber',
    'high-protein',
    'low-carb',
    'low-fat',
    'low-sodium'
  ];

  // Custom Loading Phrases
  const SEARCH_PHRASES = [
    "Scouring the recipe books...",
    "Asking the chefs...",
    "Looking for tasty matches...",
    "Checking the pantry...",
    "Finding the perfect dish..."
  ];

  const GENERATION_PHRASES = [
    "SousChef AI is thinking...",
    "Inventing a new recipe...",
    "Calculating flavor profiles...",
    "Writing the instructions...",
    "Plating your custom dish..."
  ];
  const [hasSearched, setHasSearched] = useState(false);

  // Dynamic recent searches - track user search history
  const [recentSearches, setRecentSearches] = useState([]);

  // Popular recipes from API
  const [popularRecipes, setPopularRecipes] = useState([]);
  const [loadingPopular, setLoadingPopular] = useState(false);

  // Timeout refs for 7-second loading limits
  const searchTimeoutRef = useRef(null);
  const popularTimeoutRef = useRef(null);

  // Handle tab press events (scroll to top and reset horizontal scrolls)
  useEffect(() => {
    const unsubscribe = subscribe((event) => {
      if (event.type === 'tabPress' && event.isAlreadyActive && event.route.includes('recipe-search')) {
        // Scroll vertical list to top
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollTo({ y: 0, animated: true });
        }

        // Reset horizontal scroll views
        if (popularRecipesRef.current) {
          popularRecipesRef.current.scrollTo({ x: 0, animated: true });
        }
      }
    });
    return unsubscribe;
  }, [subscribe]);

  useEffect(() => {
    // Load popular recipes on component mount using cache service
    loadPopularRecipesFromCache();
    // Load recent searches from AsyncStorage
    loadRecentSearches();

    // Cleanup function to reset loading states when component unmounts
    return () => {
      setLoading(false);
      setGeneratingAI(false);
      setLoadingPopular(false);

      // Clear any active timeouts
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (popularTimeoutRef.current) {
        clearTimeout(popularTimeoutRef.current);
      }
    };
  }, []);

  // Reset loading states when screen comes into focus (after long periods)
  useFocusEffect(
    React.useCallback(() => {
      // Determine timeout duration based on what's loading
      // AI generation takes longer (up to 2 mins), regular search is faster
      const timeoutDuration = generatingAI ? 120000 : 15000;

      // Reset loading states if they're stuck
      const timer = setTimeout(() => {
        if (loading || generatingAI || loadingPopular) {
          console.log(`⚠️ Resetting stuck loading states on focus (${timeoutDuration / 1000}s timeout)`);
          console.log('🔴 Loading overlay FINISHED (Focus Timeout)');
          setLoading(false);
          setGeneratingAI(false);
          setLoadingPopular(false);
        }
      }, timeoutDuration);

      return () => clearTimeout(timer);
    }, [loading, generatingAI, loadingPopular])
  );

  const loadPopularRecipesFromCache = async () => {
    setLoadingPopular(true);

    // Clear any existing popular timeout
    if (popularTimeoutRef.current) {
      clearTimeout(popularTimeoutRef.current);
    }

    // Set 10-second timeout to force stop loading (increased from 7 to allow API fetch time)
    popularTimeoutRef.current = setTimeout(() => {
      console.log('⏱️ Popular recipes timeout reached (10 seconds) - stopping loading state');
      setLoadingPopular(false);
    }, 10000);

    try {
      console.log('📱 Loading popular recipes from Supabase cache...');

      // Get cached recipes from Supabase (auto-fetches from API if cache is empty/expired)
      const cached = await cacheService.getPopularRecipes();

      // Clear timeout since we got results
      if (popularTimeoutRef.current) {
        clearTimeout(popularTimeoutRef.current);
        popularTimeoutRef.current = null;
      }

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
        // Keep loading state - don't call finally yet
        await handleRefreshPopularRecipes();
        return; // Exit here to prevent double finally
      }
    } catch (error) {
      // Clear timeout on error
      if (popularTimeoutRef.current) {
        clearTimeout(popularTimeoutRef.current);
        popularTimeoutRef.current = null;
      }

      console.error('❌ Error loading popular recipes from cache:', error);
      // Fallback: fetch fresh popular recipes - keep loading state
      await handleRefreshPopularRecipes();
      return; // Exit here to prevent double finally
    } finally {
      // Only set loading to false if we didn't call handleRefreshPopularRecipes
      setLoadingPopular(false);
    }
  };

  const handleViewAllPopularRecipes = () => {
    router.push('/popular-recipes');
  };

  const loadRecentSearches = async () => {
    try {
      const stored = await AsyncStorage.getItem('recentSearches');
      if (stored) {
        const searches = JSON.parse(stored);
        setRecentSearches(searches);
        console.log('📜 Loaded recent searches:', searches);
      }
    } catch (error) {
      console.error('Error loading recent searches:', error);
    }
  };

  // Pull to refresh handler - refreshes popular recipes
  const onRefresh = async () => {
    setRefreshing(true);
    console.log('🔄 Pull to refresh initiated - refreshing popular recipes...');
    try {
      await handleRefreshPopularRecipes();
    } catch (error) {
      console.error('❌ Error during refresh:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Handle refresh popular recipes from cache service
  const handleRefreshPopularRecipes = async () => {
    // Clear any existing popular timeout
    if (popularTimeoutRef.current) {
      clearTimeout(popularTimeoutRef.current);
    }

    // Set 10-second timeout to force stop loading (for API fetch)
    popularTimeoutRef.current = setTimeout(() => {
      console.log('⏱️ Popular recipes refresh timeout reached (10 seconds)');
      setLoadingPopular(false);
    }, 10000);

    try {
      console.log('🔄 Refreshing popular recipes from Supabase...');
      setLoadingPopular(true);

      // Force refresh from cache service (it will fetch fresh data from API)
      const cached = await cacheService.getPopularRecipes(true); // Pass true to force refresh

      // Clear timeout since we got results
      if (popularTimeoutRef.current) {
        clearTimeout(popularTimeoutRef.current);
        popularTimeoutRef.current = null;
      }

      if (cached && cached.length > 0) {
        console.log(`✅ Refreshed ${cached.length} popular recipes`);
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
      }
    } catch (error) {
      // Clear timeout on error
      if (popularTimeoutRef.current) {
        clearTimeout(popularTimeoutRef.current);
        popularTimeoutRef.current = null;
      }
      console.error('❌ Error refreshing popular recipes:', error);
    } finally {
      setLoadingPopular(false);
    }
  };

  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  const toggleAllergyFilter = (label) => {
    setFilters(prev => {
      const allergy = prev.allergy || [];
      if (allergy.includes(label)) {
        return { ...prev, allergy: allergy.filter(a => a !== label) };
      } else {
        return { ...prev, allergy: [...allergy, label] };
      }
    });
  };

  const toggleDietaryFilter = (label) => {
    setFilters(prev => {
      const dietary = prev.dietary || [];
      if (dietary.includes(label)) {
        return { ...prev, dietary: dietary.filter(d => d !== label) };
      } else {
        return { ...prev, dietary: [...dietary, label] };
      }
    });
  };

  const toggleDietFilter = (label) => {
    setFilters(prev => {
      const diet = prev.diet || [];
      if (diet.includes(label)) {
        return { ...prev, diet: diet.filter(d => d !== label) };
      } else {
        return { ...prev, diet: [...diet, label] };
      }
    });
  };

  const clearAllFilters = () => {
    setFilters({
      allergy: [],
      dietary: [],
      diet: []
    });
  };

  const getFilterCount = () => {
    return (filters.allergy?.length || 0) + (filters.dietary?.length || 0) + (filters.diet?.length || 0);
  };

  const addToRecentSearches = async (query) => {
    if (!query.trim()) return;

    try {
      setRecentSearches(prev => {
        // Remove if already exists to avoid duplicates
        const filtered = prev.filter(search => search.toLowerCase() !== query.toLowerCase());
        // Add to beginning and limit to 5 items
        const updated = [query, ...filtered].slice(0, 5);

        // Save to AsyncStorage
        AsyncStorage.setItem('recentSearches', JSON.stringify(updated))
          .catch(err => console.error('Error saving recent searches:', err));

        return updated;
      });
    } catch (error) {
      console.error('Error adding to recent searches:', error);
    }
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

  const removeRecentSearch = async (index) => {
    try {
      setRecentSearches(prev => {
        const updated = prev.filter((_, i) => i !== index);
        // Save to AsyncStorage
        AsyncStorage.setItem('recentSearches', JSON.stringify(updated))
          .catch(err => console.error('Error saving recent searches:', err));
        return updated;
      });
    } catch (error) {
      console.error('Error removing recent search:', error);
    }
  };

  const clearAllRecentSearches = async () => {
    try {
      setRecentSearches([]);
      // Clear from AsyncStorage
      await AsyncStorage.removeItem('recentSearches');
      console.log('🗑️ Cleared all recent searches');
    } catch (error) {
      console.error('Error clearing recent searches:', error);
    }
  };


  const handleGenerateAnother = async () => {
    const currentTotal = recipes.length;

    // Check if we've reached 5 total recipes
    if (currentTotal >= 5) {
      setLimitReachedModalVisible(true);
      return;
    }

    // ✅ Show loading during generation
    setLoading(true);
    setGeneratingAI(true);

    // ✅ CRITICAL: Clear search timeout so it doesn't stop loading during AI generation
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
      console.log('🔄 Cleared search timeout - AI generation in progress');
    }

    // Verify currentSearchQuery is set
    if (!currentSearchQuery || currentSearchQuery.trim() === '') {
      console.error('⚠️ ERROR: currentSearchQuery is empty!', { currentSearchQuery });
      Alert.alert('Error', 'Search query is missing. Please try searching again.');
      setLoading(false);
      setGeneratingAI(false);
      return;
    }

    console.log(`🎯 Generating with search query: "${currentSearchQuery}"`);

    try {
      const recipesNeeded = 5 - currentTotal;
      console.log(`🤖 Generating another recipe based on search "${currentSearchQuery}" (Total: ${currentTotal}/5, Need: ${recipesNeeded} more)...`);

      // Get user's pantry items
      let pantryItems = [];
      if (user?.email) {
        pantryItems = await SousChefAIService.getUserPantryItems(user.email);
        console.log(`📦 Using ${pantryItems.length} pantry items for recipe generation`);
      }

      // ✅ Generate recipe based on BOTH search query AND pantry items
      console.log(`🔍 Generating recipe with search: "${currentSearchQuery}", pantry: ${pantryItems.length} items`);

      // Generate 1 more AI recipe (pass existing recipes for duplicate detection)
      const aiResult = await SousChefAIService.generateSingleRecipe(
        currentSearchQuery, // ✅ Use current search query
        filters,
        pantryItems, // ✅ Use user's pantry items
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
          // ✅ Nutrition values (per serving from AI)
          calories: Math.round(aiResult.recipe.calories || 0),
          protein: Math.round(aiResult.recipe.protein || 0),
          carbs: Math.round(aiResult.recipe.carbs || 0),
          fat: Math.round(aiResult.recipe.fat || 0),
          totalTime: aiResult.recipe.cookingTime,
          cuisineType: [aiResult.recipe.cuisineType],
          mealType: [aiResult.recipe.mealType],
          dishType: [aiResult.recipe.dishType],
          isCustom: true,
          recipeID: aiResult.recipe.recipeID,
          instructions: aiResult.recipe.instructions,
          difficulty: aiResult.recipe.difficulty
        };

        // Add to existing recipes (check for duplicates first)
        setRecipes(prevRecipes => {
          // Check if recipe already exists by recipeID or URI
          const exists = prevRecipes.some(r =>
            (r.recipeID && r.recipeID === formattedRecipe.recipeID) ||
            (r.uri && r.uri === formattedRecipe.uri)
          );

          if (exists) {
            console.log('⚠️ Recipe already exists, not adding duplicate');
            return prevRecipes;
          }

          return [...prevRecipes, formattedRecipe];
        });

        const newAiCount = aiRecipeCount + 1;
        setAiRecipeCount(newAiCount);

        const newTotal = currentTotal + 1;

        // Disable button if reached 5 total recipes
        if (newTotal >= 5) {
          setCanGenerateMore(false);
        }


        console.log(`✅ Generated another recipe (Total: ${newTotal}/5, AI: ${newAiCount})`);

        // ✅ Stop loading ONLY after recipe is successfully added
        // Add artificial delay to ensure UI renders before overlay disappears
        setTimeout(() => {
          setGeneratingAI(false);
          setLoading(false);
          console.log('✅ Generate Another complete - recipe rendered');

          // Show modal instead of alert
          setGenerateAnotherData({
            recipeName: currentSearchQuery,
            pantryItemCount: pantryItems.length,
            totalRecipes: newTotal,
            canGenerateMore: newTotal < 5
          });
          setGenerateAnotherModalVisible(true);
        }, 2500);
      } else {
        console.error('❌ AI generation failed:', aiResult.error);

        // ✅ Stop loading on failure
        setGeneratingAI(false);
      }
    } catch (error) {
      console.error('❌ Generate another error:', error);

      // ✅ Stop loading on error
      setGeneratingAI(false);
      setLoading(false);
      console.log('❌ Generate Another error occurred');

      Alert.alert(
        'Error',
        `Failed to generate recipe: ${error.message}`,
        [{ text: 'OK' }]
      );
    }
  };

  const handleGenerateFirstAIRecipe = async (queryOverride = null, generationMode = null) => {
    const queryToUse = typeof queryOverride === 'string' ? queryOverride : currentSearchQuery;

    if (!queryToUse || (!isValidSearchTerm && !queryOverride)) {
      Alert.alert('Error', 'Invalid search term. Please try a different search.');
      return;
    }

    setGeneratingAI(true);
    setLoadingProgress(10);
    setShowGenerateButton(false);

    // Clear search timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }

    try {
      // 1. Start Background Search (Parallel)
      const healthLabels = [...(filters.allergy || []), ...(filters.dietary || [])];
      const searchOptions = { from: 0, to: 20 };
      if (healthLabels.length > 0) searchOptions.health = healthLabels;
      if (filters.diet?.length > 0) searchOptions.diet = filters.diet;

      const searchPromise = cacheService.getSearchResults(queryToUse, searchOptions)
        .catch(err => {
          console.warn('⚠️ Background search failed:', err);
          return [];
        });

      // 2. Fetch Pantry Items
      let pantryItems = [];
      if (generationMode !== 'selected-only' && user?.email) {
        pantryItems = await SousChefAIService.getUserPantryItems(user.email);
      }
      setCurrentPantryItems(pantryItems);

      // 3. Generate Suggestions
      setLoadingProgress(30);
      console.log(`🤖 Generating suggestions for "${queryToUse}"...`);
      
      const [suggestionsResult, searchResults] = await Promise.all([
        SousChefAIService.generateRecipeSuggestions(queryToUse, filters, pantryItems),
        searchPromise
      ]);

      const validSearchResults = Array.isArray(searchResults) ? searchResults : [];

      if (suggestionsResult.success && suggestionsResult.suggestions.length > 0) {
        setRecipeSuggestions(suggestionsResult.suggestions);
        setSuggestionsModalVisible(true);
        setGeneratingAI(false);
        setLoading(false);
      } else {
        // Fallback: Generate single recipe directly if suggestions failed
        console.log('⚠️ Suggestions failed, falling back to direct generation');
        await generateSpecificRecipe(queryToUse, pantryItems, validSearchResults);
      }

    } catch (error) {
      console.error('❌ Error in generation flow:', error);
      setGeneratingAI(false);
      setLoading(false);
      Alert.alert('Error', 'Failed to generate recipe suggestions.');
    }
  };

  const generateSpecificRecipe = async (recipeName, pantryItems, existingSearchResults = []) => {
    setGeneratingAI(true);
    setLoading(true);
    setLoadingProgress(50);
    setSuggestionsModalVisible(false); // Close modal if open

    try {
      console.log(`🤖 Generating specific recipe: "${recipeName}"`);

      const aiResult = await SousChefAIService.generateSingleRecipe(
        recipeName,
        filters,
        pantryItems,
        0,
        []
      );

      if (aiResult.success && aiResult.recipe) {
        setLoadingProgress(100);
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
          calories: Math.round(aiResult.recipe.calories || 0),
          protein: Math.round(aiResult.recipe.protein || 0),
          carbs: Math.round(aiResult.recipe.carbs || 0),
          fat: Math.round(aiResult.recipe.fat || 0),
          totalTime: aiResult.recipe.cookingTime,
          cuisineType: [aiResult.recipe.cuisineType],
          mealType: [aiResult.recipe.mealType],
          dishType: [aiResult.recipe.dishType],
          isCustom: true,
          recipeID: aiResult.recipe.recipeID,
          instructions: aiResult.recipe.instructions,
          difficulty: aiResult.recipe.difficulty
        };

        // Combine AI recipe with search results (AI first)
        const uniqueSearchResults = existingSearchResults.filter(r =>
          r.label.toLowerCase() !== formattedRecipe.label.toLowerCase()
        );

        setRecipes([formattedRecipe, ...uniqueSearchResults]);
        setAiRecipeCount(1);
        setCanGenerateMore(true);
        setHasSearched(true);

        setTimeout(() => {
          setGeneratingAI(false);
          setLoading(false);
          setAiSuccessData({
            recipeName: aiResult.recipe.recipeName,
            pantryItemCount: pantryItems.length
          });
          setAiSuccessModalVisible(true);
        }, 2500);
      } else {
        throw new Error(aiResult.error || 'Generation failed');
      }
    } catch (error) {
      console.error('❌ Error generating specific recipe:', error);
      setGeneratingAI(false);
      setLoading(false);
      Alert.alert('Error', `Failed to generate recipe: ${error.message}`);
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
    setShowGenerateButton(false);
    setIsValidSearchTerm(false);
    setCanGenerateMore(false);
  };

  const renderRecipeCard = ({ item }) => {
    const isAI = item.isCustom || item.source === 'SousChef AI';

    return (
      <TouchableOpacity style={styles.recipeCard} onPress={() => handleRecipePress(item)}>
        <View style={styles.recipeImageContainer}>
          {item.image ? (
            <CachedImage
              uri={item.image}
              style={styles.recipeImage}
              resizeMode="cover"
              fallbackIcon={<Ionicons name="image-outline" size={50} color="#ccc" />}
            />
          ) : (
            <View style={[styles.recipeImage, { backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="image-outline" size={50} color="#ccc" />
            </View>
          )}

          {/* AI Badge */}
          {isAI && (
            <View style={styles.aiBadge}>
              <Ionicons name="sparkles" size={12} color="#fff" />
              <Text style={styles.aiBadgeText}>SousChef AI</Text>
            </View>
          )}
        </View>

        <View style={styles.recipeInfo}>
          <Text style={styles.recipeTitle} numberOfLines={2}>{item.label}</Text>
          <Text style={styles.recipeSource}>by {item.source}</Text>

          <View style={styles.recipeStats}>
            <View style={styles.statItem}>
              <Ionicons name="time-outline" size={wp('4%')} color="#7f8c8d" style={styles.statIcon} />
              <Text style={styles.statLabel}>{item.totalTime || 30} min</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="flame-outline" size={wp('4%')} color="#7f8c8d" style={styles.statIcon} />
              <Text style={styles.statLabel}>{Math.round(item.calories || 0)} kcal</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="people-outline" size={wp('4%')} color="#7f8c8d" style={styles.statIcon} />
              <Text style={styles.statLabel}>{item.yield} servings</Text>
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
  };

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

  // NEW: Auto-search when coming from pantry or deconstruction
  useEffect(() => {
    if (params?.searchQuery && (params?.autoSearch === 'true' || params?.autoGenerate === 'true')) {
      console.log('🔍 Auto-trigger:', params.searchQuery, 'Generate:', params.autoGenerate);
      setSearchQuery(params.searchQuery);
      setCurrentSearchQuery(params.searchQuery); // Ensure this is set for AI generation

      const isGenerate = params.autoGenerate === 'true' || params.mode === 'generate';
      const generationMode = params.generationMode;

      // If generating, show loading immediately
      if (isGenerate) {
        setGeneratingAI(true);
      }

      // Clear params and trigger search after a short delay
      setTimeout(() => {
        if (isGenerate) {
          console.log('🤖 Triggering AI generation for:', params.searchQuery);
          setIsValidSearchTerm(true); // Assume valid if coming from deconstruction/pantry
          handleGenerateFirstAIRecipe(params.searchQuery, generationMode);
        } else if (params.isDeconstructed === 'true') {
          console.log('🧩 Triggering deconstructed search for:', params.searchQuery);
          handleDeconstructedSearch(params.searchQuery);
        } else {
          handleSearch(params.searchQuery);
        }

        // Clear the params so it doesn't search again
        router.setParams({ searchQuery: undefined, autoSearch: undefined, autoGenerate: undefined, isDeconstructed: undefined, originalDish: undefined, mode: undefined, generationMode: undefined });
      }, 500);
    }
  }, [params?.searchQuery, params?.autoSearch, params?.autoGenerate]);  // Handler for camera button - directly launch camera
  const handleCameraCapture = async () => {
    try {
      // Request camera permission
      const { status } = await ImagePicker.requestCameraPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow camera access to use food recognition.'
        );
        return;
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      // If photo was taken, navigate to result screen
      if (!result.canceled && result.assets[0]) {
        router.push({
          pathname: '/food-recognition/result',
          params: { uri: result.assets[0].uri },
        });
      }
    } catch (error) {
      console.error('Camera capture error:', error);
      Alert.alert('Error', 'Failed to open camera. Please try again.');
    }
  };

  const handleDeconstructedSearch = async (query) => {
    const ingredients = query.split(',').map(i => i.trim());
    console.log('🔍 Deconstructed search for:', ingredients);

    setLoading(true);
    setRecipes([]);
    setHasSearched(false);

    try {
      const allFoundRecipes = [];
      const seenUris = new Set();
      
      // Rate limiting configuration (10 requests per minute)
      const MAX_RPM = 10;
      const WINDOW_MS = 60000; // 1 minute
      const requestTimestamps = []; // Track request times

      // Process ingredients sequentially to respect rate limits
      for (let i = 0; i < ingredients.length; i++) {
        const ingredient = ingredients[i];
        
        // Check rate limit
        const now = Date.now();
        // Filter out timestamps older than 1 minute
        while (requestTimestamps.length > 0 && requestTimestamps[0] < now - WINDOW_MS) {
          requestTimestamps.shift();
        }

        if (requestTimestamps.length >= MAX_RPM) {
          // Rate limit reached - wait until the oldest request expires
          const oldestRequest = requestTimestamps[0];
          const waitTime = (oldestRequest + WINDOW_MS) - now + 1000; // Add 1s buffer
          
          console.log(`⏳ Rate limit reached (${MAX_RPM} RPM). Waiting ${Math.ceil(waitTime/1000)}s...`);
          
          // Show a toast or update loading text if possible (optional)
          // For now, just wait
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        // Proceed with search
        try {
          console.log(`🔎 Searching for ingredient ${i+1}/${ingredients.length}: ${ingredient}`);
          requestTimestamps.push(Date.now()); // Record timestamp
          
          const results = await cacheService.getSearchResults(ingredient, { to: 5 });
          
          if (Array.isArray(results)) {
            allFoundRecipes.push(...results);
          }
        } catch (e) {
          console.warn(`Failed to search for ${ingredient}:`, e);
        }
      }

      const uniqueRecipes = [];

      for (const recipe of allFoundRecipes) {
        if (recipe && recipe.uri && !seenUris.has(recipe.uri)) {
          seenUris.add(recipe.uri);
          uniqueRecipes.push(recipe);
        }
      }

      setRecipes(uniqueRecipes);
      setHasSearched(true);

    } catch (error) {
      console.error("Error in deconstructed search:", error);
      Alert.alert("Error", "Failed to search for ingredients.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query = searchQuery) => {
    if (!query.trim()) {
      Alert.alert('Search Required', 'Please enter a recipe name or ingredient to search for.');
      return;
    }

    // Proceed with search
    performSearch(query.trim());
  };

  const performSearch = async (query) => {
    // Replace underscores with spaces
    const cleanedQuery = query.replace(/_/g, ' ');

    // Add to recent searches (use cleaned query)
    addToRecentSearches(cleanedQuery);

    // ✅ CRITICAL: Save search query IMMEDIATELY for "Generate Another" button
    setCurrentSearchQuery(cleanedQuery);
    console.log(`🎯 Search query saved for AI generation: "${cleanedQuery}"`);

    // Clear previous results to show loading screen
    setRecipes([]);
    setLoading(true);
    console.log('🟢 Loading overlay STARTED');
    setShowGenerateButton(false); // ✅ Reset generate button state
    setIsValidSearchTerm(false); // ✅ Reset validation state
    // ✅ DON'T set hasSearched yet - wait until we have results or confirmed no results
    setCanGenerateMore(false);
    setAiRecipeCount(0);

    // Clear any existing search timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set 30-second timeout to allow for AI generation (usually takes 18+ seconds)
    searchTimeoutRef.current = setTimeout(() => {
      if (!generatingAI) {
        console.log('⏱️ Search timeout reached (30 seconds) - stopping loading state');
        setLoading(false);
        if (recipes.length === 0) {
          setHasSearched(true);
        }
      } else {
        console.log('⏳ Still generating AI recipe, keeping loading active...');
      }
    }, 30000); // 30 seconds to allow for AI recipe generation

    try {
      console.log('='.repeat(60));
      console.log('🔍 SEARCH STARTED');
      console.log('🔍 Searching for recipes:', cleanedQuery);
      console.log('📋 Applied filters:', filters);
      console.log('🔑 API Keys loaded:', {
        edamamId: process.env.EXPO_PUBLIC_EDAMAM_APP_ID,
        edamamKey: process.env.EXPO_PUBLIC_EDAMAM_APP_KEY?.substring(0, 10) + '...'
      });

      // Build complete search options with filters
      // Edamam API requires separate parameters:
      // - health: for allergies AND dietary preferences (both are health labels in Edamam)
      // - diet: for nutritional profiles (diet labels in Edamam)
      const healthLabels = [
        ...(filters.allergy || []),
        ...(filters.dietary || [])
      ];

      console.log('🏥 Health labels to send:', healthLabels);
      console.log('🥗 Diet labels to send:', filters.diet);

      const searchOptions = {
        from: 0,
        to: 20
      };

      // Only add filter parameters if they have values
      if (healthLabels.length > 0) {
        searchOptions.health = healthLabels;
      }
      if (filters.diet?.length > 0) {
        searchOptions.diet = filters.diet;
      }

      console.log('🔧 Search options sent to API:', searchOptions);
      console.log('🔗 Full search params:', JSON.stringify(searchOptions, null, 2));

      // Use Supabase cache service (automatically handles caching and API calls)
      // Note: Cache service returns recipes array directly, not wrapped in an object
      console.log('📞 Calling cache service with query:', cleanedQuery);

      const recipesResult = await cacheService.getSearchResults(cleanedQuery, searchOptions);
      console.log('📦 Cache service raw result type:', Array.isArray(recipesResult) ? 'Array' : typeof recipesResult);
      console.log('📦 Cache service returned:', recipesResult?.length || 0, 'recipes');
      console.log('📦 First recipe:', recipesResult?.[0]?.label || 'No recipes');

      // Cache service returns array directly, not { success, data }
      const recipes = Array.isArray(recipesResult) ? recipesResult : [];
      const result = { success: true, data: { recipes } };
      console.log('✅ Final result:', { success: result.success, recipeCount: result.data.recipes.length });

      if (result.success) {
        // ✅ ALWAYS check database for AI recipes (even if Edamam found results)
        console.log('🔍 Checking database for AI-generated recipes...');

        let dbResult = { found: false, recipes: [], count: 0 };
        try {
          // ✅ Check if SousChefAIService and checkExistingRecipes exist
          if (SousChefAIService && typeof SousChefAIService.checkExistingRecipes === 'function') {
            // Check database for existing AI recipes
            dbResult = await SousChefAIService.checkExistingRecipes(query, filters);
            console.log('✅ Database check completed:', dbResult);
          } else {
            console.warn('⚠️ SousChefAIService.checkExistingRecipes is not available');
          }
        } catch (dbError) {
          console.error('❌ Error checking existing recipes:', dbError);
          console.error('Error details:', dbError.message);
        }

        let allRecipes = []; // Start empty for proper ordering

        if (dbResult.found && dbResult.recipes.length > 0) {
          console.log(`✅ Found ${dbResult.count} AI recipes in database`);

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
            ingredientLines: recipe.ingredients?.map(ing =>
              `${ing.quantity || ''} ${ing.unit || ''} ${ing.name}${ing.notes ? ` (${ing.notes})` : ''}`
            ) || [],
            ingredients: recipe.ingredients || [],
            // ✅ Nutrition values (already per serving from database)
            calories: Math.round(recipe.calories || 0),
            protein: Math.round(recipe.protein || 0),
            carbs: Math.round(recipe.carbs || 0),
            fat: Math.round(recipe.fat || 0),
            totalTime: recipe.cookingTime,
            cuisineType: [recipe.cuisineType],
            mealType: [recipe.mealType],
            dishType: [recipe.dishType],
            isCustom: true,
            recipeID: recipe.recipeID,
            instructions: recipe.instructions,
            difficulty: recipe.difficulty
          }));

          // ✅ Merge: AI recipes FIRST, then Edamam recipes (remove duplicates)
          const combined = [...formattedDbRecipes, ...result.data.recipes];

          // Remove duplicates based on recipeID or URI
          const seenIds = new Set();

          combined.forEach(recipe => {
            const recipeId = recipe.recipeID || recipe.uri;
            if (recipeId && !seenIds.has(recipeId)) {
              seenIds.add(recipeId);
              allRecipes.push(recipe);
            }
          });

          console.log(`🍽️ Total unique recipes: ${allRecipes.length} (AI: ${formattedDbRecipes.length}, Edamam: ${result.data.recipes.length}, Duplicates removed: ${combined.length - allRecipes.length})`);
        } else {
          // No AI recipes found, just show Edamam results
          allRecipes = [...result.data.recipes];
        }

        const totalRecipes = allRecipes.length;

        if (totalRecipes > 0) {
          // ✅ If ONLY AI recipes from cache (no Edamam results), validate search term
          if (result.data.recipes.length === 0 && dbResult.count > 0) {
            console.log(`⚠️ Only cached AI recipes found. Validating if "${query}" is still a valid search term...`);

            // Keep loading visible during validation
            try {
              const validationResult = await SousChefAIService.validateFoodIngredient(query);

              if (!validationResult.isValid) {
                // Search term is gibberish - don't show cached results
                console.log(`❌ "${query}" is not valid: ${validationResult.reason}`);
                console.log(`🗑️ Hiding ${totalRecipes} cached AI recipes for invalid search term`);

                // Stop loading and show "No Recipes Available" message
                setLoading(false);
                setRecipes([]);
                setShowGenerateButton(false);
                setIsValidSearchTerm(false);
                setCanGenerateMore(false);
                setHasSearched(true);

                // No alert needed - "No Recipes Available" message is sufficient
                return; // Exit early - don't show cached results
              }

              console.log(`✅ "${query}" is valid - showing cached AI recipes`);
            } catch (validationError) {
              console.error('⚠️ Validation check failed, showing cached results anyway:', validationError);
              // If validation fails technically, show cached results (fail-safe)
            }
          }

          // ✅ Show all recipes (AI + Edamam)
          setRecipes(allRecipes);
          setHasSearched(true); // ✅ Set hasSearched AFTER we have results

          // 🤖 Only show "Generate More" button if NO Edamam results and total < 5
          const hasEdamamResults = result.data.recipes.length > 0;

          if (!hasEdamamResults && totalRecipes < 5) {
            // Only AI recipes from cache, and less than 5 total
            setCanGenerateMore(true);
            setShowGenerateButton(true);
            setIsValidSearchTerm(true);
            const recipesNeeded = 5 - totalRecipes;
            console.log(`📊 Only ${totalRecipes} AI recipes (no Edamam). User can generate ${recipesNeeded} more.`);
          } else {
            // Either has Edamam results OR already 5+ recipes
            setCanGenerateMore(false);
            setShowGenerateButton(false);
            if (hasEdamamResults) {
              console.log(`✅ Found ${result.data.recipes.length} Edamam recipes - no AI generation needed`);
            }
          }

          setAiRecipeCount(dbResult.count || 0);
          console.log(`✅ Displaying ${totalRecipes} total recipes (${dbResult.count} AI, ${result.data.recipes.length} Edamam)`);

          // Prefetch images to Supabase Storage with recipe associations
          const imagesToCache = allRecipes
            .filter(r => r.image)
            .slice(0, 10)
            .map(r => ({
              url: r.image,
              recipeId: r.recipeID || r.uri, // AI recipes have recipeID, Edamam have uri
              recipeName: r.recipeName || r.label
            }));

          if (imagesToCache.length > 0) {
            // ✅ Wait for images to be cached before showing results
            await recipeImageCacheService.batchCacheImages(imagesToCache);
          }

          // ✅ Keep loading animation visible until recipes are ready (prevents false "No Recipes" screen)
          // Wait for images to start loading and UI to render
          console.log('🔴 Loading overlay FINISHED');
          setLoading(false);
          console.log('✅ Search complete - recipes rendered');
        } else {
          // ❌ No results anywhere - Validate search term and show Generate button
          console.log(`ℹ️ No existing recipes found for "${query}"`);

          // ✅ Validate if search term is food-related using AI
          console.log(`🔍 Validating if "${query}" is a valid food ingredient...`);
          // Keep loading visible during validation

          try {
            // Quick AI validation check
            const validationResult = await SousChefAIService.validateFoodIngredient(query);

            if (!validationResult.isValid) {
              // Search term is gibberish or not food-related
              console.log(`❌ "${query}" is not a valid food ingredient: ${validationResult.reason}`);
              setLoading(false);
              setRecipes([]);
              setShowGenerateButton(false);
              setIsValidSearchTerm(false);
              setCanGenerateMore(false);
              setHasSearched(true);

              // No alert - "No Recipes Available" message is sufficient
              // User will see the validation reason in console if needed
              console.log(`💡 Suggestion: Try searching for food ingredients, dishes, or cuisines`);
              return; // Exit early
            }

            console.log(`✅ "${query}" is valid: ${validationResult.reason}`);

            // ✅ Search term is valid - Show Generate AI Recipe button
            setLoading(false);
            setRecipes([]);
            setShowGenerateButton(true);
            setIsValidSearchTerm(true);
            setHasSearched(true);
            console.log(`💡 Showing "Generate AI Recipe" button for "${query}"`);
            return; // Exit - wait for user to click Generate button

          } catch (validationError) {
            console.error('⚠️ Validation check failed:', validationError);
            // If validation fails, show button anyway (fail-safe)
            setLoading(false);
            setRecipes([]);
            setShowGenerateButton(true);
            setIsValidSearchTerm(true);
            setHasSearched(true);
            return;
          }
        }
      } else {
        // Clear timeout on error
        if (searchTimeoutRef.current) {
          clearTimeout(searchTimeoutRef.current);
        }

        // API error
        Alert.alert('Search Error', result.error || 'Failed to search recipes. Please try again.');
        setRecipes([]);
        setTimeout(() => {
          setLoading(false);
        }, 5000);
        setHasSearched(true); // ✅ Set hasSearched even on API error
      }
    } catch (error) {
      // Clear timeout on exception
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      console.error('='.repeat(60));
      console.error('❌ SEARCH ERROR - Full details:');
      console.error('❌ Error message:', error.message);
      console.error('❌ Error type:', error.name);
      console.error('❌ Error stack:', error.stack);
      console.error('='.repeat(60));
      Alert.alert('Error', 'Something went wrong while searching. Please try again.');
      setRecipes([]);
      setTimeout(() => {
        setLoading(false);
      }, 5000);
      setGeneratingAI(false);
      setHasSearched(true); // ✅ Set hasSearched even on exception
    }
  };



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
                <Ionicons name="arrow-back" size={wp('5%')} color="#666" />
              </TouchableOpacity>
            )}
            <Ionicons name="search-outline" size={wp('5%')} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={() => handleSearch()}
              returnKeyType="search"
            />
            <TouchableOpacity style={styles.filterButton} onPress={toggleFilters}>
              <Ionicons name="options-outline" size={wp('5%')} color="#666" />
              {getFilterCount() > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{getFilterCount()}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cameraButton}
              onPress={handleCameraCapture}
            >
              <Ionicons name="camera-outline" size={wp('5%')} color="#666" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Expandable Filter Section */}
        {showFilters && (
          <View style={styles.filterSection}>
            <View style={styles.filterHeader}>
              <Text style={styles.filterTitle}>Filters ({getFilterCount()})</Text>
              <View style={styles.filterHeaderActions}>
                {getFilterCount() > 0 && (
                  <TouchableOpacity onPress={clearAllFilters} style={styles.clearButton}>
                    <Text style={styles.clearFiltersText}>Clear All</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={toggleFilters}>
                  <Text style={styles.clearFiltersText}>Hide</Text>
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView
              style={styles.filterScrollView}
              showsVerticalScrollIndicator={false}
            >
              {/* Allergy Filters */}
              <View style={styles.filterCategory}>
                <Text style={styles.filterCategoryTitle}>Allergies (Allergen-Free)</Text>
                <View style={styles.filterChipsContainer}>
                  {allergyLabels.map((label) => (
                    <TouchableOpacity
                      key={label}
                      style={[
                        styles.filterChip,
                        filters.allergy?.includes(label) && styles.filterChipActive
                      ]}
                      onPress={() => toggleAllergyFilter(label)}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          filters.allergy?.includes(label) && styles.filterChipTextActive
                        ]}
                      >
                        {label.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Dietary Preference Filters */}
              <View style={styles.filterCategory}>
                <Text style={styles.filterCategoryTitle}>Dietary Preferences</Text>
                <View style={styles.filterChipsContainer}>
                  {dietaryLabels.map((label) => (
                    <TouchableOpacity
                      key={label}
                      style={[
                        styles.filterChip,
                        filters.dietary?.includes(label) && styles.filterChipActive
                      ]}
                      onPress={() => toggleDietaryFilter(label)}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          filters.dietary?.includes(label) && styles.filterChipTextActive
                        ]}
                      >
                        {label.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Nutritional Profile Filters */}
              <View style={styles.filterCategory}>
                <Text style={styles.filterCategoryTitle}>Nutritional Profiles</Text>
                <View style={styles.filterChipsContainer}>
                  {dietLabels.map((label) => (
                    <TouchableOpacity
                      key={label}
                      style={[
                        styles.filterChip,
                        filters.diet?.includes(label) && styles.filterChipActive
                      ]}
                      onPress={() => toggleDietFilter(label)}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          filters.diet?.includes(label) && styles.filterChipTextActive
                        ]}
                      >
                        {label.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>
          </View>
        )}

        <ScrollView
          ref={scrollViewRef}
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: hp('12%') }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#81A969']}
              tintColor="#81A969"
              title="Pull to refresh"
              titleColor="#999"
            />
          }
        >
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

          {/* Loading State - Handled by Modal Overlay */}


          {/* Generate AI Recipe Button - Show when no results found but search term is valid */}
          {showGenerateButton && !generatingAI && recipes.length === 0 && (
            <View style={styles.section}>
              <View style={styles.noResultsContainer}>
                <Ionicons name="search-outline" size={60} color="#8A2BE2" style={{ marginBottom: 15 }} />
                <Text style={styles.noResultsTitle}>No Recipes Found</Text>
                <Text style={styles.noResultsSubtext}>
                  No existing recipes for "{currentSearchQuery}" in Edamam or our database.
                </Text>
                <Text style={[styles.noResultsSubtext, { marginTop: 10, fontWeight: '600', color: '#8A2BE2' }]}>
                  ✨ But don't worry! Our AI can create one for you!
                </Text>

                <TouchableOpacity
                  style={styles.generateAIButton}
                  onPress={handleGenerateFirstAIRecipe}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#8A2BE2', '#9D4EDD', '#C77DFF']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.generateAIButtonGradient}
                  >
                    <Ionicons name="sparkles" size={28} color="#fff" style={{ marginRight: 12 }} />
                    <View style={styles.generateAIButtonTextContainer}>
                      <Text style={styles.generateAIButtonText}>Generate AI Recipe</Text>
                      <Text style={styles.generateAIButtonSubtext}>
                        Create a custom recipe for {currentSearchQuery}
                      </Text>
                    </View>
                    <Ionicons name="arrow-forward" size={24} color="#fff" />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* No Results Message - Only show when search term is invalid */}
          {hasSearched && recipes.length === 0 && !loading && !generatingAI && !showGenerateButton && (
            <View style={styles.section}>
              <View style={styles.emptyContainer}>
                <Ionicons name="alert-circle-outline" size={60} color="#ff6b6b" style={{ marginBottom: 15 }} />
                <Text style={styles.emptyText}>No Recipes Available</Text>
                <Text style={styles.emptySubtext}>No results found in Edamam or our AI database.</Text>
                <Text style={[styles.emptySubtext, { marginTop: 10, color: '#4CAF50' }]}>
                  💡 Try a different search term or check your spelling
                </Text>
              </View>
            </View>
          )}

          {/* Recent Searches - Show only when not searching AND not loading */}
          {!hasSearched && !loading && !generatingAI && recentSearches.length > 0 && (
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

          {/* Popular Recipes - Show only when not searching AND not loading */}
          {!hasSearched && !loading && !generatingAI && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Popular Recipes</Text>
                <TouchableOpacity
                  onPress={handleViewAllPopularRecipes}
                >
                  <Text style={styles.viewAllText}>
                    View All
                  </Text>
                </TouchableOpacity>
              </View>

              {loadingPopular ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#81A969" />
                  <Text style={styles.loadingText}>
                    {popularRecipes.length > 0 ? 'Refreshing recipes...' : 'Loading popular recipes...'}
                  </Text>
                </View>
              ) : (
                <ScrollView
                  ref={popularRecipesRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.popularRecipesContainer}
                >
                  {popularRecipes.map((recipe, index) => (
                    <TouchableOpacity
                      key={recipe.id}
                      style={[styles.popularRecipeCard, index === 0 && styles.firstCard]}
                      onPress={() => handlePopularRecipePress(recipe)}
                    >
                      <View style={styles.popularRecipeImageContainer}>
                        {recipe.image ? (
                          <Image
                            source={{ uri: recipe.image }}
                            style={styles.popularRecipeImage}
                            onError={(error) => console.log('Popular recipe image load error:', recipe.title, error.nativeEvent?.error)}
                          />
                        ) : (
                          <View style={[styles.popularRecipeImage, { backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' }]}>
                            <Ionicons name="image-outline" size={20} color="#ccc" />
                          </View>
                        )}
                      </View>
                      <View style={styles.popularRecipeContent}>
                        <Text style={styles.popularRecipeTitle} numberOfLines={2}>{recipe.title}</Text>
                        <View style={styles.popularRecipeInfo}>
                          <Ionicons name="time-outline" size={wp('3%')} color="#666" />
                          <Text style={styles.popularInfoText}>
                            {recipe.time || 30} Min
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {/* Edamam Attribution */}
          <View style={styles.attributionContainer}>
            <TouchableOpacity onPress={() => Linking.openURL('http://www.edamam.com')}>
              <Image
                source={{ uri: 'https://developer.edamam.com/images/transparent.png' }}
                style={styles.edamamLogo}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Loading Overlay Modal */}
        <LoadingOverlay
          key={generatingAI ? 'generate' : 'search'}
          visible={loading || generatingAI}
          phrases={generatingAI ? GENERATION_PHRASES : SEARCH_PHRASES}
          mode={generatingAI ? 'generate' : 'search'}
          themeColor={generatingAI ? '#8A2BE2' : '#81A969'}
          progress={loadingProgress}
        />

        {/* AI Recipe Success Modal */}
        <AIRecipeSuccessModal
          visible={aiSuccessModalVisible}
          onClose={() => setAiSuccessModalVisible(false)}
          recipeName={aiSuccessData.recipeName}
          pantryItemCount={aiSuccessData.pantryItemCount}
        />

        {/* Generate Another Success Modal */}
        <GenerateAnotherSuccessModal
          visible={generateAnotherModalVisible}
          onClose={() => setGenerateAnotherModalVisible(false)}
          recipeName={generateAnotherData.recipeName}
          pantryItemCount={generateAnotherData.pantryItemCount}
          totalRecipes={generateAnotherData.totalRecipes}
          canGenerateMore={generateAnotherData.canGenerateMore}
        />

        {/* Limit Reached Modal */}
        <LimitReachedModal
          visible={limitReachedModalVisible}
          onClose={() => setLimitReachedModalVisible(false)}
        />

        {/* Recipe Suggestions Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={suggestionsModalVisible}
          onRequestClose={() => setSuggestionsModalVisible(false)}
        >
          <View style={styles.centeredView}>
            <View style={styles.modalView}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Choose a Recipe</Text>
                <TouchableOpacity onPress={() => setSuggestionsModalVisible(false)} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color="#999" />
                </TouchableOpacity>
              </View>
              
              <Text style={styles.modalSubtitle}>
                SousChef AI came up with these ideas for "{currentSearchQuery}":
              </Text>

              <ScrollView style={styles.suggestionsList} contentContainerStyle={{paddingBottom: 20}}>
                {recipeSuggestions.map((suggestion, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.suggestionButton}
                    onPress={() => generateSpecificRecipe(suggestion, currentPantryItems, recipes)}
                  >
                    <View style={styles.suggestionContent}>
                        <Text style={styles.suggestionText}>{suggestion}</Text>
                        <Ionicons name="arrow-forward-circle" size={24} color="#81A969" />
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </AuthGuard>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  searchHeader: {
    paddingHorizontal: wp('5%'),
    paddingTop: hp('2%'),
    paddingBottom: hp('2%'),
    backgroundColor: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: wp('6.2%'),
    paddingHorizontal: wp('3.8%'),
    height: hp('6.5%'),
  },
  searchIcon: {
    marginRight: wp('2.5%'),
  },
  backButton: {
    padding: wp('1.2%'),
    marginRight: wp('1.2%'),
  },
  searchInput: {
    flex: 1,
    fontSize: wp('4%'),
    color: '#333',
  },
  filterButton: {
    padding: wp('1.2%'),
    marginLeft: wp('2.5%'),
  },
  cameraButton: {
    padding: wp('1.2%'),
    marginLeft: wp('1.2%'),
  },
  filterBadge: {
    position: 'absolute',
    top: wp('-1.2%'),
    right: wp('-1.2%'),
    backgroundColor: '#81A969',
    borderRadius: wp('2.5%'),
    minWidth: wp('4.5%'),
    height: wp('4.5%'),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: wp('1%'),
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: wp('2.5%'),
    fontWeight: 'bold',
  },
  filterSection: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('1.8%'),
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp('1.8%'),
  },
  filterTitle: {
    fontSize: wp('4.5%'),
    fontWeight: '600',
    color: '#000000ff',
  },
  filterHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp('3.8%'),
  },
  clearButton: {
    paddingRight: wp('2.5%'),
  },
  clearFiltersText: {
    fontSize: wp('3.5%'),
    color: '#81A969',
    fontWeight: '500',
  },
  filterScrollView: {
    maxHeight: hp('37.5%'),
  },
  filterCategory: {
    marginBottom: hp('2.5%'),
  },
  filterCategoryTitle: {
    fontSize: wp('3.5%'),
    fontWeight: '600',
    color: '#666',
    marginBottom: hp('1.2%'),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: wp('2.5%'),
  },
  filterChip: {
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1%'),
    borderRadius: wp('5%'),
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: hp('1%'),
  },
  filterChipActive: {
    backgroundColor: '#81A969',
    borderColor: '#81A969',
  },
  filterChipText: {
    fontSize: wp('3.5%'),
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
    paddingHorizontal: wp('5%'),
    marginBottom: hp('3.8%'),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp('1.8%'),
  },
  sectionTitle: {
    fontSize: wp('5%'),
    fontWeight: '600',
    color: '#000000ff',
  },
  clearText: {
    fontSize: wp('4%'),
    color: '#81A969',
    fontWeight: '500',
  },
  viewAllText: {
    fontSize: wp('4%'),
    color: '#81A969',
    fontWeight: '500',
  },
  resultsCount: {
    fontSize: wp('3.5%'),
    color: '#666',
    fontWeight: '400',
  },
  recipeCard: {
    backgroundColor: '#fff',
    borderRadius: wp('4%'),
    marginBottom: hp('2.5%'),
    marginHorizontal: wp('1.5%'),
    marginTop: hp('0.5%'),
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  recipeImageContainer: {
    margin: wp('3%'),
    borderRadius: wp('3%'),
    overflow: 'hidden',
    height: hp('25%'),
    position: 'relative',
  },
  recipeImage: {
    width: '100%',
    height: '100%',
  },
  aiBadge: {
    position: 'absolute',
    top: wp('2%'),
    right: wp('2%'),
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(138, 43, 226, 0.9)',
    paddingHorizontal: wp('2.5%'),
    paddingVertical: hp('0.8%'),
    borderRadius: wp('5%'),
    gap: wp('1%'),
    zIndex: 1,
  },
  aiBadgeText: {
    color: '#fff',
    fontSize: wp('2.8%'),
    fontWeight: '600',
  },
  recipeInfo: {
    padding: wp('3.8%'),
  },
  recipeTitle: {
    fontSize: wp('4.5%'),
    fontWeight: 'bold',
    color: '#000000ff',
    marginBottom: hp('0.6%'),
  },
  recipeSource: {
    fontSize: wp('3.5%'),
    color: '#7f8c8d',
    marginBottom: hp('1.2%'),
  },
  recipeStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: hp('1.2%'),
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIcon: {
    marginRight: wp('1%'),
  },
  statLabel: {
    fontSize: wp('3%'),
    color: '#7f8c8d',
  },
  labelsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: hp('0.6%'),
  },
  dietLabel: {
    backgroundColor: '#80a9694b',
    paddingHorizontal: wp('2%'),
    paddingVertical: hp('0.5%'),
    borderRadius: wp('3%'),
    marginRight: wp('1.2%'),
    marginBottom: hp('0.6%'),
  },
  healthLabel: {
    backgroundColor: '#80a969a1',
    paddingHorizontal: wp('2%'),
    paddingVertical: hp('0.5%'),
    borderRadius: wp('3%'),
    marginRight: wp('1.2%'),
    marginBottom: hp('0.6%'),
  },
  labelText: {
    fontSize: wp('2.5%'),
    color: '#000000ff',
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: hp('6.2%'),
  },
  emptyText: {
    fontSize: wp('4.5%'),
    color: '#7f8c8d',
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: wp('3.5%'),
    color: '#bdc3c7',
    marginTop: hp('0.6%'),
    textAlign: 'center',
  },
  recentSearchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp('1.5%'),
    borderBottomWidth: 0.5,
    borderBottomColor: '#f0f0f0',
  },
  recentSearchIcon: {
    marginRight: wp('3.8%'),
  },
  recentSearchText: {
    flex: 1,
    fontSize: wp('4%'),
    color: '#333',
  },
  removeButton: {
    padding: wp('1.2%'),
  },
  popularRecipesContainer: {
    marginLeft: wp('-5%'),
    paddingBottom: hp('2%'),
  },
  popularRecipeCard: {
    backgroundColor: '#fff',
    width: wp('32%'),
    borderRadius: wp('4%'),
    marginLeft: wp('3%'),
    marginTop: hp('2%'),
    marginBottom: hp('1.5%'),
    elevation: 6,
  },
  firstCard: {
    marginLeft: wp('5%'),
  },
  popularRecipeImageContainer: {
    overflow: 'hidden',
    position: 'relative',
    margin: wp('2%'),
    borderRadius: wp('3%'),
  },
  popularRecipeImage: {
    width: '100%',
    height: hp('12%'),
    resizeMode: 'cover',
  },
  popularRecipeContent: {
    paddingHorizontal: wp('2.5%'),
    paddingBottom: wp('2.5%'),
    paddingTop: 0,
  },
  popularRecipeTitle: {
    fontSize: wp('3.2%'),
    fontWeight: 'bold',
    color: '#000',
    marginBottom: hp('0.8%'),
    lineHeight: wp('4%'),
  },
  popularRecipeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp('1%'),
  },
  popularInfoText: {
    fontSize: wp('2.5%'),
    color: '#666',
  },
  disabledText: {
    opacity: 0.5,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: hp('3.8%'),
  },
  loadingText: {
    fontSize: wp('3.5%'),
    color: '#666',
    marginTop: hp('1.2%'),
    fontWeight: '600',
  },
  loadingSubtext: {
    fontSize: wp('3%'),
    color: '#999',
    marginTop: hp('0.6%'),
    fontStyle: 'italic',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: hp('1%'),
    paddingHorizontal: wp('2.5%'),
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
    fontSize: wp('3%'),
    color: '#666',
    marginTop: hp('0.5%'),
    fontWeight: '500',
  },
  activeNavLabel: {
    color: '#81A969',
  },
  centerNavButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: wp('2.5%'),
  },
  centerNavIcon: {
    width: wp('12.5%'),
    height: wp('12.5%'),
    borderRadius: wp('6.25%'),
    backgroundColor: '#81A969',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
  },
  generateAnotherButton: {
    backgroundColor: '#8A2BE2',
    borderRadius: wp('3%'),
    marginTop: hp('2.5%'),
    marginBottom: hp('1.2%'),
    elevation: 8,
    overflow: 'hidden',
  },
  generateAnotherContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: wp('4.5%'),
  },
  generateAnotherTextContainer: {
    flex: 1,
  },
  generateAnotherText: {
    fontSize: wp('4%'),
    color: '#fff',
    fontWeight: '600',
  },
  generateAnotherSubtext: {
    fontSize: wp('3%'),
    color: '#fff',
    fontWeight: '400',
  },
  generateAIButton: {
    backgroundColor: '#8A2BE2',
    borderRadius: wp('3%'),
    marginTop: hp('1.5%'),
    elevation: 8,
    overflow: 'hidden',
  },
  generateAIButtonGradient: {
    paddingVertical: hp('1.5%'),
    paddingHorizontal: wp('4%'),
    borderRadius: wp('3%'),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateAIButtonTextContainer: {
    flex: 1,
  },
  generateAIButtonText: {
    fontSize: wp('4.2%'),
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
  generateAIButtonSubtext: {
    fontSize: wp('3.2%'),
    color: '#fff',
    fontWeight: '400',
    textAlign: 'center',
  },
  attributionContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('2%'),
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  edamamLogo: {
    width: wp('45%'),
    height: hp('3%'),
  },
  // New styles for Recipe Suggestions Modal
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalView: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  suggestionsList: {
    width: '100%',
  },
  suggestionButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  suggestionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  suggestionText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    flex: 1,
    marginRight: 10,
  },
});

export default RecipeSearch;
