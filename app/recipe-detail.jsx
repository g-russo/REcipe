import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import cacheService from '../services/supabase-cache-service';
import EdamamService from '../services/edamam-service';
import RecipeMatcherService from '../services/recipe-matcher-service';
import { useCustomAuth } from '../hooks/use-custom-auth';
import AuthGuard from '../components/auth-guard';

const { width } = Dimensions.get('window');

const RecipeDetail = () => {
  const router = useRouter();
  const { recipeData } = useLocalSearchParams();
  const { user } = useCustomAuth();
  
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
        <View style={styles.heroContainer}>
          <Image source={{ uri: recipe.image }} style={styles.heroImage} />
          
          {/* Header Overlay */}
          <View style={styles.headerOverlay}>
            <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton} onPress={toggleFavorite}>
              <Ionicons 
                name={isFavorite ? "heart" : "heart-outline"} 
                size={24} 
                color={isFavorite ? "#ff4757" : "#fff"} 
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Recipe Info Card */}
        <View style={styles.recipeCard}>
          <Text style={styles.recipeTitle}>{recipe.label}</Text>
          
          <View style={styles.metaInfo}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={16} color="#666" />
              <Text style={styles.metaText}>{recipe.totalTime || 30} Min</Text>
            </View>
            <Text style={styles.metaDivider}>•</Text>
            <Text style={styles.metaText}>Serving Size: {recipe.yield}</Text>
          </View>

          <Text style={styles.description}>
            {recipe.recipeDescription || `${recipe.label} is a delicious recipe perfect for any occasion...`}
            {recipe?.url && (
              <Text style={styles.viewMore} onPress={openRecipeUrl}> View More</Text>
            )}
          </Text>

          {/* Nutrition Grid */}
          {nutrition && nutrition.nutrients && (
            <View style={styles.nutritionGrid}>
              <View style={styles.nutritionItem}>
                <View style={[styles.nutritionIcon, { backgroundColor: '#e8f5e8' }]}>
                  <Ionicons name="leaf-outline" size={20} color="#4CAF50" />
                </View>
                <Text style={styles.nutritionValue}>
                  {nutrition.nutrients.carbs?.amount || 0}g carbs
                </Text>
              </View>
              
              <View style={styles.nutritionItem}>
                <View style={[styles.nutritionIcon, { backgroundColor: '#e3f2fd' }]}>
                  <Ionicons name="fitness-outline" size={20} color="#2196F3" />
                </View>
                <Text style={styles.nutritionValue}>
                  {nutrition.nutrients.protein?.amount || 0}g proteins
                </Text>
              </View>
              
              <View style={styles.nutritionItem}>
                <View style={[styles.nutritionIcon, { backgroundColor: '#fff3e0' }]}>
                  <Ionicons name="flame-outline" size={20} color="#FF9800" />
                </View>
                <Text style={styles.nutritionValue}>
                  {nutrition.calories || 0} Kcal
                </Text>
              </View>
              
              <View style={styles.nutritionItem}>
                <View style={[styles.nutritionIcon, { backgroundColor: '#f3e5f5' }]}>
                  <Ionicons name="water-outline" size={20} color="#9C27B0" />
                </View>
                <Text style={styles.nutritionValue}>
                  {nutrition.nutrients.fat?.amount || 0}g fats
                </Text>
              </View>
            </View>
          )}

          {/* AI Nutrition Disclaimer */}
          {nutrition?.isAIEstimate && (
            <View style={styles.aiDisclaimer}>
              <Ionicons name="information-circle-outline" size={14} color="#666" />
              <Text style={styles.aiDisclaimerText}>
                Nutritional values are estimates by SousChef AI based on ingredients
              </Text>
            </View>
          )}

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
          <View style={styles.tabContent}>
            {activeTab === 'ingredients' && (
              <View>
                <View style={styles.ingredientsHeader}>
                  <Text style={styles.sectionTitle}>Ingredients</Text>
                  <TouchableOpacity>
                    <Text style={styles.substituteText}>Substitute</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.itemCount}>{recipe.ingredientLines?.length || 0} Items</Text>
                
                <View style={styles.ingredientsGrid}>
                  {recipe.ingredientLines?.map((ingredient, index) => (
                    <View key={index} style={styles.ingredientRow}>
                      <Text style={styles.ingredientText}>{ingredient}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {activeTab === 'instructions' && (
              <View>
                <Text style={styles.sectionTitle}>Instructions</Text>
                
                {loadingInstructions ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#4CAF50" />
                    <Text style={styles.loadingText}>Loading instructions...</Text>
                  </View>
                ) : (
                  <View style={styles.instructionsContainer}>
                    {/* Instructions Source Indicator */}
                    {instructionsSource === 'ai' && (
                      <View style={styles.sourceIndicator}>
                        <Ionicons name="sparkles" size={16} color="#9C27B0" />
                        <Text style={styles.sourceText}>AI-generated instructions by SousChef AI</Text>
                      </View>
                    )}
                    {instructionsSource === 'scraped' && (
                      <View style={styles.sourceIndicator}>
                        <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                        <Text style={styles.sourceText}>Instructions extracted from original recipe</Text>
                      </View>
                    )}
                    {instructionsSource === 'cached' && (
                      <View style={styles.sourceIndicator}>
                        <Ionicons name="flash" size={16} color="#2196F3" />
                        <Text style={styles.sourceText}>Instructions loaded instantly from cache</Text>
                      </View>
                    )}
                    {instructionsSource === 'fallback' && (
                      <View style={styles.sourceIndicator}>
                        <Ionicons name="information-circle" size={16} color="#FF9800" />
                        <Text style={styles.sourceText}>General cooking steps (visit original for details)</Text>
                      </View>
                    )}
                    
                    {instructions.map((instruction, index) => (
                      <View key={index} style={styles.instructionStep}>
                        <View style={styles.stepNumber}>
                          <Text style={styles.stepNumberText}>{index + 1}</Text>
                        </View>
                        <Text style={styles.instructionText}>{instruction}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Only show View Original Recipe button for external recipes (not AI-generated) */}
                {recipe?.url && (
                  <TouchableOpacity style={styles.viewRecipeButton} onPress={openRecipeUrl}>
                    <Text style={styles.viewRecipeText}>View Original Recipe</Text>
                    <Ionicons name="arrow-forward" size={16} color="#4CAF50" />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* Creator Section */}
          <View style={styles.creatorSection}>
            <Text style={styles.sectionTitle}>Creator</Text>
            <Text style={styles.creatorName}>{recipe.source}</Text>
            <Text style={styles.creatorDescription}>Recipe is made by {recipe.source}.</Text>
          </View>

          {/* More Like This Section */}
          <View style={styles.moreLikeSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>More Like This</Text>
              <TouchableOpacity>
                <Text style={styles.seeAllText}>See All ({similarRecipes.length})</Text>
              </TouchableOpacity>
            </View>
            
            {loadingSimilar ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#4CAF50" />
                <Text style={styles.loadingText}>Finding great recipes...</Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.similarRecipesContainer}>
                {similarRecipes.map((similarRecipe, index) => (
                  <TouchableOpacity 
                    key={`${similarRecipe.id || similarRecipe.uri}_${index}`} 
                    style={styles.similarRecipeCard}
                    onPress={() => handleSimilarRecipePress(similarRecipe)}
                  >
                    <Image source={{ uri: similarRecipe.image }} style={styles.similarRecipeImage} />
                    <View style={styles.similarRecipeInfo}>
                      <Text style={styles.similarRecipeTitle} numberOfLines={2}>
                        {similarRecipe.label}
                      </Text>
                      <View style={styles.similarRecipeMeta}>
                        <Ionicons name="time-outline" size={12} color="#666" />
                        <Text style={styles.similarRecipeTime}>
                          {similarRecipe.totalTime || '30'} min
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
                
                {/* Show message if no similar recipes found */}
                {similarRecipes.length === 0 && (
                  <View style={styles.noRecipesContainer}>
                    <Text style={styles.noRecipesText}>No similar recipes found. Try searching for more!</Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </ScrollView>
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
  heroContainer: {
    position: 'relative',
    height: 300,
  },
  heroImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  headerOverlay: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipeCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    marginTop: -25,
    padding: 20,
    flex: 1,
  },
  recipeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  metaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  metaDivider: {
    fontSize: 14,
    color: '#666',
    marginHorizontal: 8,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 20,
  },
  viewMore: {
    color: '#4CAF50',
    fontWeight: '500',
  },
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 25,
  },
  nutritionItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  nutritionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  nutritionValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  aiDisclaimer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: '#9C27B0',
  },
  aiDisclaimerText: {
    fontSize: 11,
    color: '#666',
    fontStyle: 'italic',
    marginLeft: 6,
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
  tabContent: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  ingredientsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  substituteText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
  },
  itemCount: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  ingredientsGrid: {
    gap: 10,
  },
  ingredientRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f0f0f0',
  },
  ingredientText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  viewRecipeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  viewRecipeText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
    flex: 1,
  },
  instructionNote: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  creatorSection: {
    marginBottom: 25,
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
  moreLikeSection: {
    marginBottom: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  seeAllText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
  },
  similarRecipesContainer: {
    marginLeft: -20,
  },
  similarRecipeCard: {
    marginLeft: 20,
    width: 140,
    backgroundColor: '#fff',
    borderRadius: 12,
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
  similarRecipeImage: {
    width: '100%',
    height: 100,
    resizeMode: 'cover',
  },
  similarRecipeInfo: {
    padding: 8,
  },
  similarRecipeTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    lineHeight: 16,
  },
  similarRecipeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  similarRecipeTime: {
    fontSize: 10,
    color: '#666',
    marginLeft: 4,
  },
  noRecipesContainer: {
    marginLeft: 20,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noRecipesText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  instructionsContainer: {
    marginBottom: 20,
  },
  sourceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 8,
    borderRadius: 6,
    marginBottom: 15,
  },
  sourceText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 6,
    fontStyle: 'italic',
  },
  instructionStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 15,
    paddingRight: 10,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  stepNumberText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
});

export default RecipeDetail;