import { supabase } from '../lib/supabase';
import { OPENAI_API_KEY } from '@env';
import ImageGenerationService from './image-generation-service';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

class SousChefAIService {
  /**
   * Check if custom recipes exist for a search query
   */
  async checkExistingRecipes(searchQuery, filters = {}) {
    try {
      let query = supabase
        .from('tbl_recipes')
        .select('*')
        .ilike('searchQuery', `%${searchQuery}%`);

      // Apply filters
      if (Object.keys(filters).length > 0) {
        if (filters.cuisineType) {
          query = query.eq('cuisineType', filters.cuisineType);
        }
        if (filters.mealType && filters.mealType.length > 0) {
          query = query.overlaps('mealType', filters.mealType);
        }
        if (filters.health && filters.health.length > 0) {
          query = query.overlaps('healthLabels', filters.health);
        }
        if (filters.diet && filters.diet.length > 0) {
          query = query.overlaps('dietLabels', filters.diet);
        }
      }

      const { data, error } = await query.limit(5);

      if (error) throw error;

      // Update usage count
      if (data && data.length > 0) {
        const recipeIds = data.map(r => r.recipeID);
        
        // Increment usage count for each recipe
        for (const id of recipeIds) {
          await supabase
            .from('tbl_recipes')
            .update({ 
              usageCount: supabase.sql`"usageCount" + 1`,
              updatedAt: new Date().toISOString()
            })
            .eq('recipeID', id);
        }
      }

      return {
        found: data && data.length > 0,
        recipes: data || [],
        count: data?.length || 0
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
   * Generate custom recipes using ChatGPT with image generation
   */
  async generateCustomRecipes(searchQuery, filters = {}, pantryItems = []) {
    try {
      console.log('🤖 Generating recipes with SousChef AI...');

      // Step 1: Generate recipe content
      const prompt = this.buildRecipePrompt(searchQuery, filters, pantryItems);

      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4-turbo-preview',
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

      if (!response.ok) {
        const errorData = await response.json();
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
   * Build prompt for recipe generation
   */
  buildRecipePrompt(searchQuery, filters, pantryItems) {
    let prompt = `Generate 5 unique, detailed recipes for: "${searchQuery}"\n\n`;

    if (Object.keys(filters).length > 0) {
      prompt += 'Requirements:\n';
      if (filters.cuisineType) prompt += `- Cuisine: ${filters.cuisineType}\n`;
      if (filters.mealType && filters.mealType.length) {
        prompt += `- Meal Type: ${filters.mealType.join(', ')}\n`;
      }
      if (filters.dishType && filters.dishType.length) {
        prompt += `- Dish Type: ${filters.dishType.join(', ')}\n`;
      }
      if (filters.health && filters.health.length) {
        prompt += `- Health Labels: ${filters.health.join(', ')}\n`;
      }
      if (filters.diet && filters.diet.length) {
        prompt += `- Diet: ${filters.diet.join(', ')}\n`;
      }
      prompt += '\n';
    }

    if (pantryItems.length > 0) {
      prompt += 'Available Pantry Items (PRIORITIZE THESE, including ANY LEFTOVER/COOKED foods):\n';
      
      // Separate leftovers and fresh items based on itemCategory
      const leftoverItems = [];
      const freshItems = [];
      
      pantryItems.slice(0, 20).forEach(item => {
        // Check if item is categorized as leftover/cooked
        const isLeftover = item.itemCategory && 
                          (item.itemCategory.toLowerCase() === 'leftovers' ||
                           item.itemCategory.toLowerCase() === 'leftover' ||
                           item.itemCategory.toLowerCase() === 'cooked');
        
        if (isLeftover) {
          leftoverItems.push(item);
        } else {
          freshItems.push(item);
        }
      });
      
      // List leftover items first with emoji
      if (leftoverItems.length > 0) {
        prompt += '\n🍲 LEFTOVER/COOKED FOODS (USE THESE AS MAIN INGREDIENTS):\n';
        leftoverItems.forEach(item => {
          prompt += `- ${item.itemName} (${item.quantity} ${item.unit || ''}) [Category: ${item.itemCategory}]\n`;
        });
        prompt += '\n';
      }
      
      // Then list fresh items
      if (freshItems.length > 0) {
        prompt += '🥬 FRESH INGREDIENTS (Use as supporting ingredients):\n';
        freshItems.forEach(item => {
          prompt += `- ${item.itemName} (${item.quantity} ${item.unit || ''})\n`;
        });
        prompt += '\n';
      }
      
      // Add special instructions for leftover foods
      if (leftoverItems.length > 0) {
        prompt += `⭐ CRITICAL - LEFTOVER TRANSFORMATION RECIPES:\n`;
        prompt += `- Generate recipes that USE the leftover/cooked foods as PRIMARY INGREDIENTS\n`;
        prompt += `- Transform ANY leftover into NEW creative dishes\n`;
        prompt += `- Universal Examples:\n`;
        prompt += `  • Leftover Rice → Fried Rice, Rice Balls, Rice Pudding, Congee\n`;
        prompt += `  • Leftover Meat (any) → Tacos, Sandwiches, Fried Rice, Pasta, Salad, Soup\n`;
        prompt += `  • Leftover Stew/Curry → Empanada, Quesadilla, Pot Pie, Pasta Sauce\n`;
        prompt += `  • Leftover Vegetables → Stir-Fry, Frittata, Soup, Wraps, Fried Rice\n`;
        prompt += `  • Leftover Pasta → Pasta Bake, Frittata, Soup, Salad, Fried Pasta Cakes\n`;
        prompt += `  • Leftover Chicken/Pork/Beef → Sandwiches, Tacos, Fried Rice, Noodles, Salad\n`;
        prompt += `- Be creative but practical\n`;
        prompt += `- Minimize additional ingredients\n`;
        prompt += `- Focus on ZERO FOOD WASTE\n`;
        prompt += `- Quick preparation when possible (leftovers speed up cooking)\n\n`;
      }
    }

    prompt += `Include an "imagePrompt" field with a detailed, vivid description for professional food photography image generation.

Return ONLY valid JSON in this exact format:
{
  "recipes": [
    {
      "recipeName": "string",
      "recipeDescription": "string (2-3 sentences)",
      "cuisineType": "string",
      "mealType": "string",
      "dishType": "string",
      "cookingTime": number,
      "servings": number,
      "calories": number,
      "difficulty": "Easy|Medium|Hard",
      "ingredients": [
        {
          "name": "string",
          "quantity": number,
          "unit": "string",
          "notes": "optional string"
        }
      ],
      "instructions": [
        {
          "step": number,
          "instruction": "string",
          "time": number (optional)
        }
      ],
      "healthLabels": ["array"],
      "dietLabels": ["array"],
      "allergens": ["array"],
      "cookingTips": ["array"],
      "imagePrompt": "Detailed description of the finished dish for professional food photography"
    }
  ]
}`;

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
        difficulty: recipe.difficulty || 'Medium',
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
        healthLabels: recipe.healthLabels || [],
        dietLabels: recipe.dietLabels || [],
        allergens: recipe.allergens || [],
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

      // Merge image prompts back into saved recipes
      return data.map((savedRecipe, index) => ({
        ...savedRecipe,
        imagePrompt: recipes[index].imagePrompt
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
