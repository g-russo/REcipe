import { supabase } from '../lib/supabase';
import EdamamService from './edamam-service';
import recipeImageCacheService from './recipe-image-cache-service';

/**
 * Supabase-based cache service for recipe data
 * 
 * Benefits over AsyncStorage:
 * - Instant app startup (no loading on init)
 * - Shared cache across all users
 * - Auto-expiration (6-12 hour TTL)
 * - Cross-device sync
 * - Unlimited storage
 * - Lazy loading (fetch only when needed)
 */
class SupabaseCacheService {
  constructor() {
    // Cache TTL (Time To Live) settings - easily configurable!
    this.CACHE_TTL = {
      POPULAR: 6 * 60 * 60 * 1000,       // 6 hours (refresh twice daily)
      TRENDING: 6 * 60 * 60 * 1000,      // 6 hours
      SEARCH: 12 * 60 * 60 * 1000,       // 12 hours (search results stable longer)
      SIMILAR: 24 * 60 * 60 * 1000,      // 24 hours (similar recipes rarely change)
      INSTRUCTIONS: 30 * 24 * 60 * 60 * 1000,  // 30 days (instructions don't change)
      AI_RECIPES: 30 * 24 * 60 * 60 * 1000  // 30 days (AI recipes never expire naturally)
    };

    // Cache statistics
    this.stats = {
      hits: 0,
      misses: 0,
      errors: 0
    };

    console.log('🚀 Supabase Cache Service initialized (TTL: Popular=6h, Search=12h, Similar=24h, Instructions=30d)');
  }

  /**
   * Get recipes from image cache (Try Something New)
   * Returns a random subset of recipes to ensure variety on refresh
   */
  async getRecipesFromImageCache(count = 10) {
    try {
      console.log('📸 Fetching recipes from image cache for Try Something New...');
      
      // Fetch a larger pool to allow for randomization
      const { data, error } = await supabase
        .from('cache_recipe_images')
        .select('id, recipe_id, recipe_name, cached_url, original_url, created_at')
        .not('recipe_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50); // Fetch last 50 items

      if (error) {
        console.error('❌ Error fetching from image cache:', error);
        return [];
      }

      if (!data || data.length === 0) {
        console.log('⚠️ No recipes found in image cache');
        return [];
      }

      // Shuffle the data array
      const shuffled = data.sort(() => 0.5 - Math.random());
      
      // Take the requested number of items
      const selectedItems = shuffled.slice(0, count);

      // Transform to recipe format
      const recipes = selectedItems.map(item => {
        // Format title: replace underscores with spaces, capitalize words
        const title = item.recipe_name 
          ? item.recipe_name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
          : 'Untitled Recipe';

        return {
          id: item.recipe_id,
          title: title,
          calories: null, // Not available in image cache
          time: null,     // Not available in image cache
          image: item.cached_url || item.original_url,
          recipeData: {
            uri: item.recipe_id, // Use recipe_id as URI for consistency
            label: title,
            image: item.cached_url || item.original_url,
            source: 'Image Cache'
          }
        };
      });

      // Deduplicate by recipe_id (just in case)
      const uniqueRecipes = Array.from(
        new Map(recipes.map(recipe => [recipe.id, recipe])).values()
      );

      console.log(`✅ Fetched ${uniqueRecipes.length} unique recipes from image cache (randomized)`);
      return uniqueRecipes;

    } catch (error) {
      console.error('Error in getRecipesFromImageCache:', error);
      return [];
    }
  }

  /**
   * Get popular recipes with caching
   * LAZY LOADED - Only fetches when needed, not on app startup!
   */
  async getPopularRecipes(forceRefresh = false) {
    try {
      if (!forceRefresh) {
        // Check cache first
        const { data: cached, error } = await supabase
          .from('cache_popular_recipes')
          .select('recipes, created_at')
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && cached) {
          this.stats.hits++;
          const age = Math.round((Date.now() - new Date(cached.created_at).getTime()) / (60 * 1000));
          console.log(`✅ Cache HIT - Popular recipes (${age} min old)`);
          return cached.recipes;
        }
      }

      // Cache MISS or force refresh
      this.stats.misses++;
      console.log('⏳ Cache MISS - Fetching popular recipes from API...');
      
      // Fetch a diverse set of popular recipes
      const EdamamService = (await import('./edamam-service')).default;
      
      // Try multiple searches to get variety
      const searchQueries = [
        { query: 'chicken', mealType: 'Dinner' },
        { query: 'pasta', cuisineType: 'Italian' },
        { query: 'salad', dishType: 'Salad' },
        { query: 'soup', mealType: 'Lunch' },
        { query: 'vegetarian', health: ['vegetarian'] },
        { query: 'beef', mealType: 'Dinner' },
        { query: 'fish', dishType: 'Main course' },
        { query: 'dessert', dishType: 'Desserts' }
      ];

      // Fetch recipes from multiple queries
      const allRecipes = [];
      for (const search of searchQueries.slice(0, 4)) { // Use 4 queries to get ~40-80 recipes
        try {
          const result = await EdamamService.searchRecipes(search.query, {
            to: 20,
            ...search
          });
          if (result.success && result.data?.recipes) {
            allRecipes.push(...result.data.recipes);
          }
        } catch (err) {
          console.warn(`Failed to fetch ${search.query}:`, err.message);
        }
      }

      // Remove duplicates and shuffle
      const uniqueRecipes = Array.from(
        new Map(allRecipes.map(recipe => [recipe.uri, recipe])).values()
      );
      const shuffled = uniqueRecipes.sort(() => Math.random() - 0.5);

      console.log(`✅ Fetched ${shuffled.length} unique popular recipes`);

      // Save to cache
      await this.savePopularRecipes(shuffled);

      return shuffled;
    } catch (error) {
      this.stats.errors++;
      console.error('Cache error (popular):', error);
      // Fallback to direct API call
      return EdamamService.searchRecipes('popular', {});
    }
  }

  /**
   * Save popular recipes to cache with image caching
   */
  async savePopularRecipes(recipes) {
    try {
      const expiresAt = new Date(Date.now() + this.CACHE_TTL.POPULAR);
      
      // Cache images in Supabase Storage (background, non-blocking)
      this.cacheRecipeImages(recipes);
      
      await supabase
        .from('cache_popular_recipes')
        .insert({
          recipes: recipes,
          expires_at: expiresAt.toISOString()
        });

      console.log('💾 Saved popular recipes to cache (expires in 6h)');
    } catch (error) {
      console.warn('Failed to save popular recipes cache:', error.message);
    }
  }

  /**
   * Cache recipe images in Supabase Storage (background)
   */
  async cacheRecipeImages(recipes) {
    if (!recipes || recipes.length === 0) return;

    // Extract image URLs
    const imageUrls = recipes
      .map(r => r.image)
      .filter(Boolean)
      .slice(0, 20); // Cache first 20 images

    // Batch cache in background (don't await)
    setTimeout(() => {
      recipeImageCacheService.batchCacheImages(imageUrls);
    }, 100);
  }

  /**
   * Get search results with caching
   */
  async getSearchResults(query, filters = {}, forceRefresh = false) {
    try {
      const cacheKey = this.generateCacheKey(query, filters);

      if (!forceRefresh) {
        // Check cache first
        const { data: cached, error } = await supabase
          .from('cache_search_results')
          .select('recipes, created_at')
          .eq('search_query', cacheKey)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && cached) {
          this.stats.hits++;
          const age = Math.round((Date.now() - new Date(cached.created_at).getTime()) / (60 * 1000));
          console.log(`✅ Cache HIT - Search results (${age} min old)`);
          
          // Update access stats (fire and forget, don't wait)
          this.updateSearchAccessStats(cacheKey);

          return cached.recipes;
        }
      }

      // Cache MISS
      this.stats.misses++;
      console.log('⏳ Cache MISS - Fetching search results from API...');
      
      const result = await EdamamService.searchRecipes(query, filters);
      
      // EdamamService returns { success, data: { recipes, count, ... } } or { success, error }
      if (result.success && result.data && result.data.recipes) {
        const recipes = result.data.recipes;
        console.log(`✅ Fetched ${recipes.length} recipes from Edamam API`);
        
        // Save to cache
        await this.saveSearchResults(cacheKey, query, filters, recipes);
        
        return recipes;
      } else {
        console.error('❌ Edamam API error:', result.error || 'Unknown error');
        return [];
      }
    } catch (error) {
      this.stats.errors++;
      console.error('Cache error (search):', error);
      
      // Fallback: try direct API call
      try {
        const result = await EdamamService.searchRecipes(query, filters);
        return result.success && result.data ? result.data.recipes : [];
      } catch (fallbackError) {
        console.error('Fallback API call also failed:', fallbackError);
        return [];
      }
    }
  }

  /**
   * Save search results to cache
   */
  async saveSearchResults(cacheKey, query, filters, recipes) {
    try {
      const expiresAt = new Date(Date.now() + this.CACHE_TTL.SEARCH);
      
      await supabase
        .from('cache_search_results')
        .insert({
          search_query: cacheKey,
          original_query: query,
          filters: filters,
          recipes: recipes,
          expires_at: expiresAt.toISOString(),
          access_count: 1
        });

      console.log('💾 Saved search results to cache (expires in 12h)');
    } catch (error) {
      console.warn('Failed to save search cache:', error.message);
    }
  }

  /**
   * Update search access statistics
   */
  async updateSearchAccessStats(cacheKey) {
    try {
      // Get current access count first
      const { data: existing } = await supabase
        .from('cache_search_results')
        .select('access_count')
        .eq('search_query', cacheKey)
        .single();
      
      const currentCount = existing?.access_count || 0;
      
      await supabase
        .from('cache_search_results')
        .update({ 
          access_count: currentCount + 1,
          last_accessed: new Date().toISOString()
        })
        .eq('search_query', cacheKey);
    } catch (error) {
      // Silent fail, not critical
      console.log('Could not update search stats:', error.message);
    }
  }

  /**
   * Get similar recipes with caching
   * @param {Object} currentRecipe - The recipe to find similar recipes for
   * @param {Number} count - Number of similar recipes to return (default: 12)
   * @param {Boolean} forceRefresh - Force refresh cache
   */
  async getSimilarRecipes(currentRecipe, count = 12, forceRefresh = false) {
    try {
      // Use recipe URI as cache key (unique identifier)
      const recipeUri = currentRecipe.uri || currentRecipe.url || JSON.stringify(currentRecipe.label);
      const cacheKey = `similar:${recipeUri}`;

      if (!forceRefresh) {
        const { data: cached, error } = await supabase
          .from('cache_similar_recipes')
          .select('recipes, created_at')
          .eq('recipe_uri', cacheKey)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && cached) {
          this.stats.hits++;
          const age = Math.round((Date.now() - new Date(cached.created_at).getTime()) / (60 * 1000));
          console.log(`✅ Cache HIT - Similar recipes (${age} min old)`);
          return cached.recipes;
        }
      }

      // Cache MISS - fetch from EdamamService
      this.stats.misses++;
      console.log('⏳ Cache MISS - Fetching similar recipes from API...');
      
      // Import EdamamService dynamically to avoid circular dependency
      const EdamamService = (await import('./edamam-service')).default;
      const result = await EdamamService.getSimilarRecipes(currentRecipe, count);
      
      const recipes = result.success ? result.data.recipes : [];

      // Save to cache
      if (recipes.length > 0) {
        await this.saveSimilarRecipes(cacheKey, recipes);
      }

      return recipes;
    } catch (error) {
      this.stats.errors++;
      console.error('Cache error (similar):', error);
      // Fallback to direct API call
      const EdamamService = (await import('./edamam-service')).default;
      const result = await EdamamService.getSimilarRecipes(currentRecipe, count);
      return result.success ? result.data.recipes : [];
    }
  }

  /**
   * Save similar recipes to cache
   */
  async saveSimilarRecipes(recipeUri, recipes) {
    try {
      const expiresAt = new Date(Date.now() + this.CACHE_TTL.SIMILAR);
      
      await supabase
        .from('cache_similar_recipes')
        .insert({
          recipe_uri: recipeUri,
          recipes: recipes,
          expires_at: expiresAt.toISOString()
        });

      console.log('💾 Saved similar recipes to cache (expires in 24h)');
    } catch (error) {
      console.warn('Failed to save similar recipes cache:', error.message);
    }
  }

  /**
   * Generate cache key from query and filters
   */
  generateCacheKey(query, filters) {
    const normalizedQuery = query.toLowerCase().trim();
    const sortedFilters = Object.keys(filters || {})
      .sort()
      .map(key => {
        const value = filters[key];
        if (Array.isArray(value)) {
          return `${key}:${value.sort().join(',')}`;
        }
        return `${key}:${value}`;
      })
      .join('|');
    
    return `${normalizedQuery}::${sortedFilters}`;
  }

  /**
   * Get recipe instructions with caching
   * @param {string} recipeUrl - Recipe URL to get instructions for
   * @param {Function} scrapeFunction - Function to scrape instructions if not cached
   * @param {boolean} forceRefresh - Force refresh cache
   * @returns {Promise<Object>} Instructions result
   */
  async getRecipeInstructions(recipeUrl, scrapeFunction, forceRefresh = false) {
    try {
      if (!recipeUrl) {
        return this.generateInstructionFallback(recipeUrl);
      }

      if (!forceRefresh) {
        // Check cache first
        const { data: cached, error } = await supabase
          .from('cache_recipe_instructions')
          .select('instructions, source, created_at')
          .eq('recipe_url', recipeUrl)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();

        if (!error && cached) {
          this.stats.hits++;
          const age = Math.round((Date.now() - new Date(cached.created_at).getTime()) / (60 * 60 * 1000));
          console.log(`✅ Instruction Cache HIT (${age}h old)`);

          // Update access stats (fire and forget)
          this.updateInstructionAccessStats(recipeUrl);

          return {
            success: true,
            instructions: cached.instructions,
            source: cached.source,
            cached: true
          };
        }
      }

      // Cache MISS - scrape instructions
      this.stats.misses++;
      console.log('⏳ Instruction Cache MISS - Scraping...');

      const result = await scrapeFunction(recipeUrl);

      if (result.success && result.instructions?.length > 0 && !result.fallback) {
        // Only save to cache if NOT a fallback (successful scraping only)
        await this.saveRecipeInstructions(recipeUrl, result.instructions, result.source || 'scraped');
        return result;
      }

      // Scraping failed, return fallback (don't cache)
      console.log('⚠️ Scraping failed, using fallback (not cached)');
      return this.generateInstructionFallback(recipeUrl);

    } catch (error) {
      this.stats.errors++;
      console.error('Instruction cache error:', error);
      return this.generateInstructionFallback(recipeUrl);
    }
  }

  /**
   * Save recipe instructions to cache
   */
  async saveRecipeInstructions(recipeUrl, instructions, source = 'scraped') {
    try {
      const expiresAt = new Date(Date.now() + this.CACHE_TTL.INSTRUCTIONS);

      await supabase
        .from('cache_recipe_instructions')
        .upsert({
          recipe_url: recipeUrl,
          instructions: instructions,
          source: source,
          expires_at: expiresAt.toISOString(),
          access_count: 1,
          last_accessed: new Date().toISOString()
        }, {
          onConflict: 'recipe_url'
        });

      console.log('💾 Saved instructions to cache (expires in 30 days)');
    } catch (error) {
      console.warn('Failed to save instruction cache:', error.message);
    }
  }

  /**
   * Update instruction access statistics
   */
  async updateInstructionAccessStats(recipeUrl) {
    try {
      const { data: existing } = await supabase
        .from('cache_recipe_instructions')
        .select('access_count')
        .eq('recipe_url', recipeUrl)
        .single();

      const currentCount = existing?.access_count || 0;

      await supabase
        .from('cache_recipe_instructions')
        .update({
          access_count: currentCount + 1,
          last_accessed: new Date().toISOString()
        })
        .eq('recipe_url', recipeUrl);
    } catch (error) {
      // Silent fail, not critical
      console.log('Could not update instruction stats:', error.message);
    }
  }

  /**
   * Generate fallback instructions when scraping fails
   */
  generateInstructionFallback(recipeUrl) {
    const domain = recipeUrl ? new URL(recipeUrl).hostname.replace('www.', '') : '';

    return {
      success: true,
      instructions: [
        `This recipe requires visiting the original source for detailed instructions.`,
        domain ? `Visit ${domain} for the complete step-by-step cooking guide.` : 'Visit the recipe website for complete cooking instructions.',
        `The ingredients list above shows everything you'll need to prepare this dish.`,
        `Cooking times and temperatures are provided in the recipe information section.`
      ],
      fallback: true,
      source: 'fallback'
    };
  }

  /**
   * Clear expired cache entries (run manually or scheduled)
   */
  async clearExpiredCache() {
    try {
      console.log('🧹 Cleaning up expired cache entries...');

      const now = new Date().toISOString();

      const [popular, search, similar, instructions] = await Promise.all([
        supabase.from('cache_popular_recipes').delete().lt('expires_at', now),
        supabase.from('cache_search_results').delete().lt('expires_at', now),
        supabase.from('cache_similar_recipes').delete().lt('expires_at', now),
        supabase.from('cache_recipe_instructions').delete().lt('expires_at', now)
      ]);

      const total = (popular.count || 0) + (search.count || 0) + (similar.count || 0) + (instructions.count || 0);
      console.log(`✅ Cleared ${total} expired cache entries (Instructions: ${instructions.count || 0})`);

      return total;
    } catch (error) {
      console.error('Cache cleanup error:', error);
      return 0;
    }
  }

  /**
   * Force refresh all popular content
   */
  async refreshPopularContent() {
    console.log('🔄 Force refreshing popular content...');
    await this.getPopularRecipes(true);
    console.log('✅ Popular content refreshed');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? ((this.stats.hits / total) * 100).toFixed(1) : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      errors: this.stats.errors,
      hitRate: `${hitRate}%`,
      total: total
    };
  }

  /**
   * Log cache statistics
   */
  logStats() {
    const stats = this.getCacheStats();
    console.log('📊 Cache Statistics:', stats);
  }

  /**
   * Clear all cache (use sparingly!)
   */
  async clearAllCache() {
    try {
      console.log('🗑️ Clearing ALL cache...');
      
      await Promise.all([
        supabase.from('cache_popular_recipes').delete().neq('id', 0),
        supabase.from('cache_search_results').delete().neq('id', 0),
        supabase.from('cache_similar_recipes').delete().neq('id', 0),
        supabase.from('cache_recipe_instructions').delete().neq('id', 0)
      ]);

      console.log('✅ All cache cleared');
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }
}

// Export singleton instance
export default new SupabaseCacheService();
