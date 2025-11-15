import { supabase } from '../lib/supabase';
// Remove @env import - use process.env for EAS compatibility
import ImageGenerationService from './image-generation-service';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

class SousChefAIService {
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
      
      // Split search query into keywords
      const keywords = searchQuery.toLowerCase().split(' ').filter(k => k.length > 2);
      
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
          const ingredientMatches = allDbRecipes.filter(recipe => {
            const ingredientsStr = JSON.stringify(recipe.ingredients).toLowerCase();
            return keywords.some(keyword => ingredientsStr.includes(keyword));
          });

          // Avoid duplicates
          const newRecipes = ingredientMatches.filter(
            recipe => !allRecipes.some(r => r.recipeID === recipe.recipeID)
          ).slice(0, 3);

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
      // Check 1: Recipe name similarity (exact match or very close)
      const existingName = existing.recipeName?.toLowerCase() || existing.label?.toLowerCase() || '';
      if (existingName === newRecipeName) {
        console.log('⚠️ Duplicate detected: Exact recipe name match');
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
        
        if (similarityPercentage >= 80) {
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

        if (instructionSimilarity >= 70) {
          console.log(`⚠️ Duplicate detected: ${instructionSimilarity.toFixed(0)}% instruction match`);
          return true;
        }
      }
    }

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
      console.log('📝 API Key Status:', process.env.OPENAI_API_KEY ? `Loaded (${process.env.OPENAI_API_KEY.substring(0, 10)}...)` : '❌ Missing');

      // Build prompt for 1 recipe only
      const prompt = this.buildRecipePrompt(searchQuery, filters, pantryItems, 1);

      console.log('📤 Sending request to OpenAI API...');
      const startTime = Date.now();

      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
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
        console.log('⚠️ Duplicate recipe detected, regenerating with higher temperature...');
        
        // Retry with higher temperature (more creativity) and explicit instruction
        const retryPrompt = this.buildRecipePrompt(searchQuery, filters, pantryItems, 1);
        const retryInstructions = `\n\n⚠️ IMPORTANT: Generate a COMPLETELY DIFFERENT recipe than these existing ones:\n${allExistingRecipes.map(r => `- ${r.recipeName || r.label}`).slice(0, 5).join('\n')}\n\nUse different ingredients, cooking methods, and cuisines. BE CREATIVE AND UNIQUE!`;

        const retryResponse = await fetch(OPENAI_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
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
          recipesData.recipes = retryRecipesData.recipes; // Use the new unique recipe
          console.log('✅ Generated unique recipe on retry');
        } else {
          console.log('⚠️ Retry failed, using original recipe anyway');
        }
      }

      // ⚡ OPTIMIZATION: Run database save and image generation in PARALLEL
      console.log('⚡ Running parallel operations: DB save + Image generation...');
      const parallelStart = Date.now();

      const [savedRecipes, imageGenerationResult] = await Promise.all([
        // Operation 1: Save recipe to database (fast - ~500ms)
        this.saveRecipesToDatabase(recipesData.recipes, searchQuery, filters),
        
        // Operation 2: Generate image (slow - ~20s)
        (async () => {
          try {
            console.log('🎨 [Parallel] Generating image...');
            const recipe = recipesData.recipes[0];
            const imageUrl = await ImageGenerationService.generateAndStoreRecipeImage(
              'temp', // Will update with real ID after save
              recipe.imagePrompt,
              recipe.recipeName
            );
            console.log('✅ [Parallel] Image generated');
            return imageUrl;
          } catch (error) {
            console.error('⚠️ [Parallel] Image generation failed:', error.message);
            return ImageGenerationService.getFallbackImage();
          }
        })()
      ]);

      const parallelDuration = ((Date.now() - parallelStart) / 1000).toFixed(2);
      console.log(`⚡ Parallel operations completed in ${parallelDuration}s (vs ~25s sequential)`);

      // Update recipe with image URL
      const recipeWithImage = {
        ...savedRecipes[0],
        image: imageGenerationResult,
        recipeImage: imageGenerationResult
      };

      // Update database with image URL
      await supabase
        .from('tbl_recipes')
        .update({ recipeImage: imageGenerationResult })
        .eq('recipeID', savedRecipes[0].recipeID);

      console.log('✅ Recipe ready with image!');

      return {
        success: true,
        recipe: recipeWithImage,
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
      console.log('📝 API Key Status:', process.env.OPENAI_API_KEY ? `Loaded (${process.env.OPENAI_API_KEY.substring(0, 10)}...)` : '❌ Missing');

      // Step 1: Generate recipe content
      const prompt = this.buildRecipePrompt(searchQuery, filters, pantryItems);

      console.log('📤 Sending request to OpenAI API...');
      const startTime = Date.now();

      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
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
   * Build prompt for recipe generation (matches Custom GPT instructions)
   */
  buildRecipePrompt(searchQuery, filters, pantryItems, recipeCount = 5) {
    // System instructions matching your Custom GPT
    let prompt = `You are SousChef AI, an expert culinary assistant that generates ${recipeCount} personalized ${recipeCount === 1 ? 'recipe' : 'recipes'} based on user's pantry items, dietary preferences, and leftover cooked foods.

## CORE FEATURES
- Pantry-based recipe generation (raw + cooked ingredients)
- Leftover transformation (turn Adobo → Adobo Fried Rice, Caldereta → Empanada)
- Multi-cultural expertise (Filipino, Asian, Western, Fusion)
- Dietary accommodation (vegetarian, vegan, gluten-free, allergies, etc.)

## CURRENT REQUEST
Search Query: "${searchQuery}"
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
      prompt += '\n## AVAILABLE PANTRY ITEMS\n';
      
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
      prompt += 'Generate creative recipes based on the search query and filters.\n\n';
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
}

export default new SousChefAIService();
