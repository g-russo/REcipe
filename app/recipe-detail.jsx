import React, { useState, useEffect } from 'react';
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
  Linking
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import cacheService from '../services/supabase-cache-service';
import EdamamService from '../services/edamam-service';
import RecipeMatcherService from '../services/recipe-matcher-service';
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
import { useIngredientSubstitution } from '../hooks/use-ingredient-substitution';
import IngredientSubstitutionModal from '../components/substitution/ingredient-substitution-modal';

const RecipeDetail = () => {
  const router = useRouter();
  const { recipeData } = useLocalSearchParams();
  const { user, customUserData } = useCustomAuth();
  
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

  // Use the substitution hook
  const {
    missingIngredients,
    availableIngredients,
    modifiedRecipe,
    showMissingIngredientsAlert,
    applySubstitutions,
    showIngredientUsageConfirmation,
    hasMissingIngredients,
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

  useEffect(() => {
    if (recipeData) {
      try {
        const parsedRecipe = JSON.parse(recipeData);
        setRecipe(parsedRecipe);
        setLoading(false);
        
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
      const similarRecipesData = await cacheService.getSimilarRecipes(currentRecipe, 12);
      const result = { success: true, data: { recipes: similarRecipesData } };
      
      console.log('📊 SMART similar recipes result:', result);
      
      if (result.success) {
        setSimilarRecipes(result.data.recipes);
        console.log(`✅ Successfully set ${result.data.recipes.length} similar recipes`);
        
        if (result.data.analysis) {
          console.log('🧬 Recipe analysis:', result.data.analysis);
        }
        
        if (result.data.cached) {
          console.log('💾 Similar recipes loaded from cache');
        } else {
          console.log(`🔍 Similar recipes found using ${result.data.strategiesUsed} search strategies`);
        }
      } else {
        console.log('❌ Failed to get similar recipes:', result.error);
        setSimilarRecipes([]);
      }
    } catch (error) {
      console.error('💥 Error in fetchSimilarRecipes:', error);
      setSimilarRecipes([]);
    } finally {
      setLoadingSimilar(false);
    }
  };

  const fetchInstructions = async (recipeUrl) => {
    setLoadingInstructions(true);
    try {
      const result = await EdamamService.getRecipeInstructions(recipeUrl);
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
      // Quietly preload instructions in background
      const result = await EdamamService.getRecipeInstructions(recipeUrl);
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

  const toggleFavorite = async () => {
    console.log('🔍 Toggle favorite - User state:', { 
      hasUser: !!user, 
      email: user?.email,
      userObject: user 
    });

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

    console.log('✅ User authenticated, proceeding with save');
    setSavingFavorite(true);
    
    try {
      if (isFavorite) {
        // Unsave recipe
        console.log('🗑️ Removing recipe from favorites...');
        const result = await RecipeMatcherService.unsaveRecipe(user.email, recipe);
        
        if (result.success) {
          setIsFavorite(false);
          Alert.alert('Removed', 'Recipe removed from favorites');
        } else {
          Alert.alert('Error', 'Failed to remove recipe from favorites');
        }
      } else {
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
        
        if (result.success) {
          setIsFavorite(true);
          Alert.alert('Saved!', 'Recipe added to your favorites');
        } else {
          const errorMsg = result.error || 'Failed to save recipe';
          Alert.alert('Error', errorMsg);
          console.error('❌ Failed to save:', errorMsg);
        }
      }
    } catch (error) {
      console.error('💥 Exception in toggleFavorite:', error);
      Alert.alert('Error', error.message || 'Something went wrong. Please try again.');
    } finally {
      setSavingFavorite(false);
    }
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

    // Check for missing ingredients
    if (hasMissingIngredients) {
      // Show alert with options
      showMissingIngredientsAlert(
        // Option 1: "No, Proceed" - Go to cooking without substitution
        () => {
          router.push({
            pathname: '/cooking-steps',
            params: {
              recipeData: JSON.stringify(recipeWithInstructions),
              hasSubstitutions: hasSubstitutions,
            }
          });
        },
        // Option 2: "Yes" - Open substitution modal
        () => {
          setSubstitutionMode('auto');
          setShowSubstitutionModal(true);
        }
      );
    } else {
      // All ingredients available, proceed directly
      router.push({
        pathname: '/cooking-steps',
        params: {
          recipeData: JSON.stringify(recipeWithInstructions),
          hasSubstitutions: hasSubstitutions,
        }
      });
    }
  };

  const handleScheduleRecipe = () => {
    Alert.alert(
      'Schedule Recipe',
      'This feature is coming soon! You\'ll be able to schedule recipes for specific dates and times.',
      [{ text: 'OK' }]
    );
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

  const handleSubstitutionConfirm = (substitutions) => {
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

  const getNutritionInfo = () => {
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
  };

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

  const nutrition = getNutritionInfo();

  return (
    <AuthGuard>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Hero Image */}
        <RecipeHero
          image={recipe.image}
          onBack={() => router.back()}
          onToggleFavorite={toggleFavorite}
          isFavorite={isFavorite}
          savingFavorite={savingFavorite}
        />

        {/* Recipe Info Card */}
        <View style={styles.recipeCard}>
          <RecipeInfo recipe={recipe} onViewMore={openRecipeUrl} />

          {/* Nutrition Grid */}
          <NutritionGrid nutrition={nutrition} />

          {/* Tab Navigation */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'ingredients' && styles.activeTab]}
              onPress={() => handleTabChange('ingredients')}
            >
              <Text style={[styles.tabText, activeTab === 'ingredients' && styles.activeTabText]}>
                Ingredients
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'instructions' && styles.activeTab]}
              onPress={() => handleTabChange('instructions')}
            >
              <View style={styles.tabContent}>
                <Text style={[styles.tabText, activeTab === 'instructions' && styles.activeTabText]}>
                  Instructions
                </Text>
                {preloadingInstructions && (
                  <ActivityIndicator size="small" color="#4CAF50" style={styles.tabSpinner} />
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
            <Text style={styles.sectionTitle}>Creator</Text>
            <Text style={styles.creatorName}>{recipe.source}</Text>
            <Text style={styles.creatorDescription}>Recipe is made by {recipe.source}.</Text>
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
            ? missingIngredients // Only missing ingredients
            : ((displayRecipe || recipe)?.ingredientLines || []) // All ingredients for manual
        }
        userID={customUserData?.userID}
      />
    </SafeAreaView>
    </AuthGuard>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#e74c3c',
    marginBottom: 20,
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  recipeCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    marginTop: -25,
    padding: 20,
    flex: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderRadius: 25,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 20,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabSpinner: {
    marginLeft: 6,
  },
  activeTab: {
    backgroundColor: '#4CAF50',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#fff',
  },
  tabContentWrapper: {
    marginBottom: 25,
  },
  creatorSection: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  creatorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  creatorDescription: {
    fontSize: 14,
    color: '#666',
  },
});

export default RecipeDetail;