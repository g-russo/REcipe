import { supabase } from '../lib/supabase';
import { OPENAI_API_KEY } from '@env';
import EdamamService from './edamam-service';
import ImageGenerationService from './image-generation-service';

class RecipeMatcherService {
  /**
   * Check if user can make a recipe using AI-powered ingredient matching
   */
  async checkRecipeMatch(userEmail, recipe) {
    try {
      const pantryItems = await this.getUserPantryItems(userEmail);
      
      if (pantryItems.length === 0) {
        return {
          canMake: false,
          matchPercentage: 0,
          missingIngredients: recipe.ingredients || [],
          availableIngredients: [],
          matches: []
        };
      }

      const matchResult = await this.aiMatchIngredients(
        recipe.ingredients,
        pantryItems
      );

      return matchResult;
    } catch (error) {
      console.error('Error checking recipe match:', error);
      return {
        canMake: false,
        matchPercentage: 0,
        missingIngredients: recipe.ingredients || [],
        availableIngredients: [],
        matches: [],
        error: error.message
      };
    }
  }

  /**
   * Get user's pantry items
   */
  async getUserPantryItems(userEmail) {
    try {
      const { data: userData } = await supabase
        .from('tbl_users')
        .select('userID')
        .eq('userEmail', userEmail)
        .single();

      if (!userData) return [];

      const { data: inventory } = await supabase
        .from('tbl_inventories')
        .select('inventoryID')
        .eq('userID', userData.userID)
        .single();

      if (!inventory) return [];

      const { data: items } = await supabase
        .from('tbl_items')
        .select('*')
        .eq('inventoryID', inventory.inventoryID);

      return items || [];
    } catch (error) {
      console.error('Error fetching pantry:', error);
      return [];
    }
  }

  /**
   * AI-powered ingredient matching (handles multiple languages)
   */
  async aiMatchIngredients(recipeIngredients, pantryItems) {
    try {
      const prompt = `Match recipe ingredients with pantry items. Consider different languages, variations, and reasonable substitutions.

Recipe needs:
${JSON.stringify(recipeIngredients, null, 2)}

User's pantry:
${JSON.stringify(pantryItems.map(item => ({
  name: item.itemName,
  quantity: item.quantity,
  unit: item.unit,
  category: item.itemCategory
})), null, 2)}

Rules:
1. Match across languages (e.g., "chicken" = "manok" = "pollo")
2. Match variations (e.g., "tomatoes" = "cherry tomatoes")
3. Check quantities (does user have enough?)
4. Suggest substitutions when appropriate

Return ONLY valid JSON:
{
  "matches": [
    {
      "recipeIngredient": "string",
      "pantryItem": "string or null",
      "isMatch": true/false,
      "confidence": 0-100,
      "hasEnough": true/false,
      "substitutionNote": "string or null"
    }
  ],
  "canMake": true/false,
  "matchPercentage": 0-100,
  "missingIngredients": ["array"],
  "availableIngredients": ["array"]
}`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo', // Cheaper model for matching
          messages: [
            {
              role: 'system',
              content: 'You are a culinary expert matching ingredients across languages and cultures. Return only valid JSON.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        throw new Error('AI matching failed');
      }

      const aiResponse = await response.json();
      return JSON.parse(aiResponse.choices[0].message.content);
    } catch (error) {
      console.error('AI matching error:', error);
      return this.fallbackMatch(recipeIngredients, pantryItems);
    }
  }

  /**
   * Simple fallback matching (no AI)
   */
  fallbackMatch(recipeIngredients, pantryItems) {
    const matches = recipeIngredients.map(ingredient => {
      const ingredientName = ingredient.name.toLowerCase();
      const pantryMatch = pantryItems.find(item => 
        item.itemName.toLowerCase().includes(ingredientName) ||
        ingredientName.includes(item.itemName.toLowerCase())
      );

      return {
        recipeIngredient: ingredient.name,
        pantryItem: pantryMatch?.itemName || null,
        isMatch: !!pantryMatch,
        confidence: pantryMatch ? 70 : 0,
        hasEnough: true,
        substitutionNote: null
      };
    });

    const matchedCount = matches.filter(m => m.isMatch).length;
    const matchPercentage = recipeIngredients.length > 0 
      ? Math.round((matchedCount / recipeIngredients.length) * 100) 
      : 0;

    return {
      matches,
      canMake: matchPercentage === 100,
      matchPercentage,
      missingIngredients: matches.filter(m => !m.isMatch).map(m => m.recipeIngredient),
      availableIngredients: matches.filter(m => m.isMatch).map(m => m.recipeIngredient)
    };
  }

  /**
   * Save/bookmark a recipe (supports both Edamam and AI recipes)
   */
  async saveRecipe(userEmail, recipe, notes = null) {
    try {
      const { data: userData } = await supabase
        .from('tbl_users')
        .select('userID')
        .eq('userEmail', userEmail)
        .single();

      if (!userData) return { success: false };

      // Determine recipe source
      const isAIRecipe = recipe.isCustom || recipe.source === 'SousChef AI';
      
      console.log('🔍 Recipe type check:', { 
        isAIRecipe, 
        hasRecipeID: !!recipe.recipeID,
        hasUri: !!recipe.uri,
        source: recipe.source,
        isCustom: recipe.isCustom
      });
      
      let recipeData;
      if (isAIRecipe) {
        // AI-generated recipe
        recipeData = {
          userID: userData.userID,
          aiRecipeID: recipe.recipeID,
          edamamRecipeURI: null,
          recipeSource: 'ai',
          recipeData: null,
          isFavorited: true,
          notes: notes,
          lastViewed: new Date().toISOString()
        };
      } else {
        // Edamam recipe - store comprehensive cache data
        
        // 🖼️ Download and store image permanently to avoid expired AWS tokens
        let permanentImageUrl = recipe.image;
        if (recipe.image && recipe.uri) {
          console.log('📥 Downloading and storing Edamam image permanently...');
          try {
            permanentImageUrl = await ImageGenerationService.downloadAndStoreEdamamImage(
              recipe.image,
              recipe.uri
            );
            console.log('✅ Image stored permanently:', permanentImageUrl);
          } catch (imageError) {
            console.warn('⚠️ Failed to store image, using original URL:', imageError.message);
            // Continue with original URL - better than failing the entire save
          }
        }
        
        recipeData = {
          userID: userData.userID,
          aiRecipeID: null,
          edamamRecipeURI: recipe.uri,
          recipeSource: 'edamam',
          recipeData: {
            id: recipe.id || recipe.uri,
            uri: recipe.uri, // ✅ CRITICAL: Include uri for favorites functionality
            label: recipe.label,
            image: permanentImageUrl, // Use permanent URL instead of temporary AWS URL
            images: recipe.images,
            source: recipe.source,
            url: recipe.url,
            shareAs: recipe.shareAs,
            yield: recipe.yield,
            ingredientLines: recipe.ingredientLines,
            ingredients: recipe.ingredients,
            calories: recipe.calories,
            totalTime: recipe.totalTime,
            totalCO2Emissions: recipe.totalCO2Emissions,
            co2EmissionsClass: recipe.co2EmissionsClass,
            cuisineType: recipe.cuisineType,
            mealType: recipe.mealType,
            dishType: recipe.dishType,
            healthLabels: recipe.healthLabels,
            dietLabels: recipe.dietLabels,
            cautions: recipe.cautions,
            totalNutrients: recipe.totalNutrients,
            totalDaily: recipe.totalDaily,
            digest: recipe.digest
          },
          isFavorited: true,
          notes: notes,
          lastViewed: new Date().toISOString()
        };
      }

      console.log('💾 Attempting to save recipe:', {
        isAIRecipe,
        userID: userData.userID,
        recipeURI: recipe.uri,
        recipeID: recipe.recipeID
      });

      console.log('📦 Data being inserted:', {
        userID: recipeData.userID,
        aiRecipeID: recipeData.aiRecipeID,
        edamamRecipeURI: recipeData.edamamRecipeURI,
        recipeSource: recipeData.recipeSource,
        hasRecipeData: !!recipeData.recipeData
      });

      // Check if recipe already exists
      let existingQuery = supabase
        .from('tbl_favorites')
        .select('favoriteID')
        .eq('userID', userData.userID);

      if (isAIRecipe) {
        existingQuery = existingQuery.eq('aiRecipeID', recipe.recipeID);
      } else {
        existingQuery = existingQuery.eq('edamamRecipeURI', recipe.uri);
      }

      const { data: existing } = await existingQuery.single();

      let result;
      if (existing) {
        // Update existing favorite
        console.log('📝 Updating existing favorite:', existing.favoriteID);
        result = await supabase
          .from('tbl_favorites')
          .update({
            isFavorited: true,
            lastViewed: new Date().toISOString(),
            notes: notes
          })
          .eq('favoriteID', existing.favoriteID);
      } else {
        // Insert new favorite
        console.log('➕ Inserting new favorite');
        result = await supabase
          .from('tbl_favorites')
          .insert(recipeData);
      }

      const { data, error } = result;

      if (error) {
        console.error('❌ Supabase error saving recipe:', error);
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        return { success: false, error: error.message };
      }

      console.log('✅ Recipe saved successfully!', data);
      return { success: true };
    } catch (error) {
      console.error('💥 Exception saving recipe:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Unsave/remove a recipe from favorites
   */
  async unsaveRecipe(userEmail, recipe) {
    try {
      console.log('🗑️ Unsaving recipe:', {
        userEmail,
        isCustom: recipe.isCustom,
        recipeID: recipe.recipeID,
        uri: recipe.uri
      });

      const { data: userData } = await supabase
        .from('tbl_users')
        .select('userID')
        .eq('userEmail', userEmail)
        .single();

      if (!userData) {
        console.error('❌ User not found');
        return { success: false, error: 'User not found' };
      }

      const isAIRecipe = recipe.isCustom || recipe.source === 'SousChef AI';

      console.log('🔍 Delete query params:', {
        isAIRecipe,
        userID: userData.userID,
        aiRecipeID: recipe.recipeID,
        edamamRecipeURI: recipe.uri
      });

      let deleteQuery = supabase
        .from('tbl_favorites')
        .delete()
        .eq('userID', userData.userID);

      if (isAIRecipe) {
        deleteQuery = deleteQuery.eq('aiRecipeID', recipe.recipeID);
      } else {
        deleteQuery = deleteQuery.eq('edamamRecipeURI', recipe.uri);
      }

      const { error, data } = await deleteQuery;

      if (error) {
        console.error('❌ Delete error:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Recipe unsaved successfully', data);
      return { success: true };
    } catch (error) {
      console.error('💥 Exception unsaving recipe:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get saved recipes (both Edamam and AI)
   * For Edamam recipes, always fetch fresh data from API
   */
  async getSavedRecipes(userEmail) {
    try {
      console.log('📥 Getting saved recipes for:', userEmail);
      
      const { data: userData } = await supabase
        .from('tbl_users')
        .select('userID')
        .eq('userEmail', userEmail)
        .single();

      if (!userData) {
        console.log('❌ User not found');
        return [];
      }

      // OPTIMIZED: Select only essential fields to avoid "Row too big" error
      const { data } = await supabase
        .from('tbl_favorites')
        .select(`
          favoriteID,
          userID,
          aiRecipeID,
          edamamRecipeURI,
          recipeSource,
          recipeData,
          isFavorited,
          notes,
          lastViewed,
          savedAt,
          viewCount
        `)
        .eq('userID', userData.userID)
        .eq('isFavorited', true)
        .order('savedAt', { ascending: false });

      if (!data || data.length === 0) {
        console.log('📭 No saved recipes found');
        return [];
      }

      console.log(`📚 Found ${data.length} saved recipes in database`);

      // Remove duplicates based on recipe source
      const uniqueRecipes = data.reduce((acc, current) => {
        const isDuplicate = acc.find(item => {
          if (current.recipeSource === 'ai') {
            return item.recipeSource === 'ai' && item.aiRecipeID === current.aiRecipeID;
          } else {
            return item.recipeSource === 'edamam' && item.edamamRecipeURI === current.edamamRecipeURI;
          }
        });

        if (!isDuplicate) {
          acc.push(current);
        } else {
          console.log('🔄 Removing duplicate:', {
            source: current.recipeSource,
            id: current.recipeSource === 'ai' ? current.aiRecipeID : current.edamamRecipeURI
          });
        }

        return acc;
      }, []);

      console.log(`✨ After removing duplicates: ${uniqueRecipes.length} recipes`);

      // Fetch full recipe details - OPTIMIZED for speed
      const formattedRecipes = await Promise.all(
        uniqueRecipes.map(async (userRecipe) => {
          if (userRecipe.recipeSource === 'ai') {
            // Fetch full AI recipe from database
            console.log('🤖 Fetching AI recipe:', userRecipe.aiRecipeID);
            const { data: aiRecipe } = await supabase
              .from('tbl_recipes')
              .select('*')
              .eq('recipeID', userRecipe.aiRecipeID)
              .single();

            if (!aiRecipe) {
              console.error('❌ AI recipe not found:', userRecipe.aiRecipeID);
              return null;
            }

            // Format AI recipe to match Edamam structure for recipe-detail compatibility
            const formattedAiRecipe = {
              ...aiRecipe,
              // Core identifiers
              recipeID: aiRecipe.recipeID,
              uri: `souschef://recipe/${aiRecipe.recipeID}`,
              
              // Display fields
              label: aiRecipe.recipeName,
              image: aiRecipe.recipeImage,
              source: 'SousChef AI',
              
              // Ingredient fields
              ingredientLines: aiRecipe.ingredients?.map(ing => 
                `${ing.quantity || ''} ${ing.unit || ''} ${ing.name}${ing.notes ? ` (${ing.notes})` : ''}`.trim()
              ) || [],
              
              // Nutrition fields (already per serving from AI)
              calories: aiRecipe.calories,
              protein: aiRecipe.protein,
              carbs: aiRecipe.carbs,
              fat: aiRecipe.fat,
              
              // Time and serving fields
              totalTime: aiRecipe.cookingTime,
              yield: aiRecipe.servings,
              
              // Labels and categories
              healthLabels: aiRecipe.healthLabels || [],
              dietLabels: aiRecipe.dietLabels || [],
              cautions: aiRecipe.allergens || [],
              cuisineType: aiRecipe.cuisineType ? [aiRecipe.cuisineType] : [],
              mealType: aiRecipe.mealType ? [aiRecipe.mealType] : [],
              dishType: aiRecipe.dishType ? [aiRecipe.dishType] : [],
              
              // Instructions (AI recipes have instructions in database)
              instructions: aiRecipe.instructions || [],
              
              // AI recipe flag
              isCustom: true,
              
              // No external URL for AI recipes
              url: null
            };

            return {
              ...userRecipe,
              recipe: formattedAiRecipe,
              isCustom: true
            };
          } else {
            // ⚡ OPTIMIZED: For Edamam recipes, ALWAYS use cached data for fast loading
            // This eliminates slow API calls and provides instant loading
            console.log('📦 Using cached Edamam recipe:', userRecipe.edamamRecipeURI);
            
            // Parse recipeData if it's a string (JSONB from database)
            let cachedRecipe = userRecipe.recipeData;
            if (typeof cachedRecipe === 'string') {
              try {
                cachedRecipe = JSON.parse(cachedRecipe);
                console.log('✅ Parsed JSONB recipeData');
              } catch (parseError) {
                console.error('❌ Failed to parse recipeData:', parseError);
                cachedRecipe = null;
              }
            }
            
            // 🔄 Check if image URL has expired AWS token
            let imageUrl = cachedRecipe?.image;
            let imageRefreshed = false;
            
            if (imageUrl && imageUrl.includes('X-Amz-Date=')) {
              // Extract the date from the URL
              const dateMatch = imageUrl.match(/X-Amz-Date=(\d{8}T\d{6}Z)/);
              const expiresMatch = imageUrl.match(/X-Amz-Expires=(\d+)/);
              
              if (dateMatch && expiresMatch) {
                const signDate = new Date(
                  dateMatch[1].replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, 
                  '$1-$2-$3T$4:$5:$6Z')
                );
                const expiresSeconds = parseInt(expiresMatch[1]);
                const expiryDate = new Date(signDate.getTime() + expiresSeconds * 1000);
                const now = new Date();
                
                if (now > expiryDate) {
                  console.log('⚠️ Image URL expired, needs refresh:', cachedRecipe.label);
                  imageRefreshed = true;
                  // Mark for async refresh but use cached URL for now
                  imageUrl = null; // Will trigger fallback placeholder
                }
              }
            }
            
            // Debug logging for image issues
            console.log('🔍 Cached recipe data:', {
              hasCachedData: !!cachedRecipe,
              hasImage: !!cachedRecipe?.image,
              imageUrl: imageUrl,
              imageExpired: imageRefreshed,
              label: cachedRecipe?.label,
              dataType: typeof userRecipe.recipeData
            });
            
            // Ensure cached recipe has uri field (critical for favorites)
            if (cachedRecipe && !cachedRecipe.uri && userRecipe.edamamRecipeURI) {
              cachedRecipe.uri = userRecipe.edamamRecipeURI;
              console.log('✅ Added missing URI to cached recipe');
            }
            
            // If image expired, use a flag to indicate refresh needed
            if (imageRefreshed && cachedRecipe) {
              cachedRecipe._imageExpired = true;
            }
            
            return {
              ...userRecipe,
              recipe: cachedRecipe || {
                label: 'Recipe Not Available',
                image: null,
                uri: userRecipe.edamamRecipeURI
              },
              isCustom: false
            };
          }
        })
      );

      // Filter out null results (deleted recipes)
      const validRecipes = formattedRecipes.filter(recipe => recipe !== null);

      console.log(`✅ Successfully formatted ${validRecipes.length} recipes`);
      return validRecipes;
    } catch (error) {
      console.error('💥 Error fetching saved recipes:', error);
      return [];
    }
  }

  /**
   * Track recipe view (supports both Edamam and AI)
   */
  async trackRecipeView(userEmail, recipe) {
    try {
      const { data: userData } = await supabase
        .from('tbl_users')
        .select('userID')
        .eq('userEmail', userEmail)
        .single();

      if (!userData) return;

      const isAIRecipe = recipe.isCustom || recipe.source === 'SousChef AI';

      if (isAIRecipe) {
        // Track AI recipe view
        await supabase.rpc('increment_ai_recipe_view', {
          p_user_id: userData.userID,
          p_recipe_id: recipe.recipeID
        });
      } else {
        // Track Edamam recipe view
        await supabase.rpc('increment_edamam_recipe_view', {
          p_user_id: userData.userID,
          p_recipe_uri: recipe.uri
        });
      }
    } catch (error) {
      console.error('Error tracking view:', error);
    }
  }

  /**
   * Refresh expired Edamam image URLs by fetching fresh data from API
   * This is called asynchronously in the background for better UX
   */
  async refreshExpiredImages(savedRecipes) {
    if (!Array.isArray(savedRecipes)) return savedRecipes;

    const refreshPromises = savedRecipes.map(async (item) => {
      // Skip AI recipes and recipes without expired flag
      if (item.recipeSource === 'ai' || !item.recipe?._imageExpired) {
        return item;
      }

      const uri = item.recipe.uri || item.edamamRecipeURI;
      if (!uri) return item;

      console.log(`🔄 Refreshing image for: ${item.recipe.label}`);

      try {
        const result = await EdamamService.getRecipeByUri(uri);
        
        if (result.success && result.recipe) {
          console.log(`✅ Image refreshed for: ${item.recipe.label}`);
          
          // Update the recipe with fresh data (especially the image URL)
          return {
            ...item,
            recipe: {
              ...item.recipe,
              ...result.recipe,
              _imageExpired: false // Clear the flag
            }
          };
        }
      } catch (error) {
        console.error(`❌ Failed to refresh image for ${item.recipe.label}:`, error);
      }

      // If refresh failed, return original
      return item;
    });

    return await Promise.all(refreshPromises);
  }

  /**
   * MIGRATION: Fix all existing Edamam recipes with expired image URLs
   * Fetches fresh data from Edamam API and updates database with permanent URLs
   * Call this once to migrate existing data
   */
  async migrateExistingEdamamImages(userEmail) {
    try {
      console.log('🔧 Starting image migration for user:', userEmail);
      
      const { data: userData } = await supabase
        .from('tbl_users')
        .select('userID')
        .eq('userEmail', userEmail)
        .single();

      if (!userData) {
        console.error('User not found');
        return { success: false, error: 'User not found' };
      }

      // Get all favorites with Edamam recipes
      const { data: favorites, error: favError } = await supabase
        .from('tbl_favorites')
        .select('*')
        .eq('userID', userData.userID)
        .eq('recipeSource', 'edamam');

      if (favError) throw favError;

      console.log(`📋 Found ${favorites?.length || 0} Edamam favorites to migrate`);

      let migratedCount = 0;
      let failedCount = 0;

      for (const fav of favorites || []) {
        try {
          let recipeData = fav.recipeData;
          
          // Parse if string
          if (typeof recipeData === 'string') {
            recipeData = JSON.parse(recipeData);
          }

          if (!recipeData?.uri) {
            console.log('⏭️ Skipping - no URI');
            continue;
          }

          // Check if image is already permanent (Supabase URL)
          if (recipeData.image?.includes('supabase')) {
            console.log('✅ Already migrated:', recipeData.label);
            migratedCount++;
            continue;
          }

          // ✨ Fetch fresh recipe data from Edamam API using the URI
          console.log(`🔄 Fetching fresh data for: ${recipeData.label}`);
          const freshData = await EdamamService.getRecipeByUri(recipeData.uri);

          if (!freshData.success || !freshData.recipe?.image) {
            console.warn(`⚠️ Could not fetch fresh data for: ${recipeData.label}`);
            failedCount++;
            continue;
          }

          // Download and store the fresh image
          console.log(`📥 Downloading fresh image for: ${recipeData.label}`);
          const permanentUrl = await ImageGenerationService.downloadAndStoreEdamamImage(
            freshData.recipe.image,
            recipeData.uri
          );

          // Update recipe data with fresh image
          recipeData.image = permanentUrl;
          
          // Also update other fields from fresh data
          recipeData.images = freshData.recipe.images || recipeData.images;
          
          const { error: updateError } = await supabase
            .from('tbl_favorites')
            .update({ recipeData: recipeData })
            .eq('favoriteID', fav.favoriteID);

          if (updateError) throw updateError;

          console.log(`✅ Migrated: ${recipeData.label}`);
          migratedCount++;

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
          console.error('❌ Failed to migrate favorite:', error.message);
          failedCount++;
        }
      }

      // Also migrate history
      const { data: history, error: histError } = await supabase
        .from('tbl_recipe_history')
        .select('*')
        .eq('userID', userData.userID);

      if (!histError) {
        console.log(`📋 Found ${history?.length || 0} history items to check`);

        for (const item of history || []) {
          try {
            let recipeData = item.recipeData;
            
            if (typeof recipeData === 'string') {
              recipeData = JSON.parse(recipeData);
            }

            // Only migrate Edamam recipes
            if (!recipeData?.uri || recipeData?.recipeID) continue;
            if (recipeData.image?.includes('supabase')) {
              migratedCount++;
              continue;
            }

            // ✨ Fetch fresh recipe data from Edamam API
            console.log(`🔄 Fetching fresh data for history: ${recipeData.label}`);
            const freshData = await EdamamService.getRecipeByUri(recipeData.uri);

            if (!freshData.success || !freshData.recipe?.image) {
              console.warn(`⚠️ Could not fetch fresh data for: ${recipeData.label}`);
              failedCount++;
              continue;
            }

            console.log(`📥 Downloading fresh image for history: ${recipeData.label}`);
            const permanentUrl = await ImageGenerationService.downloadAndStoreEdamamImage(
              freshData.recipe.image,
              recipeData.uri
            );

            recipeData.image = permanentUrl;
            recipeData.images = freshData.recipe.images || recipeData.images;
            
            const { error: updateError } = await supabase
              .from('tbl_recipe_history')
              .update({ recipeData: recipeData })
              .eq('historyID', item.historyID);

            if (updateError) throw updateError;

            console.log(`✅ Migrated history: ${recipeData.label}`);
            migratedCount++;

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));

          } catch (error) {
            console.error('❌ Failed to migrate history item:', error.message);
            failedCount++;
          }
        }
      }

      console.log(`✅ Migration complete! Migrated: ${migratedCount}, Failed: ${failedCount}`);
      
      return {
        success: true,
        migrated: migratedCount,
        failed: failedCount
      };

    } catch (error) {
      console.error('❌ Migration error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default new RecipeMatcherService();
