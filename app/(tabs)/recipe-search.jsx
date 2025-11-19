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
  Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
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

const RecipeSearch = () => {
  const router = useRouter();
  const { user } = useCustomAuth();
  const params = useLocalSearchParams(); // Add this to receive params
  const [searchQuery, setSearchQuery] = useState('');
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [aiRecipeCount, setAiRecipeCount] = useState(0); // Track how many AI recipes generated
  const [canGenerateMore, setCanGenerateMore] = useState(false); // Show "Generate Another" button
  const [currentSearchQuery, setCurrentSearchQuery] = useState(''); // Store current search for "Generate Another"
  const [filters, setFilters] = useState({
    allergy: [],   // 14 allergen-free options (health labels)
    dietary: [],   // 13 lifestyle/restriction options (health labels)
    diet: []       // 6 nutritional profile options (diet labels)
  });
  const [showFilters, setShowFilters] = useState(false);

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
  const [hasSearched, setHasSearched] = useState(false);

  // Dynamic recent searches - track user search history
  const [recentSearches, setRecentSearches] = useState([]);

  // Popular recipes from API
  const [popularRecipes, setPopularRecipes] = useState([]);
  const [loadingPopular, setLoadingPopular] = useState(false);

  // Timeout refs for 7-second loading limits
  const searchTimeoutRef = useRef(null);
  const popularTimeoutRef = useRef(null);

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
      // Reset loading states if they're stuck
      const timer = setTimeout(() => {
        if (loading || generatingAI || loadingPopular) {
          console.log('⚠️ Resetting stuck loading states on focus');
          setLoading(false);
          setGeneratingAI(false);
          setLoadingPopular(false);
        }
      }, 1000); // Give 1 second for legitimate loading to complete

      return () => clearTimeout(timer);
    }, [loading, generatingAI, loadingPopular])
  );

  const loadPopularRecipesFromCache = async () => {
    setLoadingPopular(true);

    // Clear any existing popular timeout
    if (popularTimeoutRef.current) {
      clearTimeout(popularTimeoutRef.current);
    }

    // Set 7-second timeout to force stop loading
    popularTimeoutRef.current = setTimeout(() => {
      console.log('⏱️ Popular recipes timeout reached (7 seconds) - stopping loading state');
      setLoadingPopular(false);
    }, 7000);

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
        await handleRefreshPopularRecipes();
      }
    } catch (error) {
      // Clear timeout on error
      if (popularTimeoutRef.current) {
        clearTimeout(popularTimeoutRef.current);
        popularTimeoutRef.current = null;
      }

      console.error('❌ Error loading popular recipes from cache:', error);
      // Fallback: fetch fresh popular recipes
      await handleRefreshPopularRecipes();
    } finally {
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

  const handleSearch = async (query = searchQuery) => {
    if (!query.trim()) {
      Alert.alert('Search Required', 'Please enter a recipe name or ingredient to search for.');
      return;
    }

    // Proceed with search
    performSearch(query.trim());
  };

  const performSearch = async (query) => {
    // Add to recent searches
    addToRecentSearches(query);

    // Clear previous results to show loading screen
    setRecipes([]);
    setLoading(true);
    // ✅ DON'T set hasSearched yet - wait until we have results or confirmed no results
    setCanGenerateMore(false);
    setAiRecipeCount(0);

    // Clear any existing search timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set 7-second timeout to force stop loading
    searchTimeoutRef.current = setTimeout(() => {
      console.log('⏱️ Search timeout reached (7 seconds) - stopping loading state');
      setLoading(false);
      setGeneratingAI(false);
      if (recipes.length === 0) {
        setHasSearched(true);
      }
    }, 7000);

    try {
      console.log('='.repeat(60));
      console.log('🔍 SEARCH STARTED');
      console.log('🔍 Searching for recipes:', query);
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
      console.log('📞 Calling cache service with query:', query);

      const recipesResult = await cacheService.getSearchResults(query, searchOptions);
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
          // ✅ Show all recipes (AI + Edamam)
          setRecipes(allRecipes);
          setHasSearched(true); // ✅ Set hasSearched AFTER we have results

          // 🤖 If less than 5 recipes, enable "Generate More" button
          if (totalRecipes < 5) {
            setCanGenerateMore(true);
            const recipesNeeded = 5 - totalRecipes;
            console.log(`📊 Only ${totalRecipes} recipes found. User can generate ${recipesNeeded} more AI recipes.`);
          } else {
            setCanGenerateMore(false);
          }

          setAiRecipeCount(dbResult.count || 0);
          console.log(`✅ Displaying ${totalRecipes} total recipes (${dbResult.count} AI, ${result.data.recipes.length} Edamam)`);

          // Prefetch images to Supabase Storage for faster loading
          const imageUrls = allRecipes.map(r => r.image).filter(Boolean);
          if (imageUrls.length > 0) {
            recipeImageCacheService.batchCacheImages(imageUrls.slice(0, 10)); // Batch cache first 10
          }

          // Keep loading animation visible until recipes are fully rendered (5 seconds)
          setTimeout(() => {
            setLoading(false);
          }, 5000);
        } else {
          // ❌ No results anywhere - Generate 1 AI recipe
          console.log('ℹ️ No existing recipes found, generating 1 AI recipe...');
          // ✅ Transition from search loading to AI generation loading
          setTimeout(() => {
            setLoading(false); // Stop search loading after recipes render
          }, 5000);
          setGeneratingAI(true); // Start AI loading
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

              setRecipes([formattedRecipe]);
              setAiRecipeCount(1);
              setCanGenerateMore(true); // Enable "Generate Another"
              setHasSearched(true); // ✅ Set hasSearched AFTER AI recipe is created
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
              setHasSearched(true); // ✅ Set hasSearched even if AI fails
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
            setHasSearched(true); // ✅ Set hasSearched even if error occurs
          } finally {
            setGeneratingAI(false);
            setLoading(false);
          }
        }
      } else {
        // Clear timeout on error
        if (searchTimeoutRef.current) {
          clearTimeout(searchTimeoutRef.current);
          searchTimeoutRef.current = null;
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
        searchTimeoutRef.current = null;
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

  const handleGenerateAnother = async () => {
    const currentTotal = recipes.length;

    // Check if we've reached 5 total recipes
    if (currentTotal >= 5) {
      Alert.alert(
        'Limit Reached',
        'You have 5 recipes already! Try a new search for more options.',
        [{ text: 'OK' }]
      );
      return;
    }

    setGeneratingAI(true);

    try {
      const recipesNeeded = 5 - currentTotal;
      console.log(`🤖 Generating another recipe (Total: ${currentTotal}/5, Need: ${recipesNeeded} more)...`);

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

        Alert.alert(
          '✨ New Recipe Added!',
          `Now showing ${newTotal} recipes!${newTotal < 5 ? `\n\nWant ${5 - newTotal} more? Tap "Generate Another" again.` : '\n\nThat\'s 5 recipes! Try a new search for more.'}`,
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
              <Text style={styles.statLabel}>{item.totalTime || 'N/A'} min</Text>
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

  // NEW: Auto-search when coming from pantry
  useEffect(() => {
    if (params?.searchQuery && params?.autoSearch === 'true') {
      console.log('🔍 Auto-searching from pantry:', params.searchQuery);
      setSearchQuery(params.searchQuery);

      // Clear params and trigger search after a short delay
      setTimeout(() => {
        handleSearch(params.searchQuery);
        // Clear the params so it doesn't search again
        router.setParams({ searchQuery: undefined, autoSearch: undefined });
      }, 100);
    }
  }, [params?.searchQuery, params?.autoSearch]);

  // Handler for camera button - directly launch camera
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
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: hp('12%') }}
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

          {/* Loading State - Show when searching API/Database (but NOT when AI is generating) */}
          {loading && !generatingAI && (
            <View style={styles.section}>
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4CAF50" />
                <Text style={styles.loadingText}>Searching for recipes...</Text>
                <Text style={styles.loadingSubtext}>Checking Edamam API and database...</Text>
              </View>
            </View>
          )}

          {/* AI Generation State - Show when AI is creating recipes */}
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

          {/* No Results Message - Only show when search AND AI generation both fail */}
          {hasSearched && recipes.length === 0 && !loading && !generatingAI && (
            <View style={styles.section}>
              <View style={styles.emptyContainer}>
                <Ionicons name="alert-circle-outline" size={60} color="#ff6b6b" style={{ marginBottom: 15 }} />
                <Text style={styles.emptyText}>No Recipes Available</Text>
                <Text style={styles.emptySubtext}>No results found in Edamam or our AI database.</Text>
                <Text style={styles.emptySubtext}>AI generation also encountered an error.</Text>
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
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.popularRecipesContainer}>
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
        </ScrollView>

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
    marginLeft: wp('3%'),
  },
  generateAnotherText: {
    color: '#fff',
    fontSize: wp('4.5%'),
    fontWeight: '600',
  },
  generateAnotherSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: wp('3.2%'),
    marginTop: hp('0.2%'),
  },
});

export default RecipeSearch;
