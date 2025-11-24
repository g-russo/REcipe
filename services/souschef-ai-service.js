import { supabase } from '../lib/supabase';
import ImageGenerationService from './image-generation-service';
import Constants from 'expo-constants';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// ✅ FIX: Use the same logic as food-recog-api.js
const API_BASE_URL = Constants.expoConfig?.extra?.foodApiUrl ||
  process.env.EXPO_PUBLIC_FOOD_API_URL ||
  'http://54.153.205.43:8000';

console.log('🔧 SousChef API Configuration:');
console.log('📍 API_BASE_URL:', API_BASE_URL);

class SousChefAIService {
  /**
   * Deconstruct a dish into its salvageable ingredients using the backend AI
   * @param {string} foodName - The name of the food/dish
   * @returns {Promise<{is_dish: boolean, ingredients: string[], reasoning: string}>}
   */
  async deconstructDish(foodName) {
    try {
      console.log(`🔍 Deconstructing dish: ${foodName}`);
      console.log(`📡 Using API: ${API_BASE_URL}/deconstruct-dish`);

      const response = await fetch(`${API_BASE_URL}/deconstruct-dish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ food_name: foodName }),
      });

      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Deconstruction result:', data);
      return data;
    } catch (error) {
      console.error('❌ Error deconstructing dish:', error);
      // Fallback: treat as raw ingredient
      return { is_dish: false, ingredients: [foodName], reasoning: 'Error connecting to AI service' };
    }
  }

  // Helper to get OpenAI API key from possible sources embedded at build time
  getOpenAiKey() {
    return (
      process.env.EXPO_PUBLIC_OPENAI_API_KEY ||
      process.env.OPENAI_API_KEY ||
      Constants.expoConfig?.extra?.EXPO_PUBLIC_OPENAI_API_KEY ||
      Constants.expoConfig?.extra?.openaiApiKey ||
      null
    );
  }

  /**
   * Check if similar recipes exist in tbl_recipes (by search query, ingredients, or recipe name)
   */
  async checkExistingRecipes(searchQuery, filters = {}) {
    try {
      console.log('🔍 Checking tbl_recipes for similar recipes:', searchQuery);

      // Search strategy:
      // 1. Exact match on searchQuery
      // 2. Similar recipe names
      // 3. Similar ingredients (using JSONB search)

      // Filter out common words that don't indicate recipe content
      const stopWords = ['generate', 'recipe', 'for', 'with', 'the', 'and', 'make', 'create', 'cook', 'using'];

      // Split search query into meaningful keywords (longer than 3 chars and not stop words)
      const keywords = searchQuery.toLowerCase()
        .split(' ')
        .filter(k => k.length > 3 && !stopWords.includes(k));

      let allRecipes = [];

      // Strategy 1: Search by searchQuery field
      const { data: queryMatches, error: error1 } = await supabase
        .from('tbl_recipes')
        .select('*')
        .ilike('searchQuery', `%${searchQuery}%`)
        .limit(3);

      if (!error1 && queryMatches) {
        allRecipes.push(...queryMatches);
      }

      // Strategy 2: Search by recipe name
      if (allRecipes.length < 3) {
        const { data: nameMatches, error: error2 } = await supabase
          .from('tbl_recipes')
          .select('*')
          .ilike('recipeName', `%${searchQuery}%`)
          .limit(3);

        if (!error2 && nameMatches) {
          // Avoid duplicates
          const newRecipes = nameMatches.filter(
            recipe => !allRecipes.some(r => r.recipeID === recipe.recipeID)
          );
          allRecipes.push(...newRecipes);
        }
      }

      // Strategy 3: Search by ingredients (if we have keywords)
      if (allRecipes.length < 3 && keywords.length > 0) {
        // Search for recipes where ingredients contain any of the keywords
        const { data: allDbRecipes, error: error3 } = await supabase
          .from('tbl_recipes')
          .select('*')
          .limit(50); // Get more recipes to search through

        if (!error3 && allDbRecipes) {
          // Filter recipes that have matching ingredients
          // Score each recipe by how many keywords match
          const scoredMatches = allDbRecipes.map(recipe => {
            const recipeText = `${recipe.recipeName} ${JSON.stringify(recipe.ingredients)}`.toLowerCase();
            const matchCount = keywords.filter(keyword => recipeText.includes(keyword)).length;
            return { recipe, score: matchCount };
          })
            .filter(item => item.score > 0) // Only include recipes with at least one match
            .sort((a, b) => b.score - a.score); // Sort by relevance

          // Avoid duplicates and take top matches
          const newRecipes = scoredMatches
            .map(item => item.recipe)
            .filter(recipe => !allRecipes.some(r => r.recipeID === recipe.recipeID))
            .slice(0, 3);

          allRecipes.push(...newRecipes);
        }
      }

      // Apply filters to results
      if (Object.keys(filters).length > 0 && allRecipes.length > 0) {
        allRecipes = allRecipes.filter(recipe => {
          if (filters.cuisineType && recipe.cuisineType !== filters.cuisineType) {
            return false;
          }
          if (filters.mealType && filters.mealType.length > 0) {
            if (!filters.mealType.includes(recipe.mealType)) {
              return false;
            }
          }
          if (filters.health && filters.health.length > 0) {
            const hasHealth = filters.health.some(h =>
              recipe.healthLabels?.includes(h)
            );
            if (!hasHealth) return false;
          }
          if (filters.diet && filters.diet.length > 0) {
            const hasDiet = filters.diet.some(d =>
              recipe.dietLabels?.includes(d)
            );
            if (!hasDiet) return false;
          }
          return true;
        });
      }

      // Limit to 5 recipes
      allRecipes = allRecipes.slice(0, 5);

      // Update usage count
      if (allRecipes.length > 0) {
        console.log(`✅ Found ${allRecipes.length} existing recipes in tbl_recipes`);

        // Increment usage count for each recipe
        for (const recipe of allRecipes) {
          // Read current count, increment, and update
          const currentCount = recipe.usageCount || 0;
          await supabase
            .from('tbl_recipes')
            .update({
              usageCount: currentCount + 1,
              updatedAt: new Date().toISOString()
            })
            .eq('recipeID', recipe.recipeID);
        }

        return {
          found: true,
          recipes: allRecipes,
          count: allRecipes.length
        };
      }

      console.log('ℹ️ No existing recipes found in tbl_recipes');
      return {
        found: false,
        recipes: [],
        count: 0
      };
    } catch (error) {
      console.error('Error checking existing recipes:', error);
      return { found: false, recipes: [], count: 0 };
    }
  }

  /**
   * Get user's pantry items for recipe personalization
   */
  async getUserPantryItems(userEmail) {
    try {
      const { data: userData, error: userError } = await supabase
        .from('tbl_users')
        .select('userID')
        .eq('userEmail', userEmail)
        .single();

      if (userError || !userData) {
        console.log('No user found:', userError);
        return [];
      }

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
      console.error('Error fetching pantry items:', error);
      return [];
    }
  }

  /**
   * Check if a recipe is duplicate (similar name, ingredients, or instructions)
   */
  async isDuplicateRecipe(newRecipe, existingRecipes) {
    if (!existingRecipes || existingRecipes.length === 0) {
      return false;
    }

    const newRecipeName = newRecipe.recipeName.toLowerCase();
    const newIngredients = newRecipe.ingredients.map(ing => ing.name.toLowerCase()).sort();
    const newInstructions = newRecipe.instructions.map(inst => inst.instruction.toLowerCase()).join(' ');

    for (const existing of existingRecipes) {
      // Check 1: Recipe name similarity (exact match or very similar)
      const existingName = existing.recipeName?.toLowerCase() || existing.label?.toLowerCase() || '';

      // Exact match
      if (existingName === newRecipeName) {
        console.log('⚠️ Duplicate detected: Exact recipe name match');
        return true;
      }

      // Very similar names (70%+ word overlap)
      const newWords = newRecipeName.split(' ').filter(w => w.length > 3);
      const existingWords = existingName.split(' ').filter(w => w.length > 3);
      const commonWords = newWords.filter(w => existingWords.includes(w));
      const nameSimilarity = commonWords.length / Math.max(newWords.length, 1);

      if (nameSimilarity >= 0.7) {
        console.log(`⚠️ Duplicate detected: ${(nameSimilarity * 100).toFixed(0)}% name similarity`);
        return true;
      }

      // Check 2: Ingredient similarity (80% or more ingredients match)
      const existingIngredients = existing.ingredients
        ? (Array.isArray(existing.ingredients)
          ? existing.ingredients.map(ing => ing.name?.toLowerCase() || ing.toString().toLowerCase()).sort()
          : [])
        : [];

      if (existingIngredients.length > 0 && newIngredients.length > 0) {
        const matchingIngredients = newIngredients.filter(ing =>
          existingIngredients.some(existIng =>
            existIng.includes(ing) || ing.includes(existIng)
          )
        );
        const similarityPercentage = (matchingIngredients.length / newIngredients.length) * 100;

        // Stricter threshold: 70% match = duplicate (was 80%)
        if (similarityPercentage >= 70) {
          console.log(`⚠️ Duplicate detected: ${similarityPercentage.toFixed(0)}% ingredient match`);
          return true;
        }
      }

      // Check 3: Instruction similarity (if instructions exist)
      if (existing.instructions && Array.isArray(existing.instructions) && existing.instructions.length > 0) {
        const existingInstructions = existing.instructions
          .map(inst => inst.instruction?.toLowerCase() || inst.toString().toLowerCase())
          .join(' ');

        // Simple similarity check: count matching words
        const newWords = newInstructions.split(' ').filter(w => w.length > 3);
        const existingWords = existingInstructions.split(' ').filter(w => w.length > 3);
        const matchingWords = newWords.filter(word => existingWords.includes(word));
        const instructionSimilarity = (matchingWords.length / newWords.length) * 100;

        // Stricter: 60% instruction match = duplicate (was 70%)
        if (instructionSimilarity >= 60) {
          console.log(`⚠️ Duplicate detected: ${instructionSimilarity.toFixed(0)}% instruction match`);
          return true;
        }
      }

      // Check 4: Cooking method similarity
      const cookingMethods = ['grilled', 'fried', 'baked', 'steamed', 'boiled', 'roasted', 'stir-fry', 'sautéed'];
      const newMethod = cookingMethods.find(method =>
        newRecipeName.includes(method) || newInstructions.includes(method)
      );
      const existingMethod = cookingMethods.find(method =>
        existingName.includes(method) ||
        (existing.instructions && JSON.stringify(existing.instructions).toLowerCase().includes(method))
      );

      if (newMethod && existingMethod && newMethod === existingMethod && nameSimilarity >= 0.5) {
        console.log(`⚠️ Duplicate detected: Same cooking method (${newMethod}) with similar name`);
        return true;
      }
    }

    console.log('✅ Recipe is unique - no duplicates detected');
    return false;
  }

  /**
   * Get all existing recipes for current search (for duplicate detection)
   */
  async getExistingRecipesForSearch(searchQuery) {
    try {
      // Get recipes from database with same search query
      const { data, error } = await supabase
        .from('tbl_recipes')
        .select('*')
        .ilike('searchQuery', `%${searchQuery}%`)
        .limit(20);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching existing recipes:', error);
      return [];
    }
  }

  /**
   * Generate a SINGLE recipe (faster response, better UX) with duplicate detection
   */
  async generateSingleRecipe(searchQuery, filters = {}, pantryItems = [], existingCount = 0, existingRecipesInUI = []) {
    try {
      console.log(`🤖 Generating 1 recipe with SousChef AI (${existingCount + 1}/5)...`);
      console.log(`🎯 PRIMARY FOCUS: "${searchQuery}" (this will be the main ingredient/dish)`);
      console.log(`📦 Supporting ingredients: ${pantryItems.length} pantry items`);
      const apiKey = this.getOpenAiKey();
      console.log('📝 API Key Status:', apiKey ? `Loaded (${String(apiKey).substring(0, 10)}...)` : '❌ Missing');

      // Build prompt for 1 recipe only (search query is prioritized)
      const prompt = this.buildRecipePrompt(searchQuery, filters, pantryItems, 1);

      console.log('📤 Sending request to OpenAI API...');
      const startTime = Date.now();

      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are SousChef AI, an expert recipe creator. Always return valid JSON only, no additional text.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.8,
          max_tokens: 2000, // Reduced for single recipe
          response_format: { type: 'json_object' }
        })
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`⏱️ API Response received in ${duration}s (Status: ${response.status})`);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ OpenAI API Error:', errorData.error);
        throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
      }

      const aiResponse = await response.json();
      const recipesData = JSON.parse(aiResponse.choices[0].message.content);

      console.log('✅ Generated 1 recipe');

      // Check for duplicates before saving
      const newRecipe = recipesData.recipes[0];

      // Get existing recipes from database
      const existingDbRecipes = await this.getExistingRecipesForSearch(searchQuery);

      // Combine with recipes already in UI (from this session)
      const allExistingRecipes = [...existingDbRecipes, ...existingRecipesInUI];

      // Check if this recipe is a duplicate
      const isDuplicate = await this.isDuplicateRecipe(newRecipe, allExistingRecipes);

      if (isDuplicate) {
        console.log('⚠️ Duplicate recipe detected, regenerating with different approach...');

        // Retry with explicit uniqueness instructions
        const retryPrompt = this.buildRecipePrompt(searchQuery, filters, pantryItems, 1);
        const existingRecipeNames = allExistingRecipes.map(r => r.recipeName || r.label).slice(0, 10).join('\n- ');
        const existingIngredients = allExistingRecipes.slice(0, 3).map(r => {
          const ingredients = r.ingredients || r.ingredientLines || [];
          const ingredientNames = Array.isArray(ingredients)
            ? ingredients.map(ing => ing.name || ing.toString()).slice(0, 5).join(', ')
            : '';
          return `${r.recipeName || r.label}: ${ingredientNames}`;
        }).join('\n  ');

        const retryInstructions = `\n\n🚨 CRITICAL: AVOID DUPLICATES!\n\n❌ DO NOT CREATE THESE RECIPES (already exist):\n- ${existingRecipeNames}\n\n❌ DO NOT USE THESE INGREDIENT COMBINATIONS:\n  ${existingIngredients}\n\n✅ REQUIREMENTS FOR NEW RECIPE:\n1. COMPLETELY different recipe name\n2. DIFFERENT cooking method (if they grilled, you stir-fry/bake/steam)\n3. DIFFERENT ingredient combinations\n4. DIFFERENT cuisine style (if they have Filipino, try Asian fusion/Western/International)\n5. DIFFERENT presentation style\n\n🎯 Still center the recipe around "${searchQuery}" but make it UNIQUE!\n\nExample: If existing recipes are grilled/fried, create a soup/stew/curry/casserole instead.`;

        const retryResponse = await fetch(OPENAI_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'You are SousChef AI, an expert recipe creator. Always return valid JSON only, no additional text. CREATE UNIQUE AND DIFFERENT RECIPES.'
              },
              {
                role: 'user',
                content: retryPrompt + retryInstructions
              }
            ],
            temperature: 1.0, // Higher temperature = more creativity
            max_tokens: 2000,
            response_format: { type: 'json_object' }
          })
        });

        if (retryResponse.ok) {
          const retryAiResponse = await retryResponse.json();
          const retryRecipesData = JSON.parse(retryAiResponse.choices[0].message.content);
          const retryRecipe = retryRecipesData.recipes[0];

          // Verify the retry recipe is actually unique
          const stillDuplicate = await this.isDuplicateRecipe(retryRecipe, allExistingRecipes);

          if (!stillDuplicate) {
            recipesData.recipes = retryRecipesData.recipes; // Use the new unique recipe
            console.log(`✅ Generated unique recipe on retry: "${retryRecipe.recipeName}"`);
          } else {
            console.log(`⚠️ Retry recipe "${retryRecipe.recipeName}" still duplicate, using anyway (user can generate another)`);
            recipesData.recipes = retryRecipesData.recipes; // Use it anyway, let user try again
          }
        } else {
          console.log('⚠️ Retry failed, using original recipe anyway');
        }
      }

      // Persist the recipe immediately so the UI can render metadata fast.
      // Image generation is kicked off in the background and will update the DB when ready.
      console.log('⚡ Saving recipe to database (fast) and returning to UI before image generation...');
      const savedRecipes = await this.saveRecipesToDatabase(recipesData.recipes, searchQuery, filters);

      const recipeToReturn = {
        ...savedRecipes[0],
        image: savedRecipes[0].recipeImage || null,
        recipeImage: savedRecipes[0].recipeImage || null
      };

      // Background image generation (non-blocking)
      (async () => {
        try {
          console.log('🎨 [Background] Generating image for:', recipeToReturn.recipeName);
          const imagePrompt = recipesData.recipes[0].imagePrompt || recipesData.recipes[0].recipeName;
          const imageUrl = await ImageGenerationService.generateAndStoreRecipeImage(
            recipeToReturn.recipeID || `temp-${Date.now()}`,
            imagePrompt,
            recipeToReturn.recipeName
          );

          // Update database record with generated image URL
          const { error: updateError } = await supabase
            .from('tbl_recipes')
            .update({ recipeImage: imageUrl })
            .eq('recipeID', recipeToReturn.recipeID);

          if (updateError) {
            console.error('❌ Failed to update recipe with image URL:', updateError);
          } else {
            console.log('✅ [Background] Image URL saved to DB:', imageUrl);
          }
        } catch (bgError) {
          console.error('⚠️ [Background] Image generation/update failed:', bgError.message || bgError);
        }
      })();

      console.log(`✅ Recipe saved and returned to UI: "${recipeToReturn.recipeName}"`);

      return {
        success: true,
        recipe: recipeToReturn,
        count: 1
      };
    } catch (error) {
      console.error('Error generating single recipe:', error);
      return {
        success: false,
        recipe: null,
        count: 0,
        error: error.message
      };
    }
  }

  /**
   * Generate custom recipes using ChatGPT with image generation (LEGACY - generates 5 at once)
   */
  async generateCustomRecipes(searchQuery, filters = {}, pantryItems = []) {
    try {
      console.log('🤖 Generating recipes with SousChef AI...');
      const apiKey = this.getOpenAiKey();
      console.log('📝 API Key Status:', apiKey ? `Loaded (${String(apiKey).substring(0, 10)}...)` : '❌ Missing');

      // Step 1: Generate recipe content
      const prompt = this.buildRecipePrompt(searchQuery, filters, pantryItems);

      console.log('📤 Sending request to OpenAI API...');
      const startTime = Date.now();

      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini', // Updated model - cheaper and faster than GPT-4 Turbo
          messages: [
            {
              role: 'system',
              content: 'You are SousChef AI, an expert recipe creator. Always return valid JSON only, no additional text.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.8,
          max_tokens: 4000,
          response_format: { type: 'json_object' }
        })
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`⏱️ API Response received in ${duration}s (Status: ${response.status})`);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ OpenAI API Error:', errorData.error);
        throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
      }

      const aiResponse = await response.json();
      const recipesData = JSON.parse(aiResponse.choices[0].message.content);

      console.log('✅ Generated', recipesData.recipes.length, 'recipes');

      // Step 2: Save recipes to database (without images first)
      const savedRecipes = await this.saveRecipesToDatabase(
        recipesData.recipes,
        searchQuery,
        filters
      );

      console.log('✅ Saved recipes to database');

      // Step 3: Generate and store images for each recipe
      console.log('🎨 Generating images...');
      const recipesWithImages = await this.addImagesToRecipes(savedRecipes);

      // Step 4: Update database with image URLs
      await this.updateRecipeImages(recipesWithImages);

      console.log('✅ Complete! All recipes generated with images');

      return {
        success: true,
        recipes: recipesWithImages,
        count: recipesWithImages.length
      };
    } catch (error) {
      console.error('Error generating recipes:', error);
      return {
        success: false,
        recipes: [],
        count: 0,
        error: error.message
      };
    }
  }

  /**
   * Generate 5 recipe suggestions based on search query and pantry items
   * @returns {Promise<{success: boolean, suggestions: string[]}>}
   */
  async generateRecipeSuggestions(searchQuery, filters = {}, pantryItems = []) {
    try {
      console.log(`🤖 Generating recipe suggestions for "${searchQuery}"...`);
      const apiKey = this.getOpenAiKey();
      
      if (!apiKey) {
        console.error('❌ OpenAI API key not found');
        return { success: false, suggestions: [], error: 'API key missing' };
      }

      let prompt = `You are SousChef AI. The user wants to cook something with "${searchQuery}".
      
      Based on the search query "${searchQuery}" and their pantry items (if any), suggest 5 distinct, creative, and appetizing recipe titles.
      
      CRITICAL:
      1. The recipes MUST feature "${searchQuery}" as the main component or theme.
      2. If "${searchQuery}" is a list of ingredients, find recipes that combine them.
      3. Provide variety (e.g., different cooking methods, cuisines).
      
      `;

      if (pantryItems.length > 0) {
        prompt += `Available Pantry Items: ${pantryItems.slice(0, 30).map(i => i.itemName).join(', ')}\n`;
      }

      prompt += `
      Return ONLY a JSON object with this exact format:
      {
        "suggestions": [
          "Recipe Title 1",
          "Recipe Title 2",
          "Recipe Title 3",
          "Recipe Title 4",
          "Recipe Title 5"
        ]
      }`;

      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are SousChef AI. Respond ONLY with valid JSON.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.8,
          max_tokens: 500,
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const content = JSON.parse(data.choices[0].message.content);
      
      console.log('✅ Generated suggestions:', content.suggestions);
      return { success: true, suggestions: content.suggestions };

    } catch (error) {
      console.error('❌ Error generating suggestions:', error);
      return { success: false, suggestions: [], error: error.message };
    }
  }

  /**
   * Build prompt for recipe generation (matches Custom GPT instructions)
   */
  buildRecipePrompt(searchQuery, filters, pantryItems, recipeCount = 5) {
    // System instructions matching your Custom GPT
    let prompt = `You are SousChef AI, an expert culinary assistant that generates ${recipeCount} personalized ${recipeCount === 1 ? 'recipe' : 'recipes'}.

## PRIMARY OBJECTIVE
🎯 CREATE RECIPES CENTERED AROUND THE SEARCH QUERY: "${searchQuery}"

## CULINARY STANDARDS & QUALITY CONTROL (STRICTLY ENFORCED)
1. **General Standards**: Ensure all recipes follow standard culinary practices. Do not generate "weird" or unappetizing combinations.
2. **Ingredient Logic**: Only use ingredients that chemically and flavor-wise make sense together. If the user provides a list of clashing ingredients, prioritize the main protein/vegetable and IGNORE the ones that would ruin the dish.
3. **Procedure Logic**: The cooking procedure must be logical and follow best practices.
4. **Edibility**: The final result must be something a reasonable person would want to eat.
5. **Best Fit**: Analyze the input. If it's a list of random ingredients, find the *best possible* standard dish that uses the most important ones.

⚠️ CRITICAL REQUIREMENTS:
1. The recipe MUST be directly related to "${searchQuery}"
2. "${searchQuery}" should be the MAIN ingredient, dish name, or primary focus
3. If the recipe is for a dish/leftover:
   - It must be deconstructed first into its main components (protein, carbs, veggies, sauce) and ingredients (tomato, onion, ketchup, etc.) before searching for recipes
4. If "${searchQuery}" is a specific ingredient (e.g., "kabayo", "chicken", "beef"):
   - It MUST be the primary protein/ingredient in the recipe
   - Recipe name should feature "${searchQuery}" prominently
   - Do NOT substitute with other ingredients
5. Use pantry items as SUPPORTING ingredients only
6. If pantry doesn't have "${searchQuery}", assume user will buy it - STILL create recipe with it
7. If "${searchQuery}" contains multiple ingredients:
   - Create a cohesive dish that combines them logically.
   - If ingredients clash, prioritize the main protein and discard incompatible ones.

## CURRENT REQUEST
Search Query: "${searchQuery}" ← THIS IS THE STAR OF THE RECIPE!
`;

    // Add filters
    if (Object.keys(filters).length > 0) {
      prompt += '\n## FILTER REQUIREMENTS (STRICTLY FOLLOW)\n';
      if (filters.cuisineType) {
        prompt += `- Cuisine Type: ${filters.cuisineType} (ONLY generate from this cuisine)\n`;
      }
      if (filters.mealType && filters.mealType.length) {
        prompt += `- Meal Type: ${filters.mealType.join(', ')}\n`;
      }
      if (filters.dishType && filters.dishType.length) {
        prompt += `- Dish Type: ${filters.dishType.join(', ')}\n`;
      }
      if (filters.health && filters.health.length) {
        prompt += `- Health Labels: ${filters.health.join(', ')} (STRICTLY respect these dietary restrictions)\n`;
      }
      if (filters.diet && filters.diet.length) {
        prompt += `- Diet: ${filters.diet.join(', ')}\n`;
      }
      if (filters.time) {
        prompt += `- Max Time: ${filters.time} minutes (totalTime must no\t exceed this)\n`;
      }
      if (filters.excluded && filters.excluded.length) {
        prompt += `- EXCLUDED Ingredients: ${filters.excluded.join(', ')} (NEVER include these)\n`;
      }
    }

    // Add pantry items with leftover detection
    if (pantryItems.length > 0) {
      prompt += '\n## AVAILABLE PANTRY ITEMS (Use as SUPPORTING ingredients)\n';
      prompt += `⚠️ Remember: "${searchQuery}" is the MAIN focus. Use these pantry items to complement it.\n`;

      const leftoverItems = [];
      const freshItems = [];

      pantryItems.slice(0, 20).forEach(item => {
        const isLeftover = item.itemCategory &&
          (item.itemCategory.toLowerCase().includes('leftover') ||
            item.itemCategory.toLowerCase().includes('cooked'));

        if (isLeftover) {
          leftoverItems.push(item);
        } else {
          freshItems.push(item);
        }
      });

      if (leftoverItems.length > 0) {
        prompt += '\n### 🍲 LEFTOVER/COOKED FOODS (PRIORITIZE THESE):\n';
        leftoverItems.forEach(item => {
          prompt += `- ${item.itemName} (${item.quantity} ${item.unit || ''})\n`;
        });

        prompt += `\n⚠️ LEFTOVER TRANSFORMATION RULES:\n`;
        prompt += `1. Recognize these as PREPARED DISHES, not raw ingredients\n`;
        prompt += `2. Generate recipes that USE leftovers as KEY INGREDIENTS\n`;
        prompt += `3. Examples:\n`;
        prompt += `   - Leftover Adobo → Adobo Fried Rice, Adobo Tacos, Adobo Spring Rolls\n`;
        prompt += `   - Leftover Caldereta → Caldereta Empanada, Caldereta Quesadilla, Shepherd's Pie\n`;
        prompt += `   - Leftover Sinigang → Sinigang Noodle Soup, Sinigang Fried Rice\n`;
        prompt += `   - ANY Leftover Meat → Tacos, Sandwiches, Fried Rice, Pasta, Salad\n`;
        prompt += `   - ANY Leftover Stew → Empanada, Quesadilla, Pot Pie, Pasta Sauce\n`;
        prompt += `4. List leftover as ingredient (e.g., "2 cups leftover adobo, shredded")\n`;
        prompt += `5. Minimize additional ingredients for convenience\n`;
        prompt += `6. Focus on ZERO FOOD WASTE\n\n`;
      }

      if (freshItems.length > 0) {
        prompt += '### 🥬 FRESH INGREDIENTS:\n';
        freshItems.forEach(item => {
          prompt += `- ${item.itemName} (${item.quantity} ${item.unit || ''})\n`;
        });
        prompt += '\n';
      }
    } else {
      prompt += '\n## NO PANTRY ITEMS PROVIDED\n';
      prompt += `Generate creative recipes centered around "${searchQuery}". Assume user can buy any needed ingredients.\n\n`;
    }

    // JSON output format
    prompt += `## REQUIRED OUTPUT FORMAT
Generate EXACTLY ${recipeCount} ${recipeCount === 1 ? 'recipe' : 'recipes'} with this structure:

CRITICAL NUTRITION CALCULATION RULES:
- All nutritional values MUST be calculated PER SERVING
- Use standard USDA nutrition database values for ingredients
- Round all values to whole numbers (no decimals)
- Calories should be in KCAL (kilocalories), labeled as "kcal"
- Use these formulas for calculating macros:
  * Protein: Sum all ingredient proteins ÷ servings
  * Carbs: Sum all ingredient carbs ÷ servings  
  * Fat: Sum all ingredient fats ÷ servings
  * Calories: (Protein × 4) + (Carbs × 4) + (Fat × 9) ÷ servings
- Be accurate and realistic with portion sizes
- Account for cooking methods (e.g., fried adds fat, boiled doesn't)

{
  "recipes": [
    {
      "recipeName": "Clear, appetizing name",
      "recipeDescription": "2-3 sentences describing the dish",
      "cuisineType": "Filipino/Asian/Western/Fusion",
      "mealType": "breakfast/lunch/dinner/snack",
      "dishType": "main/side/dessert/appetizer/soup/salad",
      "cookingTime": number (total minutes),
      "servings": number,
      "calories": number (TOTAL kcal per serving - must be realistic),
      "protein": number (grams per serving - must match standard food values),
      "carbs": number (grams per serving - must match standard food values),
      "fat": number (grams per serving - must match standard food values),
      "difficulty": "Easy/Medium/Hard",
      "ingredients": [
        {
          "name": "ingredient name",
          "quantity": number,
          "unit": "measurement unit",
          "notes": "optional preparation notes"
        }
      ],
      "instructions": [
        {
          "step": 1,
          "instruction": "Clear, detailed instruction",
          "time": number (optional, minutes for this step)
        }
      ],
      "healthLabels": ["vegetarian", "gluten-free", etc.],
      "dietLabels": ["balanced", "high-protein", etc.],
      "allergens": ["dairy", "nuts", etc.],
      "imagePrompt": "Detailed description for professional food photography: [recipe name], appetizing presentation, natural lighting, clean background, 4k quality"
    }
  ]
}

Return ONLY valid JSON. No additional text.`;

    return prompt;
  }

  /**
   * Save recipes to database (without images initially)
   */
  async saveRecipesToDatabase(recipes, searchQuery, filters) {
    try {
      const recipesToInsert = recipes.map(recipe => ({
        recipeName: recipe.recipeName,
        recipeDescription: recipe.recipeDescription,
        recipeImage: null, // Will be updated after image generation
        cuisineType: recipe.cuisineType,
        mealType: recipe.mealType,
        dishType: recipe.dishType,
        cookingTime: recipe.cookingTime,
        servings: recipe.servings,
        calories: recipe.calories,
        protein: recipe.protein || 0,
        carbs: recipe.carbs || 0,
        fat: recipe.fat || 0,
        difficulty: recipe.difficulty || 'Medium',
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
        healthLabels: recipe.healthLabels || [],
        dietLabels: recipe.dietLabels || [],
        allergens: recipe.allergens || [],
        // Note: cookingTips removed - not in database schema
        searchQuery: searchQuery,
        filters: filters || {},
        generatedBy: 'SousChef AI',
        usageCount: 1
      }));

      const { data, error } = await supabase
        .from('tbl_recipes')
        .insert(recipesToInsert)
        .select();

      if (error) throw error;

      // Merge image prompts back into saved recipes and format for display
      return data.map((savedRecipe, index) => ({
        ...savedRecipe,
        imagePrompt: recipes[index].imagePrompt,
        // Add fields to match Edamam structure for recipe-detail compatibility
        ingredientLines: savedRecipe.ingredients.map(ing =>
          `${ing.quantity || ''} ${ing.unit || ''} ${ing.name}${ing.notes ? ` (${ing.notes})` : ''}`.trim()
        ),
        yield: savedRecipe.servings,
        totalTime: savedRecipe.cookingTime,
        source: 'SousChef AI',
        url: null, // AI recipes don't have external URLs
        uri: `souschef://recipe/${savedRecipe.recipeID}`,
        label: savedRecipe.recipeName,
        image: null, // Will be updated with image URL
        isCustom: true,
        cautions: savedRecipe.allergens || []
      }));
    } catch (error) {
      console.error('Error saving recipes:', error);
      throw error;
    }
  }

  /**
   * Generate images for recipes using DALL-E and store in Supabase
   */
  async addImagesToRecipes(recipes) {
    const recipesWithImages = [];

    for (const recipe of recipes) {
      try {
        console.log(`🎨 Generating image for: ${recipe.recipeName}`);

        const imageUrl = await ImageGenerationService.generateAndStoreRecipeImage(
          recipe.recipeID,
          recipe.imagePrompt || recipe.recipeName,
          recipe.recipeName
        );

        recipesWithImages.push({
          ...recipe,
          recipeImage: imageUrl
        });

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.warn(`Image generation failed for ${recipe.recipeName}:`, error.message);
        recipesWithImages.push({
          ...recipe,
          recipeImage: ImageGenerationService.getFallbackImage()
        });
      }
    }

    return recipesWithImages;
  }

  /**
   * Update recipe records with generated image URLs
   */
  async updateRecipeImages(recipes) {
    try {
      for (const recipe of recipes) {
        if (recipe.recipeImage) {
          await supabase
            .from('tbl_recipes')
            .update({
              recipeImage: recipe.recipeImage,
              updatedAt: new Date().toISOString()
            })
            .eq('recipeID', recipe.recipeID);
        }
      }
    } catch (error) {
      console.error('Error updating recipe images:', error);
    }
  }

  /**
   * Validate if a search term is a valid food ingredient or dish
   * @param {string} searchTerm - The search term to validate
   * @returns {Promise<{isValid: boolean, reason: string}>}
   */
  async validateFoodIngredient(searchTerm) {
    try {
      console.log(`🔍 Validating food ingredient: "${searchTerm}"`);

      const apiKey = this.getOpenAiKey();
      if (!apiKey) {
        console.error('❌ OpenAI API key not found');
        return { isValid: true, reason: 'Validation skipped - API key missing' };
      }

      const validationPrompt = `Is "${searchTerm}" a valid food ingredient, dish name, or cuisine type that can be used to create a recipe?

Respond with ONLY a JSON object in this exact format:
{
  "isValid": true/false,
  "reason": "brief explanation"
}

Guidelines:
- Return isValid: true for: food ingredients (chicken, rice, tomato), dishes (adobo, pasta, curry), cuisines (Filipino, Italian), cooking methods with food (grilled fish)
- Return isValid: false for: gibberish, random text, non-food items, profanity, names of people/places unrelated to food
- Be lenient with misspellings of real food terms
- Consider Filipino, Asian, and international food terms

Examples:
"bangus" → {"isValid": true, "reason": "Bangus (milkfish) is a common Filipino fish"}
"asdfgh" → {"isValid": false, "reason": "Not a recognizable food term"}
"table" → {"isValid": false, "reason": "Not a food ingredient or dish"}
"beef tapa" → {"isValid": true, "reason": "Filipino cured or smoked beef dish"}`;

      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a food ingredient validator. Respond ONLY with valid JSON.'
            },
            {
              role: 'user',
              content: validationPrompt
            }
          ],
          temperature: 0.3, // Low temperature for consistent validation
          max_tokens: 100
        })
      });

      if (!response.ok) {
        console.error(`❌ OpenAI API error: ${response.status}`);
        return { isValid: true, reason: 'Validation skipped - API error' };
      }

      const data = await response.json();
      const content = data.choices[0].message.content.trim();

      // Parse JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const validation = JSON.parse(jsonMatch[0]);
        console.log(`✅ Validation result:`, validation);
        return validation;
      }

      console.warn('⚠️ Could not parse validation response:', content);
      return { isValid: true, reason: 'Validation inconclusive' };
    } catch (error) {
      console.error('❌ Validation error:', error);
      // Fail-safe: If validation fails, allow generation
      return { isValid: true, reason: 'Validation error - proceeding with generation' };
    }
  }

  /**
   * Predict the best category and estimated shelf life for an item using AI
   * @param {string} itemName - The name of the item
   * @param {string} [imageBase64] - Optional base64 image string for visual context
   * @returns {Promise<{category: string, shelfLifeDays: number, reasoning: string}>}
   */
  async predictItemDetails(itemName, imageBase64 = null) {
    try {
      console.log(`🔮 Predicting details for: "${itemName}" ${imageBase64 ? '(with image)' : ''}`);

      const apiKey = this.getOpenAiKey();
      if (!apiKey) {
        console.error('❌ OpenAI API key not found');
        return { category: 'Other', shelfLifeDays: 7, reasoning: 'API key missing' };
      }

      const prompt = `Act as a food safety expert. Perform a deep analysis of the food item '${itemName}' ${imageBase64 ? 'and the provided image' : ''} to determine its optimal inventory category and precise shelf life.

Research & Analysis Steps:
1. **Identify**: Determine the exact specific type of food and its state (e.g., "Sliced vs Whole", "Cooked vs Raw", "Ripe vs Unripe").
2. **Consult Guidelines**: Apply standard food safety data (USDA/FDA) for this specific item.
3. **Visual Inspection**: If an image is provided, analyze for signs of spoilage (bruising, discoloration) or packaging (vacuum sealed, open can) to adjust the estimate.

Respond with ONLY a JSON object in this exact format:
{
  "category": "String",
  "shelfLifeDays": Number,
  "reasoning": "String"
}

Constraints:
1. **Category**: MUST be one of: ['Rice', 'Soup', 'Leftovers', 'Kakanin', 'Baking', 'Beverages', 'Canned', 'Jarred', 'Condiments', 'Sauces', 'Dairy', 'Eggs', 'Fruits', 'Frozen', 'Grains', 'Pasta', 'Noodles', 'Meat', 'Poultry', 'Seafood', 'Snacks', 'Spices', 'Herbs', 'Vegetables', 'Other']
2. **Shelf Life Logic**:
   - **Prioritize Specificity**: Look up the specific item's shelf life (e.g., "Strawberries: 3-7 days" vs "Fruit: 14 days").
   - **Condition Matters**: "Cut/Peeled" items expire much faster than "Whole".
   - **Leftovers**: Strictly 3-4 days for safety.
   - **Pantry**: Dry goods (Rice, Pasta) = 365+ days.
   - **Canned/Jarred**: If unopened (based on visual), use long duration (1-2 years). If looks opened, treat as perishable.

Examples:
"Apple" -> {"category": "Fruits", "shelfLifeDays": 21, "reasoning": "Whole apples last 3-4 weeks in fridge (USDA)"}
"Cut Apple" -> {"category": "Fruits", "shelfLifeDays": 3, "reasoning": "Cut fruit oxidizes quickly, 3-5 days max"}
"Chicken Adobo" -> {"category": "Leftovers", "shelfLifeDays": 4, "reasoning": "Cooked meat dishes are safe for 3-4 days (USDA)"}
"Fresh Salmon" -> {"category": "Seafood", "shelfLifeDays": 2, "reasoning": "Raw fish is highly perishable, 1-2 days"}
"Canned Corn" -> {"category": "Canned", "shelfLifeDays": 730, "reasoning": "Commercially canned goods last 2-5 years"}
"Milk (Opened)" -> {"category": "Dairy", "shelfLifeDays": 7, "reasoning": "Opened milk lasts ~7 days past sell-by"}`;

      const messages = [
        {
          role: 'system',
          content: 'You are an expert food inventory assistant. Respond ONLY with valid JSON.'
        },
        {
          role: 'user',
          content: imageBase64 ? [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: 'low'
              }
            }
          ] : prompt
        }
      ];

      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: messages,
          temperature: 0.3,
          max_tokens: 300,
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        console.error(`❌ OpenAI API error: ${response.status}`);
        return { category: 'Other', shelfLifeDays: 7 };
      }

      const data = await response.json();
      const content = data.choices[0].message.content.trim();
      const prediction = JSON.parse(content);

      console.log(`✅ Prediction result:`, prediction);
      return prediction;

    } catch (error) {
      console.error('❌ Prediction error:', error);
      return { category: 'Other', shelfLifeDays: 7 };
    }
  }
}

export default new SousChefAIService();
