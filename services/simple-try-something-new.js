/**
 * Simple Try Something New Service with Supabase Caching
 * 
 * Caches recipes in Supabase for:
 * - Persistent storage across app restarts
 * - Fallback when Edamam rate limit exceeded
 * - Better UX with instant recipe display
 * - Proper recipe-detail display
 */

import { supabase } from '../lib/supabase';
import EdamamService from './edamam-service';

// Diverse search terms for variety
const SEARCH_TERMS = [
  'chicken', 'beef', 'pork', 'fish', 'salmon', 'shrimp',
  'pasta', 'rice', 'noodles', 'pizza', 'burger',
  'salad', 'soup', 'curry', 'stir fry', 'grilled',
  'breakfast', 'dessert', 'healthy', 'vegetarian'
];

const CACHE_TABLE = 'cache_edamam_recipes';

class SimpleTrySomethingNew {
  
  constructor() {
    this.tableExists = null; // Check if table exists
  }
  
  /**
   * Check if Supabase table exists
   * @returns {Promise<boolean>}
   */
  async checkTableExists() {
    if (this.tableExists !== null) return this.tableExists;
    
    try {
      const { error } = await supabase.from(CACHE_TABLE).select('id').limit(1);
      this.tableExists = !error;
      
      if (!this.tableExists) {
        console.warn('⚠️ cache_edamam_recipes table does not exist. Run database/simple-cache-table.sql');
      }
      
      return this.tableExists;
    } catch (error) {
      console.error('❌ Table check failed:', error);
      this.tableExists = false;
      return false;
    }
  }
  
  /**
   * Get recommendations - from Supabase cache or fetch new
   * @param {number} count - Number of recipes
   * @returns {Promise<Array>}
   */
  async getRecommendations(count = 10) {
    try {
      console.log('🎲 Getting Try Something New recipes...');
      
      // Check if table exists
      const tableExists = await this.checkTableExists();
      
      // Try to get from Supabase cache first
      const cachedRecipes = await this.getFromSupabase(count * 2);
      
      if (cachedRecipes.length >= count) {
        console.log(`⚡ Found ${cachedRecipes.length} recipes in Supabase cache`);
        return this.getRandomSelection(cachedRecipes, count);
      }
      
      // Not enough cached, fetch fresh from Edamam
      console.log(`⚠️ Only ${cachedRecipes.length} cached, fetching more from Edamam...`);
      const freshRecipes = await this.fetchAndCacheFreshRecipes();
      
      // Combine cached + fresh
      const allRecipes = [...cachedRecipes, ...freshRecipes];
      const unique = this.removeDuplicates(allRecipes);
      
      if (unique.length === 0) {
        console.error('❌ No recipes available');
        return [];
      }
      
      console.log(`✅ Returning ${Math.min(count, unique.length)} recipes`);
      return this.getRandomSelection(unique, count);
      
    } catch (error) {
      console.error('Error getting recommendations:', error);
      return [];
    }
  }
  
  /**
   * Get recipes from Supabase cache
   * @param {number} limit - Max recipes
   * @returns {Promise<Array>}
   */
  async getFromSupabase(limit = 20) {
    try {
      const tableExists = await this.checkTableExists();
      if (!tableExists) return [];
      
      const { data, error } = await supabase
        .from(CACHE_TABLE)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) {
        console.error('❌ Supabase fetch error:', error);
        return [];
      }
      
      if (!data || data.length === 0) {
        console.log('📭 No recipes in Supabase cache yet');
        return [];
      }
      
      console.log(`📦 Retrieved ${data.length} recipes from Supabase`);
      return data.map(row => this.formatForHome(row.recipe_data));
      
    } catch (error) {
      console.error('Error getting from Supabase:', error);
      return [];
    }
  }
  
  /**
   * Save recipe to Supabase
   * @param {Object} recipe - Recipe to save
   * @returns {Promise<boolean>}
   */
  async saveToSupabase(recipe) {
    try {
      const tableExists = await this.checkTableExists();
      if (!tableExists) return false;
      
      const { error } = await supabase
        .from(CACHE_TABLE)
        .upsert({
          recipe_uri: recipe.uri,
          recipe_label: recipe.label,
          recipe_image: recipe.image || recipe.images?.REGULAR?.url,
          recipe_data: recipe,
          created_at: new Date().toISOString(),
          last_accessed_at: new Date().toISOString(),
          access_count: 1
        }, {
          onConflict: 'recipe_uri',
          ignoreDuplicates: false
        });
      
      if (error) {
        // If it's a duplicate, that's okay
        if (error.code === '23505') {
          return true; // Already exists
        }
        console.error('❌ Save error:', error);
        return false;
      }
      
      return true;
      
    } catch (error) {
      console.error('Error saving to Supabase:', error);
      return false;
    }
  }
  
  /**
   * Fetch fresh recipes from Edamam and cache in Supabase
   * @returns {Promise<Array>}
   */
  async fetchAndCacheFreshRecipes() {
    try {
      const searchTerms = this.getRandomSearchTerms(3); // 3 searches
      const allRecipes = [];
      
      for (const term of searchTerms) {
        try {
          console.log(`🔍 Searching Edamam: "${term}"`);
          
          const result = await EdamamService.searchRecipes(term, { from: 0, to: 5 });
          
          // EdamamService returns { success: true, data: { recipes: [...] } }
          if (result.success && result.data && result.data.recipes && result.data.recipes.length > 0) {
            console.log(`✅ Got ${result.data.recipes.length} recipes for "${term}"`);
            
            // Save each recipe to Supabase immediately
            for (const recipe of result.data.recipes) {
              const saved = await this.saveToSupabase(recipe);
              if (saved) {
                allRecipes.push(recipe);
              }
            }
            
            console.log(`💾 Cached ${result.data.recipes.length} recipes to Supabase`);
          } else {
            console.warn(`⚠️ No recipes found for "${term}"`);
          }
          
          // Small delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          console.error(`Failed to fetch "${term}":`, error.message);
        }
      }
      
      // Remove duplicates and format
      const uniqueRecipes = this.removeDuplicates(allRecipes);
      const formatted = uniqueRecipes.map(recipe => this.formatForHome(recipe));
      
      console.log(`✅ Fetched and cached ${formatted.length} unique recipes`);
      return formatted;
      
    } catch (error) {
      console.error('Error fetching fresh recipes:', error);
      return [];
    }
  }
  
  /**
   * Get random selection from recipes
   * @param {Array} recipes
   * @param {number} count
   * @returns {Array}
   */
  getRandomSelection(recipes, count) {
    const shuffled = this.shuffleArray([...recipes]);
    return shuffled.slice(0, count);
  }
  
  /**
   * Remove duplicate recipes by URI
   * @param {Array} recipes
   * @returns {Array}
   */
  removeDuplicates(recipes) {
    const seen = new Set();
    return recipes.filter(recipe => {
      const uri = recipe.uri;
      if (seen.has(uri)) return false;
      seen.add(uri);
      return true;
    });
  }
  
  /**
   * Get random search terms
   * @param {number} count
   * @returns {Array<string>}
   */
  getRandomSearchTerms(count) {
    const shuffled = this.shuffleArray([...SEARCH_TERMS]);
    return shuffled.slice(0, count);
  }
  
  /**
   * Shuffle array (Fisher-Yates)
   * @param {Array} array
   * @returns {Array}
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
   * Format recipe for home display
   * @param {Object} recipe - Edamam recipe
   * @returns {Object}
   */
  formatForHome(recipe) {
    return {
      id: recipe.uri,
      title: recipe.label,
      calories: recipe.calories || null,
      time: recipe.totalTime || null,
      image: recipe.image || recipe.images?.REGULAR?.url || recipe.images?.SMALL?.url,
      recipeData: {
        ...recipe,
        uri: recipe.uri,
        label: recipe.label,
        image: recipe.image || recipe.images?.REGULAR?.url,
        recipeImage: recipe.image || recipe.images?.REGULAR?.url,
        _simplified: true
      }
    };
  }
  
  /**
   * Force refresh (fetch new recipes from Edamam)
   * @returns {Promise<Array>}
   */
  async forceRefresh(count = 10) {
    console.log('🔄 Force refresh: Fetching fresh recipes...');
    const freshRecipes = await this.fetchAndCacheFreshRecipes();
    
    if (freshRecipes.length === 0) {
      // Fallback to cache if fetch fails
      console.log('⚠️ Fetch failed, falling back to cache...');
      return await this.getFromSupabase(count);
    }
    
    return this.getRandomSelection(freshRecipes, count);
  }
  
  /**
   * Get cache stats
   * @returns {Promise<Object>}
   */
  async getCacheStats() {
    try {
      const tableExists = await this.checkTableExists();
      if (!tableExists) {
        return {
          totalRecipes: 0,
          cacheEnabled: false,
          cacheType: 'supabase',
          error: 'Table does not exist'
        };
      }
      
      const { count, error } = await supabase
        .from(CACHE_TABLE)
        .select('*', { count: 'exact', head: true });
      
      if (error) throw error;
      
      return {
        totalRecipes: count || 0,
        cacheEnabled: true,
        cacheType: 'supabase',
        persistent: true
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return {
        totalRecipes: 0,
        cacheEnabled: false,
        cacheType: 'supabase',
        error: error.message
      };
    }
  }
}

export default new SimpleTrySomethingNew();
