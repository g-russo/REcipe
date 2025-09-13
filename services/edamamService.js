// Edamam Recipe Search API Service
const EDAMAM_APP_ID = process.env.EXPO_PUBLIC_EDAMAM_APP_ID;
const EDAMAM_APP_KEY = process.env.EXPO_PUBLIC_EDAMAM_APP_KEY;
const EDAMAM_BASE_URL = 'https://api.edamam.com/api/recipes/v2';

class EdamamService {
  /**
   * Search for recipes using the Edamam API
   * @param {string} query - Search query (e.g., "chicken", "pasta")
   * @param {Object} options - Additional search options
   * @param {string} options.type - Recipe type (any, main-course, side-dish, dessert, etc.)
   * @param {string} options.cuisineType - Cuisine type (american, asian, british, etc.)
   * @param {string} options.mealType - Meal type (breakfast, lunch, dinner, snack)
   * @param {string} options.dishType - Dish type (main course, side dish, dessert, etc.)
   * @param {number} options.from - Starting index for pagination (default: 0)
   * @param {number} options.to - Ending index for pagination (default: 20)
   * @param {number} options.calories - Calorie range (e.g., "100-300")
   * @param {number} options.time - Cooking time in minutes (e.g., "1-60")
   * @param {Array} options.health - Health labels (e.g., ["vegetarian", "vegan"])
   * @param {Array} options.diet - Diet labels (e.g., ["low-carb", "high-protein"])
   * @param {boolean} options.curatedOnly - Limit to Edamam curated recipes only (default: true)
   * @returns {Promise<Object>} Recipe search results
   */
  static async searchRecipes(query, options = {}) {
    try {
      // Build URL parameters
      const params = new URLSearchParams({
        type: 'public',
        q: query,
        app_id: EDAMAM_APP_ID,
        app_key: EDAMAM_APP_KEY,
        from: options.from || 0,
        to: options.to || 20,
      });

      // Add curated filter (default to true for Edamam curated recipes only)
      if (options.curatedOnly !== false) {
        // Filter for high-quality, curated sources
        params.append('source', 'Food Network');
        params.append('source', 'BBC Good Food');
        params.append('source', 'Epicurious');
        params.append('source', 'Serious Eats');
        params.append('source', 'Martha Stewart');
        params.append('source', 'Bon Appétit');
      }

      // Add optional parameters
      if (options.cuisineType) params.append('cuisineType', options.cuisineType);
      if (options.mealType) params.append('mealType', options.mealType);
      if (options.dishType) params.append('dishType', options.dishType);
      if (options.calories) params.append('calories', options.calories);
      if (options.time) params.append('time', options.time);
      
      // Add health labels
      if (options.health && Array.isArray(options.health)) {
        options.health.forEach(label => params.append('health', label));
      }
      
      // Add diet labels
      if (options.diet && Array.isArray(options.diet)) {
        options.diet.forEach(label => params.append('diet', label));
      }

      const url = `${EDAMAM_BASE_URL}?${params.toString()}`;
      
      console.log('🔍 Searching recipes with Edamam API...');
      console.log('📱 Query:', query);
      console.log('🔗 URL:', url);

      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Edamam API error:', response.status, errorText);
        throw new Error(`Recipe search failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      console.log('✅ Recipe search successful!');
      console.log(`📊 Found ${data.count} recipes, showing ${data.hits?.length || 0} results`);

      return {
        success: true,
        data: {
          count: data.count,
          from: data.from,
          to: data.to,
          more: data.more,
          recipes: data.hits?.map(hit => this.formatRecipe(hit.recipe)) || []
        }
      };

    } catch (error) {
      console.error('❌ Recipe search error:', error);
      return {
        success: false,
        error: error.message || 'Failed to search recipes'
      };
    }
  }

  /**
   * Get recipe by URI (for detailed view)
   * @param {string} uri - Recipe URI from search results
   * @returns {Promise<Object>} Detailed recipe information
   */
  static async getRecipeByUri(uri) {
    try {
      const params = new URLSearchParams({
        type: 'public',
        uri: uri,
        app_id: EDAMAM_APP_ID,
        app_key: EDAMAM_APP_KEY,
      });

      const url = `${EDAMAM_BASE_URL}?${params.toString()}`;
      
      console.log('🔍 Getting recipe details...');
      console.log('🔗 URI:', uri);

      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to get recipe: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.hits && data.hits.length > 0) {
        return {
          success: true,
          data: this.formatRecipe(data.hits[0].recipe)
        };
      } else {
        throw new Error('Recipe not found');
      }

    } catch (error) {
      console.error('❌ Get recipe error:', error);
      return {
        success: false,
        error: error.message || 'Failed to get recipe details'
      };
    }
  }

  /**
   * Format recipe data for consistent use in the app
   * @param {Object} recipe - Raw recipe data from Edamam
   * @returns {Object} Formatted recipe object
   */
  static formatRecipe(recipe) {
    return {
      id: recipe.uri,
      label: recipe.label,
      image: recipe.image,
      images: recipe.images,
      source: recipe.source,
      url: recipe.url,
      shareAs: recipe.shareAs,
      yield: recipe.yield,
      dietLabels: recipe.dietLabels || [],
      healthLabels: recipe.healthLabels || [],
      cautions: recipe.cautions || [],
      ingredientLines: recipe.ingredientLines || [],
      ingredients: recipe.ingredients || [],
      calories: Math.round(recipe.calories) || 0,
      totalCO2Emissions: recipe.totalCO2Emissions || 0,
      co2EmissionsClass: recipe.co2EmissionsClass,
      totalTime: recipe.totalTime || 0,
      cuisineType: recipe.cuisineType || [],
      mealType: recipe.mealType || [],
      dishType: recipe.dishType || [],
      totalNutrients: recipe.totalNutrients || {},
      totalDaily: recipe.totalDaily || {},
      digest: recipe.digest || []
    };
  }

  /**
   * Get popular search suggestions
   * @returns {Array} Array of popular search terms
   */
  static getPopularSearches() {
    return [
      'chicken breast',
      'pasta',
      'salmon',
      'vegetarian',
      'chocolate cake',
      'stir fry',
      'soup',
      'salad',
      'beef',
      'pizza',
      'breakfast',
      'dessert'
    ];
  }

  /**
   * Get available filter options
   * @returns {Object} Available filter options
   */
  static getFilterOptions() {
    return {
      cuisineType: [
        'american', 'asian', 'british', 'caribbean', 'central europe',
        'chinese', 'eastern europe', 'french', 'indian', 'italian',
        'japanese', 'kosher', 'mediterranean', 'mexican', 'middle eastern',
        'nordic', 'south american', 'south east asian'
      ],
      mealType: [
        'breakfast', 'brunch', 'lunch', 'dinner', 'snack', 'teatime'
      ],
      dishType: [
        'main course', 'side dish', 'dessert', 'appetizer', 'salad',
        'bread', 'breakfast', 'soup', 'beverage', 'sauce', 'marinade',
        'fingerfood', 'snack', 'drink'
      ],
      health: [
        'alcohol-cocktail', 'alcohol-free', 'celery-free', 'crustacean-free',
        'dairy-free', 'dash', 'egg-free', 'fish-free', 'fodmap-free',
        'gluten-free', 'immuno-supportive', 'keto-friendly', 'kidney-friendly',
        'kosher', 'low-potassium', 'low-sugar', 'lupine-free', 'mediterranean',
        'mollusk-free', 'mustard-free', 'no-oil-added', 'paleo', 'peanut-free',
        'pecatarian', 'pork-free', 'red-meat-free', 'sesame-free', 'shellfish-free',
        'soy-free', 'sugar-conscious', 'sulfite-free', 'tree-nut-free', 'vegan',
        'vegetarian', 'wheat-free'
      ],
      diet: [
        'balanced', 'high-fiber', 'high-protein', 'low-carb', 'low-fat', 'low-sodium'
      ]
    };
  }
}

export default EdamamService;
