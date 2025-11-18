/**
 * Instruction Cache Service - Fast retrieval for APK builds
 * 
 * Features:
 * - AsyncStorage for persistent caching
 * - Timeout for slow web scraping operations
 * - Smart fallback with minimal delay
 * - Batch operations for multiple recipes
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const INSTRUCTION_CACHE_KEY = '@recipe_instructions_cache_v2';
const CACHE_EXPIRY_DAYS = 30; // Instructions valid for 30 days
const MAX_CACHE_ENTRIES = 200; // Limit cache size
const SCRAPE_TIMEOUT = 5000; // 5 second timeout for web scraping

class InstructionCacheService {
  constructor() {
    this.cache = null;
    this.loadCache();
  }

  /**
   * Load instruction cache from AsyncStorage
   */
  async loadCache() {
    try {
      const cacheData = await AsyncStorage.getItem(INSTRUCTION_CACHE_KEY);
      this.cache = cacheData ? JSON.parse(cacheData) : {};
      console.log(`📚 Instruction cache loaded: ${Object.keys(this.cache).length} entries`);
    } catch (error) {
      console.error('❌ Failed to load instruction cache:', error);
      this.cache = {};
    }
  }

  /**
   * Save cache to AsyncStorage
   */
  async saveCache() {
    try {
      await AsyncStorage.setItem(INSTRUCTION_CACHE_KEY, JSON.stringify(this.cache));
    } catch (error) {
      console.error('❌ Failed to save instruction cache:', error);
    }
  }

  /**
   * Generate cache key from recipe URL
   */
  generateCacheKey(url) {
    if (!url) return null;
    return url.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 100);
  }

  /**
   * Get instructions with fast timeout
   * @param {string} recipeUrl - Recipe URL
   * @param {Function} scrapeFunction - Function to scrape instructions
   * @returns {Promise<Object>} Instructions result
   */
  async getInstructions(recipeUrl, scrapeFunction) {
    if (!recipeUrl) {
      return this.generateFallback(recipeUrl);
    }

    try {
      // Ensure cache is loaded
      if (!this.cache) {
        await this.loadCache();
      }

      const cacheKey = this.generateCacheKey(recipeUrl);
      
      // Check cache first
      const cached = this.cache[cacheKey];
      if (cached) {
        const age = Date.now() - cached.timestamp;
        const maxAge = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

        if (age < maxAge) {
          console.log(`✅ Instruction cache HIT (${Math.round(age / 1000 / 60)} min old)`);
          return {
            success: true,
            instructions: cached.instructions,
            cached: true,
            source: cached.source
          };
        } else {
          // Cache expired
          delete this.cache[cacheKey];
          await this.saveCache();
        }
      }

      console.log(`⏳ Instruction cache MISS, attempting fast scrape...`);

      // Try scraping with strict timeout
      const result = await this.scrapeWithTimeout(recipeUrl, scrapeFunction);

      if (result.success && result.instructions.length > 0) {
        // Cache successful result
        await this.cacheInstructions(cacheKey, result.instructions, result.source || 'scraped');
        return result;
      }

      // Scraping failed or timed out, use smart fallback
      console.log(`⚠️ Scraping failed/timeout, using smart fallback`);
      return this.generateFallback(recipeUrl);

    } catch (error) {
      console.error('❌ Error getting instructions:', error);
      return this.generateFallback(recipeUrl);
    }
  }

  /**
   * Scrape with timeout to prevent hanging
   */
  async scrapeWithTimeout(recipeUrl, scrapeFunction) {
    return new Promise(async (resolve) => {
      const timeout = setTimeout(() => {
        console.log(`⏱️ Scraping timeout (${SCRAPE_TIMEOUT}ms)`);
        resolve({ success: false, timeout: true });
      }, SCRAPE_TIMEOUT);

      try {
        // Try only the fastest scraping method
        const result = await scrapeFunction(recipeUrl);
        clearTimeout(timeout);
        resolve(result);
      } catch (error) {
        clearTimeout(timeout);
        resolve({ success: false, error: error.message });
      }
    });
  }

  /**
   * Cache instructions
   */
  async cacheInstructions(cacheKey, instructions, source = 'scraped') {
    try {
      // Cleanup if cache is too large
      const entries = Object.keys(this.cache);
      if (entries.length >= MAX_CACHE_ENTRIES) {
        // Remove oldest 20% of entries
        const sortedEntries = entries
          .map(key => ({ key, timestamp: this.cache[key].timestamp }))
          .sort((a, b) => a.timestamp - b.timestamp);
        
        const toRemove = sortedEntries.slice(0, Math.floor(MAX_CACHE_ENTRIES * 0.2));
        toRemove.forEach(({ key }) => delete this.cache[key]);
        
        console.log(`🧹 Removed ${toRemove.length} old instruction cache entries`);
      }

      // Add new entry
      this.cache[cacheKey] = {
        instructions,
        source,
        timestamp: Date.now()
      };

      await this.saveCache();
    } catch (error) {
      console.error('❌ Failed to cache instructions:', error);
    }
  }

  /**
   * Generate smart fallback instructions
   */
  generateFallback(recipeUrl) {
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
   * Prefetch instructions for multiple recipes
   * @param {Array} recipes - Array of recipe objects with url property
   * @param {Function} scrapeFunction - Function to scrape instructions
   */
  async prefetchInstructions(recipes, scrapeFunction) {
    if (!recipes || recipes.length === 0) return;

    console.log(`🔄 Prefetching instructions for ${recipes.length} recipes...`);

    // Process in batches to avoid overwhelming the system
    const BATCH_SIZE = 3;
    let processed = 0;

    for (let i = 0; i < recipes.length; i += BATCH_SIZE) {
      const batch = recipes.slice(i, i + BATCH_SIZE);
      
      await Promise.allSettled(
        batch.map(recipe => {
          if (recipe.url) {
            return this.getInstructions(recipe.url, scrapeFunction);
          }
        })
      );

      processed += batch.length;
      if (processed % 10 === 0) {
        console.log(`📊 Prefetched ${processed}/${recipes.length} instructions`);
      }
    }

    console.log(`✅ Instruction prefetch complete`);
  }

  /**
   * Clear instruction cache
   */
  async clearCache() {
    try {
      this.cache = {};
      await AsyncStorage.removeItem(INSTRUCTION_CACHE_KEY);
      console.log('🗑️ Instruction cache cleared');
    } catch (error) {
      console.error('❌ Failed to clear cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const entries = Object.keys(this.cache || {});
    const now = Date.now();
    
    const aged = entries.map(key => {
      const age = now - this.cache[key].timestamp;
      return Math.round(age / 1000 / 60 / 60 / 24); // Age in days
    });

    return {
      totalEntries: entries.length,
      maxEntries: MAX_CACHE_ENTRIES,
      expiryDays: CACHE_EXPIRY_DAYS,
      avgAgeDays: aged.length > 0 ? Math.round(aged.reduce((a, b) => a + b, 0) / aged.length) : 0
    };
  }
}

// Export singleton
const instructionCacheService = new InstructionCacheService();
export default instructionCacheService;
