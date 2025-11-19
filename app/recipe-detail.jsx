import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Animated
} from 'react-native';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useRouter, useLocalSearchParams } from 'expo-router';
import cacheService from '../services/supabase-cache-service';
import EdamamService from '../services/edamam-service';
import RecipeMatcherService from '../services/recipe-matcher-service';
import PantryService from '../services/pantry-service';
import recipeImageCacheService from '../services/recipe-image-cache-service';
import { useCustomAuth } from '../hooks/use-custom-auth';
import AuthGuard from '../components/auth-guard';

// Import new components
import RecipeHero from '../components/recipe-detail/recipe-hero';
import RecipeInfo from '../components/recipe-detail/recipe-info';
import NutritionGrid from '../components/recipe-detail/nutrition-grid';
import IngredientsTab from '../components/recipe-detail/ingredients-tab';
import InstructionsTab from '../components/recipe-detail/instructions-tab';
import SimilarRecipes from '../components/recipe-detail/similar-recipes';
import FloatingPlayButton from '../components/recipe-detail/floating-play-button';
import ScheduleRecipeModal from '../components/recipe-detail/schedule-recipe-modal';
import { useIngredientSubstitution } from '../hooks/use-ingredient-substitution';
import IngredientSubstitutionModal from '../components/substitution/ingredient-substitution-modal';

const RecipeDetail = () => {
  const router = useRouter();
  const { recipeData } = useLocalSearchParams();
  const { user, customUserData } = useCustomAuth();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fillAnim = useRef(new Animated.Value(0)).current;
  const toastAnim = useRef(new Animated.Value(0)).current;
  const backButtonScaleAnim = useRef(new Animated.Value(1)).current;
  const saveTimeoutRef = useRef(null);
  const pendingFavoriteState = useRef(null);

  const [recipe, setRecipe] = useState(null);
  const [similarRecipes, setSimilarRecipes] = useState([]);
  const [instructions, setInstructions] = useState([]);
  const [instructionsSource, setInstructionsSource] = useState(''); // 'scraped', 'fallback', or ''
  const [loading, setLoading] = useState(true);
  const [loadingInstructions, setLoadingInstructions] = useState(false);
  const [preloadingInstructions, setPreloadingInstructions] = useState(false);
  const [activeTab, setActiveTab] = useState('ingredients');
  const [isFavorite, setIsFavorite] = useState(false);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [savingFavorite, setSavingFavorite] = useState(false);
  const [displayRecipe, setDisplayRecipe] = useState(null); // Recipe to display (may have substitutions)
  const [showSubstitutionModal, setShowSubstitutionModal] = useState(false);
  const [substitutionMode, setSubstitutionMode] = useState('manual'); // 'manual' or 'auto'
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [toastQueue, setToastQueue] = useState([]);
  const toastIdCounter = useRef(0);

  // Use the substitution hook
  const {
    missingIngredients,
    availableIngredients,
    insufficientIngredients, // NEW
    modifiedRecipe,
    showUsePantryIngredientsAlert,
    showMissingIngredientsAlert,
    applySubstitutions,
    showIngredientUsageConfirmation,
    hasMissingIngredients,
    hasAvailableIngredients,
    hasSubstitutions,
  } = useIngredientSubstitution(displayRecipe || recipe, customUserData?.userID);

  // Update display recipe when modifications are applied
  useEffect(() => {
    if (modifiedRecipe) {
      setDisplayRecipe(modifiedRecipe);
    } else if (recipe && !displayRecipe) {
      setDisplayRecipe(recipe);
    }
  }, [modifiedRecipe, recipe]);

  // Debug user state on component mount and when it changes
  useEffect(() => {
    console.log('👤 RecipeDetail - User state changed:', {
      hasUser: !!user,
      email: user?.email,
      id: user?.id
    });
  }, [user]);

  // Cleanup timeout on unmount - trigger save if pending
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        // Trigger the save immediately before unmounting
        if (pendingFavoriteState.current !== null && user?.email && recipe) {
          saveFavoriteToDatabase(pendingFavoriteState.current);
        }
      }
    };
  }, [user, recipe]);

  useEffect(() => {
    if (recipeData) {
      try {
        const parsedRecipe = JSON.parse(recipeData);
        setRecipe(parsedRecipe);
        setLoading(false);

        // Prefetch image to Supabase Storage if available
        if (parsedRecipe.image) {
          recipeImageCacheService.getCachedImageUrl(parsedRecipe.image);
        }

        // Fetch similar recipes
        fetchSimilarRecipes(parsedRecipe);

        // Handle instructions based on recipe source
        const isAIRecipe = parsedRecipe.isCustom || parsedRecipe.source === 'SousChef AI' || !parsedRecipe.url;

        if (isAIRecipe && parsedRecipe.instructions) {
          // AI-generated recipes have instructions stored directly
          console.log('🤖 Loading AI recipe instructions:', parsedRecipe.instructions.length, 'steps');

          // Check if instructions are objects with 'instruction' property or plain strings
          const formattedInstructions = Array.isArray(parsedRecipe.instructions)
            ? parsedRecipe.instructions.map(step =>
              typeof step === 'string' ? step : step.instruction
            )
            : [];

          setInstructions(formattedInstructions);
          setInstructionsSource('ai');
          console.log('✅ AI recipe instructions loaded:', formattedInstructions.length, 'steps');
        } else if (parsedRecipe?.url) {
          // Edamam recipes need to fetch instructions from URL
          console.log('🔗 Preloading Edamam recipe instructions from URL');
          preloadInstructions(parsedRecipe.url);
        }
      } catch (error) {
        console.error('Error parsing recipe data:', error);
        setLoading(false);
      }
    }
  }, [recipeData]);

  // Check if recipe is saved and track view when user or recipe changes
  useEffect(() => {
    if (recipe && user?.email) {
      console.log('👀 Recipe and user ready, checking favorite status and tracking view');
      checkIfSaved(recipe);
      RecipeMatcherService.trackRecipeView(user.email, recipe);
    }
  }, [recipe, user]);

  const checkIfSaved = async (currentRecipe) => {
    if (!user?.email) {
      console.log('⏳ No user email, skipping favorite check');
      return;
    }

    try {
      console.log('🔍 Checking if recipe is saved:', {
        isCustom: currentRecipe.isCustom,
        recipeID: currentRecipe.recipeID,
        uri: currentRecipe.uri,
        source: currentRecipe.source
      });

      const savedRecipes = await RecipeMatcherService.getSavedRecipes(user.email);
      console.log('📚 Total saved recipes:', savedRecipes.length);

      // Check if this recipe is in saved recipes
      const isAIRecipe = currentRecipe.isCustom || currentRecipe.source === 'SousChef AI';

      const isSaved = savedRecipes.some(saved => {
        if (isAIRecipe) {
          // For AI recipes, compare aiRecipeID
          const match = saved.aiRecipeID === currentRecipe.recipeID;
          console.log('🤖 AI recipe check:', {
            savedAiRecipeID: saved.aiRecipeID,
            currentRecipeID: currentRecipe.recipeID,
            match
          });
          return match;
        } else {
          // For Edamam recipes, compare URI
          const match = saved.edamamRecipeURI === currentRecipe.uri;
          console.log('🔗 Edamam recipe check:', {
            savedURI: saved.edamamRecipeURI,
            currentURI: currentRecipe.uri,
            match
          });
          return match;
        }
      });

      console.log(isSaved ? '❤️ Recipe is already favorited' : '🤍 Recipe is not favorited');
      setIsFavorite(isSaved);
    } catch (error) {
      console.error('❌ Error checking if saved:', error);
    }
  };

  const fetchSimilarRecipes = async (currentRecipe) => {
    setLoadingSimilar(true);
    try {
      // Handle both Edamam (label) and AI (recipeName) recipe structures
      const recipeTitle = currentRecipe.label || currentRecipe.recipeName || 'Unknown Recipe';
      console.log('🎯 Starting SMART similar recipe search for:', recipeTitle);
      console.log('📋 Recipe data:', {
        dishType: currentRecipe.dishType,
        cuisineType: currentRecipe.cuisineType,
        mealType: currentRecipe.mealType,
        ingredients: currentRecipe.ingredientLines?.length || 0
      });

      // Use Supabase cache service for similar recipes (automatically cached)
      console.log('🔍 Calling cacheService.getSimilarRecipes...');
      const similarRecipesData = await cacheService.getSimilarRecipes(currentRecipe, 12);
      console.log('📦 Received similar recipes data:', similarRecipesData?.length || 0, 'recipes');

      const result = { success: true, data: { recipes: similarRecipesData || [] } };

      console.log('📊 SMART similar recipes result:', result);

      if (result.success && result.data.recipes.length > 0) {
        // Filter out the current recipe from similar recipes to avoid duplicates
        const currentRecipeId = currentRecipe.uri || currentRecipe.recipeID;
        const filteredRecipes = result.data.recipes.filter(r => {
          const similarRecipeId = r.uri || r.recipeID;
          return similarRecipeId !== currentRecipeId;
        });

        setSimilarRecipes(filteredRecipes);
        console.log(`✅ Successfully set ${filteredRecipes.length} similar recipes (filtered from ${result.data.recipes.length})`);

        if (result.data.analysis) {
          console.log('🧬 Recipe analysis:', result.data.analysis);
        }

        if (result.data.cached) {
          console.log('💾 Similar recipes loaded from cache');
        } else {
          console.log(`🔍 Similar recipes found using ${result.data.strategiesUsed} search strategies`);
        }
      } else {
        console.log('❌ No similar recipes found');
        setSimilarRecipes([]);
      }
    } catch (error) {
      console.error('💥 Error in fetchSimilarRecipes:', error);
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
      setSimilarRecipes([]);
    } finally {
      console.log('✅ Setting loadingSimilar to false');
      setLoadingSimilar(false);
    }
  };

  const fetchInstructions = async (recipeUrl) => {
    setLoadingInstructions(true);
    try {
      // Use Supabase cache service with full web scraping fallback
      const result = await cacheService.getRecipeInstructions(
        recipeUrl,
        EdamamService.getRecipeInstructions.bind(EdamamService)
      );

      if (result.success) {
        setInstructions(result.instructions);

        // Determine source type for UI feedback
        if (result.cached) {
          setInstructionsSource('cached');
        } else if (result.fallback) {
          setInstructionsSource('fallback');
        } else {
          setInstructionsSource('scraped');
        }
      } else {
        setInstructions(['Instructions not available. Please visit the original recipe link.']);
        setInstructionsSource('error');
      }
    } catch (error) {
      console.error('Error fetching instructions:', error);
      setInstructions(['Failed to load instructions. Please visit the original recipe link.']);
      setInstructionsSource('error');
    } finally {
      setLoadingInstructions(false);
    }
  };

  const preloadInstructions = async (recipeUrl) => {
    setPreloadingInstructions(true);
    try {
      // Quietly preload instructions in background using Supabase cache
      const result = await cacheService.getRecipeInstructions(
        recipeUrl,
        EdamamService.getRecipeInstructions.bind(EdamamService)
      );

      if (result.success) {
        // Store preloaded instructions
        setInstructions(result.instructions);

        if (result.cached) {
          setInstructionsSource('cached');
        } else if (result.fallback) {
          setInstructionsSource('fallback');
        } else {
          setInstructionsSource('scraped');
        }
      }
    } catch (error) {
      console.log('Preload failed, will fetch when needed:', error.message);
    } finally {
      setPreloadingInstructions(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'instructions' && recipe?.url) {
      // If instructions are already preloaded, don't fetch again
      if (instructions.length === 0) {
        fetchInstructions(recipe.url);
      }
    }
  };

  const handleBackPress = () => {
    backButtonScaleAnim.setValue(1);
    Animated.spring(backButtonScaleAnim, {
      toValue: 1,
      friction: 2,
      tension: 200,
      velocity: 3,
      useNativeDriver: true,
    }).start();
    // Navigate immediately while animation plays
    setTimeout(() => router.back(), 0);
  };

  const showToastMessage = (message, isAdded) => {
    // Quickly fade out existing toasts when new toggle happens
    toastQueue.forEach(toast => {
      Animated.timing(toast.opacity, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }).start();
    });

    const toastId = toastIdCounter.current++;
    const newToast = {
      id: toastId,
      message,
      isAdded,
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(100),
    };

    setToastQueue(prev => [...prev, newToast]);

    // Animate in
    Animated.parallel([
      Animated.timing(newToast.opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(newToast.translateY, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto remove after delay
    setTimeout(() => {
      Animated.timing(newToast.opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setToastQueue(prev => prev.filter(t => t.id !== toastId));
      });
    }, 1500);
  };

  const saveFavoriteToDatabase = async (shouldBeFavorite) => {
    if (!user?.email) return;

    console.log('🔍 Toggle favorite - User state:', {
      hasUser: !!user,
      email: user?.email,
      userObject: user
    });
    console.log('✅ User authenticated, proceeding with save');
    setSavingFavorite(true);

    try {
      if (shouldBeFavorite) {
        // Save recipe
        console.log('💾 Saving recipe to favorites...');
        console.log('📧 User email:', user.email);
        console.log('📖 Recipe:', { label: recipe.label, uri: recipe.uri });

        const result = await RecipeMatcherService.saveRecipe(
          user.email,
          recipe,
          null // No notes for now
        );

        console.log('📊 Save result:', result);

        if (!result.success) {
          const errorMsg = result.error || 'Failed to save recipe';
          Alert.alert('Error', errorMsg);
          console.error('❌ Failed to save:', errorMsg);
          // Revert the UI state on failure
          setIsFavorite(false);
        }
      } else {
        // Unsave recipe
        console.log('🗑️ Removing recipe from favorites...');
        const result = await RecipeMatcherService.unsaveRecipe(user.email, recipe);

        if (!result.success) {
          Alert.alert('Error', 'Failed to remove recipe from favorites');
          // Revert the UI state on failure
          setIsFavorite(true);
        }
      }
    } catch (error) {
      console.error('💥 Exception in saveFavoriteToDatabase:', error);
      Alert.alert('Error', error.message || 'Something went wrong. Please try again.');
      // Revert the UI state on failure
      setIsFavorite(!shouldBeFavorite);
    } finally {
      setSavingFavorite(false);
    }
  };

  const toggleFavorite = () => {
    if (!user?.email) {
      console.log('❌ No user email found, showing sign in alert');
      Alert.alert(
        'Sign In Required',
        'Please sign in to save recipes to your favorites.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => router.push('/signin') }
        ]
      );
      return;
    }

    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Trigger haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Toggle the UI state immediately
    const newFavoriteState = !isFavorite;
    setIsFavorite(newFavoriteState);
    pendingFavoriteState.current = newFavoriteState;

    // Trigger fast spring animation
    scaleAnim.setValue(1);
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 2,
      tension: 200,
      velocity: 3,
      useNativeDriver: true,
    }).start();

    // Show toast immediately
    if (newFavoriteState) {
      showToastMessage('Recipe added to your favorites', true);
    } else {
      showToastMessage('Recipe removed from favorites', false);
    }

    // Wait 3 seconds before actually saving to database
    saveTimeoutRef.current = setTimeout(() => {
      saveFavoriteToDatabase(pendingFavoriteState.current);
    }, 3000);
  };

  const openRecipeUrl = () => {
    if (recipe?.url) {
      Linking.openURL(recipe.url).catch(err => {
        console.error('Error opening URL:', err);
        Alert.alert('Error', 'Could not open recipe website');
      });
    }
  };

  const handleSimilarRecipePress = (similarRecipe) => {
    // Navigate to this same screen with new recipe data
    router.push({
      pathname: '/recipe-detail',
      params: { recipeData: JSON.stringify(similarRecipe) }
    });
  };

  const handleStartRecipe = () => {
    const currentRecipe = displayRecipe || recipe;

    // Ensure recipe has instructions before navigating
    const recipeWithInstructions = {
      ...currentRecipe,
      instructions: instructions.length > 0 ? instructions : currentRecipe.instructions || []
    };

    if (!currentRecipe?.ingredientLines || currentRecipe.ingredientLines.length === 0) {
      // No ingredients, just go to cooking steps
      router.push({
        pathname: '/cooking-steps',
        params: {
          recipeData: JSON.stringify(recipeWithInstructions),
          hasSubstitutions: hasSubstitutions,
        }
      });
      return;
    }

    // Function to proceed to cooking
    const proceedToCooking = () => {
      router.push({
        pathname: '/cooking-steps',
        params: {
          recipeData: JSON.stringify(recipeWithInstructions),
          hasSubstitutions: hasSubstitutions,
        }
      });
    };

    // Function to handle the flow after user decides about pantry ingredients
    const handleAfterPantryDecision = () => {
      // Check for missing ingredients (only if there are missing ones)
      if (hasMissingIngredients) {
        // Show alert with options to substitute
        showMissingIngredientsAlert(
          // Option 1: "No, Proceed" - Go to cooking without substitution
          proceedToCooking,
          // Option 2: "Yes" - Open substitution modal
          () => {
            setSubstitutionMode('auto');
            setShowSubstitutionModal(true);
          }
        );
      } else {
        // No missing ingredients, proceed to cooking
        proceedToCooking();
      }
    };

    // First check if there are available pantry ingredients
    if (hasAvailableIngredients) {
      // Show alert asking if user wants to use pantry ingredients
      showUsePantryIngredientsAlert(
        // User said "Yes" - will track for subtraction at the end
        handleAfterPantryDecision,
        // User said "No" - won't ask for subtraction at the end
        handleAfterPantryDecision
      );
    } else {
      // No available pantry ingredients, just check for missing ones
      handleAfterPantryDecision();
    }
  };

  const handleScheduleRecipe = () => {
    if (!customUserData?.userID) {
      Alert.alert('Sign In Required', 'Please sign in to schedule recipes');
      return;
    }

    setShowScheduleModal(true);
  };

  const handleScheduleModalClose = (wasSuccessful) => {
    setShowScheduleModal(false);

    if (wasSuccessful) {
      // Optionally navigate to profile scheduled tab
      // router.push('/(tabs)/profile');
    }
  };

  const handleManualSubstitute = () => {
    const currentRecipe = displayRecipe || recipe;

    if (!currentRecipe?.ingredientLines || currentRecipe.ingredientLines.length === 0) {
      Alert.alert('No Ingredients', 'This recipe has no ingredients to substitute');
      return;
    }

    setSubstitutionMode('manual');
    setShowSubstitutionModal(true);
  };

  const handleSubstitutionConfirm = async (substitutions) => {
    // Apply substitutions to create modified recipe
    const modified = applySubstitutions(substitutions);

    // Ensure modified recipe has instructions
    const modifiedWithInstructions = {
      ...modified,
      instructions: instructions.length > 0 ? instructions : modified.instructions || []
    };

    setDisplayRecipe(modifiedWithInstructions);

    // Close modal
    setShowSubstitutionModal(false);

    // If in auto mode (from Start Recipe), proceed to cooking
    if (substitutionMode === 'auto') {
      router.push({
        pathname: '/cooking-steps',
        params: {
          recipeData: JSON.stringify(modifiedWithInstructions),
          hasSubstitutions: true,
        }
      });
    }
  };

  const nutrition = useMemo(() => {
    if (!recipe) return null;

    // Check if it's an AI-generated recipe with macronutrients
    const isAIRecipe = recipe.isCustom || recipe.source === 'SousChef AI';

    if (isAIRecipe) {
      // ✅ AI Recipe: ONLY use direct properties (protein, carbs, fat, calories)
      // Don't use Edamam's complex nutrient extraction for AI recipes
      const protein = recipe.protein;
      const carbs = recipe.carbs;
      const fat = recipe.fat;
      const calories = recipe.calories;

      console.log('🤖 AI Recipe Nutrition (direct properties):', { protein, carbs, fat, calories });

      // Only return nutrition if we have actual values (not undefined/null)
      if (protein !== undefined || carbs !== undefined || fat !== undefined || calories !== undefined) {
        return {
          calories: Math.round(calories || 0),
          nutrients: {
            carbs: { amount: Math.round(carbs || 0) },
            protein: { amount: Math.round(protein || 0) },
            fat: { amount: Math.round(fat || 0) }
          },
          isAIEstimate: true
        };
      }

      // If no direct properties, return null (don't show nutrition section)
      console.warn('⚠️ AI recipe missing nutrition data');
      return null;
    }

    // Edamam recipe - use full nutrient extraction with all micronutrients
    console.log('📊 Edamam Recipe - extracting full nutrition info');
    const edamamNutrition = EdamamService.extractNutritionInfo(recipe);
    return edamamNutrition;
  }, [recipe]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#4CAF50" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading recipe...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!recipe) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#4CAF50" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Recipe not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <AuthGuard>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

        {/* Fixed Header Buttons Overlay */}
        <View style={styles.fixedHeaderOverlay}>
          <TouchableOpacity
            onPress={handleBackPress}
            activeOpacity={1}
          >
            <Animated.View style={[styles.fixedBackButton, { transform: [{ scale: backButtonScaleAnim }] }]}>
              <Svg width={wp('6%')} height={wp('6%')} viewBox="0 0 24 24" fill="none" stroke="#81A969" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <Path d="m15 18-6-6 6-6" />
              </Svg>
            </Animated.View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={toggleFavorite}
            disabled={savingFavorite}
            activeOpacity={1}
          >
            <Animated.View style={[styles.fixedFavoriteButton, { transform: [{ scale: scaleAnim }] }]}>
              <Ionicons
                name={isFavorite ? "heart" : "heart-outline"}
                size={wp('6%')}
                color={isFavorite ? "#ff4757" : "#81A969"}
              />
            </Animated.View>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollViewContent}
        >
          {/* Hero Image */}
          <RecipeHero image={recipe.image} />

          {/* Recipe Info Card */}
          <View style={styles.recipeCard}>
            <RecipeInfo recipe={recipe} onViewMore={openRecipeUrl} />

            {/* Nutrition Grid */}
            {nutrition && <NutritionGrid nutrition={nutrition} />}

            {/* Tab Navigation */}
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'ingredients' && styles.activeTab]}
                onPress={() => handleTabChange('ingredients')}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabText, activeTab === 'ingredients' && styles.activeTabText]}>
                  Ingredients
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'instructions' && styles.activeTab]}
                onPress={() => handleTabChange('instructions')}
                activeOpacity={0.7}
              >
                <View style={styles.tabContent}>
                  <Text style={[styles.tabText, activeTab === 'instructions' && styles.activeTabText]}>
                    Instructions
                  </Text>
                  {preloadingInstructions && (
                    <ActivityIndicator size="small" color="#81A969" style={styles.tabSpinner} />
                  )}
                </View>
              </TouchableOpacity>
            </View>

            {/* Tab Content */}
            <View style={styles.tabContentWrapper}>
              {activeTab === 'ingredients' && (
                <IngredientsTab
                  ingredients={(displayRecipe || recipe).ingredientLines}
                  onSubstitutePress={handleManualSubstitute}
                  hasSubstitutions={hasSubstitutions}
                />
              )}

              {activeTab === 'instructions' && (
                <InstructionsTab
                  instructions={instructions}
                  loading={loadingInstructions}
                  instructionsSource={instructionsSource}
                  recipeUrl={recipe?.url}
                  onOpenUrl={openRecipeUrl}
                  hasSubstitutions={hasSubstitutions}
                />
              )}
            </View>

            {/* Creator Section */}
            <View style={styles.creatorSection}>
              <Text style={styles.sectionTitle}>Recipe Source</Text>
              <View style={styles.creatorCard}>
                <View style={styles.creatorIcon}>
                  <Text style={styles.creatorIconText}>{recipe.source?.charAt(0) || 'R'}</Text>
                </View>
                <View style={styles.creatorInfo}>
                  <Text style={styles.creatorName}>{recipe.source}</Text>
                  <Text style={styles.creatorDescription}>Original recipe provider</Text>
                </View>
              </View>
            </View>

            {/* More Like This Section */}
            <SimilarRecipes
              recipes={similarRecipes}
              loading={loadingSimilar}
              onRecipePress={handleSimilarRecipePress}
            />
          </View>
        </ScrollView>

        {/* Floating Play Button */}
        <FloatingPlayButton
          onStartRecipe={handleStartRecipe}
          onScheduleRecipe={handleScheduleRecipe}
          hasMissingIngredients={hasMissingIngredients}
        />

        {/* Ingredient Substitution Modal */}
        <IngredientSubstitutionModal
          visible={showSubstitutionModal}
          onClose={() => setShowSubstitutionModal(false)}
          onConfirm={handleSubstitutionConfirm}
          missingIngredients={
            substitutionMode === 'auto'
              ? [...missingIngredients, ...insufficientIngredients] // Include both missing and insufficient
              : ((displayRecipe || recipe)?.ingredientLines || []) // All ingredients for manual
          }
          userID={customUserData?.userID}
        />

        {/* Schedule Recipe Modal */}
        <ScheduleRecipeModal
          visible={showScheduleModal}
          onClose={handleScheduleModalClose}
          recipe={displayRecipe || recipe}
          userID={customUserData?.userID}
        />

        {/* Toast Notifications */}
        {toastQueue.map((toast) => (
          <Animated.View
            key={toast.id}
            style={[
              styles.toastContainer,
              {
                opacity: toast.opacity,
                transform: [{ translateY: toast.translateY }],
              },
            ]}
          >
            <View style={[
              styles.toastContent,
              { borderLeftColor: toast.isAdded ? '#81A969' : '#e74c3c' }
            ]}>
              <Ionicons
                name={toast.isAdded ? "checkmark-circle" : "close-circle"}
                size={wp('5%')}
                color={toast.isAdded ? "#81A969" : "#e74c3c"}
              />
              <Text style={styles.toastText}>{toast.message}</Text>
            </View>
          </Animated.View>
        ))}
      </View>
    </AuthGuard>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  fixedHeaderOverlay: {
    position: 'absolute',
    top: Platform.OS === 'android' ? StatusBar.currentHeight + hp('2%') : hp('6%'),
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: wp('5%'),
    zIndex: 1000,
  },
  fixedBackButton: {
    width: wp('12%'),
    height: wp('12%'),
    backgroundColor: '#FFFFFF',
    borderRadius: wp('3%'),
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  fixedFavoriteButton: {
    width: wp('12%'),
    height: wp('12%'),
    backgroundColor: '#FFFFFF',
    borderRadius: wp('3%'),
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollViewContent: {
    paddingBottom: hp('10%'),
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: wp('4%'),
    color: '#7f8c8d',
    marginTop: hp('1.5%'),
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp('5%'),
  },
  errorText: {
    fontSize: wp('4.5%'),
    color: '#e74c3c',
    marginBottom: hp('2.5%'),
    textAlign: 'center',
    fontWeight: '600',
  },
  backButton: {
    backgroundColor: '#81A969',
    paddingHorizontal: wp('6%'),
    paddingVertical: hp('1.5%'),
    borderRadius: wp('6%'),
  },
  backButtonText: {
    color: '#fff',
    fontSize: wp('4%'),
    fontWeight: '600',
  },
  recipeCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: wp('7%'),
    borderTopRightRadius: wp('7%'),
    marginTop: wp('-6%'),
    paddingHorizontal: wp('5%'),
    paddingTop: hp('3%'),
    flex: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderRadius: wp('7%'),
    padding: wp('1.5%'),
    marginBottom: hp('2.5%'),
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: hp('1.5%'),
    alignItems: 'center',
    borderRadius: wp('5.5%'),
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabSpinner: {
    marginLeft: wp('2%'),
  },
  activeTab: {
    backgroundColor: '#81A969',
    elevation: 3,
    shadowColor: '#81A969',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  tabText: {
    fontSize: wp('3.8%'),
    color: '#7f8c8d',
    fontWeight: '600',
  },
  activeTabText: {
    color: '#fff',
  },
  tabContentWrapper: {
    marginBottom: hp('3%'),
  },
  creatorSection: {
    marginBottom: hp('3%'),
  },
  sectionTitle: {
    fontSize: wp('5%'),
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: hp('1.5%'),
  },
  creatorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: wp('4%'),
    padding: wp('4%'),
  },
  creatorIcon: {
    width: wp('12%'),
    height: wp('12%'),
    borderRadius: wp('6%'),
    backgroundColor: '#81A969',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp('3%'),
  },
  creatorIconText: {
    fontSize: wp('5.5%'),
    fontWeight: 'bold',
    color: '#fff',
  },
  creatorInfo: {
    flex: 1,
  },
  creatorName: {
    fontSize: wp('4.2%'),
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: hp('0.3%'),
  },
  creatorDescription: {
    fontSize: wp('3.5%'),
    color: '#7f8c8d',
  },
  toastContainer: {
    position: 'absolute',
    bottom: hp('10%'),
    left: wp('5%'),
    right: wp('5%'),
    zIndex: 9999,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('2%'),
    borderRadius: wp('4%'),
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#81A969',
  },
  toastText: {
    fontSize: wp('4%'),
    color: '#2c3e50',
    fontWeight: '600',
    marginLeft: wp('3%'),
    flex: 1,
  },
});

export default RecipeDetail;