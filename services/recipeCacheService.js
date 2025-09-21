import EdamamService from './edamamService';
import AsyncStorage from '@react-native-async-storage/async-storage';

class RecipeCacheService {
  constructor() {
    this.popularRecipes = null;
    this.trendingRecipes = null;
    this.lastFetchTime = null;
    this.CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
    this.STORAGE_KEYS = {
      POPULAR_RECIPES: 'cached_popular_recipes',
      TRENDING_RECIPES: 'cached_trending_recipes',
      LAST_FETCH: 'recipes_last_fetch'
    };
  }

  /**
   * Initialize cache on app startup
   */
  async initializeCache() {
    try {
      // Try to load from AsyncStorage first
      await this.loadFromStorage();
      
      // If cache is expired or empty, fetch fresh data
      if (this.shouldRefreshCache()) {
        await this.refreshPopularRecipes();
      }
    } catch (error) {
      console.error('Error initializing recipe cache:', error);
    }
  }

  /**
   * Load cached recipes from AsyncStorage
   */
  async loadFromStorage() {
    try {
      const [popularData, trendingData, lastFetchData] = await Promise.all([
        AsyncStorage.getItem(this.STORAGE_KEYS.POPULAR_RECIPES),
        AsyncStorage.getItem(this.STORAGE_KEYS.TRENDING_RECIPES),
        AsyncStorage.getItem(this.STORAGE_KEYS.LAST_FETCH)
      ]);

      if (popularData) this.popularRecipes = JSON.parse(popularData);
      if (trendingData) this.trendingRecipes = JSON.parse(trendingData);
      if (lastFetchData) this.lastFetchTime = parseInt(lastFetchData);
    } catch (error) {
      console.error('Error loading from storage:', error);
    }
  }

  /**
   * Save cached recipes to AsyncStorage
   */
  async saveToStorage() {
    try {
      await Promise.all([
        AsyncStorage.setItem(this.STORAGE_KEYS.POPULAR_RECIPES, JSON.stringify(this.popularRecipes)),
        AsyncStorage.setItem(this.STORAGE_KEYS.TRENDING_RECIPES, JSON.stringify(this.trendingRecipes)),
        AsyncStorage.setItem(this.STORAGE_KEYS.LAST_FETCH, this.lastFetchTime.toString())
      ]);
    } catch (error) {
      console.error('Error saving to storage:', error);
    }
  }

  /**
   * Check if cache should be refreshed
   */
  shouldRefreshCache() {
    if (!this.lastFetchTime || !this.popularRecipes) return true;
    return Date.now() - this.lastFetchTime > this.CACHE_DURATION;
  }

  /**
   * Fetch and cache popular recipes
   */
  async refreshPopularRecipes() {
    try {
      const popularQueries = [
        { query: 'chicken breast', category: 'protein' },
        { query: 'pasta carbonara', category: 'pasta' },
        { query: 'caesar salad', category: 'salad' },
        { query: 'chocolate cake', category: 'dessert' },
        { query: 'tomato soup', category: 'soup' },
        { query: 'beef stir fry', category: 'dinner' },
        { query: 'pancakes', category: 'breakfast' },
        { query: 'fish tacos', category: 'mexican' }
      ];

      // Parallel API calls for better performance
      const promises = popularQueries.map(({ query, category }) =>
        EdamamService.searchRecipes(query, {
          from: 0,
          to: 5 // Get multiple options per category
        }).then(result => ({ result, category, query }))
      );

      const results = await Promise.all(promises);
      const recipes = [];

      results.forEach(({ result, category, query }) => {
        if (result.success && result.data.recipes.length > 0) {
          // Add multiple recipes per category for variety
          result.data.recipes.slice(0, 2).forEach((recipe, index) => {
            recipes.push({
              id: `${recipe.id}_${category}_${index}`,
              title: recipe.label.length > 15 ? recipe.label.substring(0, 15) + '...' : recipe.label,
              image: recipe.image,
              category,
              query,
              fullData: recipe,
              calories: Math.round(recipe.calories / recipe.yield),
              time: recipe.totalTime || 30,
              difficulty: this.calculateDifficulty(recipe),
              rating: this.generateRating() // Mock rating for now
            });
          });
        }
      });

      // Shuffle and select best recipes
      this.popularRecipes = this.selectBestRecipes(recipes);
      this.lastFetchTime = Date.now();
      
      await this.saveToStorage();
      
      console.log(`✅ Cached ${this.popularRecipes.length} popular recipes`);
      return this.popularRecipes;
    } catch (error) {
      console.error('Error refreshing popular recipes:', error);
      throw error;
    }
  }

  /**
   * Select the best recipes for display
   */
  selectBestRecipes(recipes) {
    // Sort by a combination of factors
    return recipes
      .sort((a, b) => {
        // Prefer recipes with images
        if (a.image && !b.image) return -1;
        if (!a.image && b.image) return 1;
        
        // Prefer shorter cooking times
        const timeA = a.time || 60;
        const timeB = b.time || 60;
        if (timeA !== timeB) return timeA - timeB;
        
        // Prefer higher ratings
        return b.rating - a.rating;
      })
      .slice(0, 8); // Keep top 8 recipes
  }

  /**
   * Calculate recipe difficulty based on ingredients and time
   */
  calculateDifficulty(recipe) {
    const ingredientCount = recipe.ingredients?.length || 5;
    const time = recipe.totalTime || 30;
    
    if (ingredientCount <= 5 && time <= 30) return 'Easy';
    if (ingredientCount <= 10 && time <= 60) return 'Medium';
    return 'Hard';
  }

  /**
   * Generate mock rating (in real app, this would come from user reviews)
   */
  generateRating() {
    return (Math.random() * 1.5 + 3.5).toFixed(1); // 3.5-5.0 rating
  }

  /**
   * Get popular recipes (instant if cached)
   */
  async getPopularRecipes(count = 5) {
    if (!this.popularRecipes || this.shouldRefreshCache()) {
      await this.refreshPopularRecipes();
    }
    
    return this.popularRecipes
      ? this.shuffleArray([...this.popularRecipes]).slice(0, count)
      : [];
  }

  /**
   * Get recipes by category
   */
  async getRecipesByCategory(category, count = 3) {
    if (!this.popularRecipes) {
      await this.refreshPopularRecipes();
    }
    
    return this.popularRecipes
      ? this.popularRecipes.filter(recipe => recipe.category === category).slice(0, count)
      : [];
  }

  /**
   * Shuffle array for variety
   */
  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Clear cache (for testing or manual refresh)
   */
  async clearCache() {
    this.popularRecipes = null;
    this.trendingRecipes = null;
    this.lastFetchTime = null;
    
    await Promise.all([
      AsyncStorage.removeItem(this.STORAGE_KEYS.POPULAR_RECIPES),
      AsyncStorage.removeItem(this.STORAGE_KEYS.TRENDING_RECIPES),
      AsyncStorage.removeItem(this.STORAGE_KEYS.LAST_FETCH)
    ]);
  }

  /**
   * Get cache status for debugging
   */
  getCacheStatus() {
    return {
      hasPopularRecipes: !!this.popularRecipes,
      popularRecipesCount: this.popularRecipes?.length || 0,
      lastFetchTime: this.lastFetchTime,
      cacheAge: this.lastFetchTime ? Date.now() - this.lastFetchTime : null,
      shouldRefresh: this.shouldRefreshCache()
    };
  }
}

// Export singleton instance
export default new RecipeCacheService();