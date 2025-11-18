// Edamam Recipe Search API Service
import AsyncStorage from '@react-native-async-storage/async-storage';

const EDAMAM_APP_ID = process.env.EXPO_PUBLIC_EDAMAM_APP_ID;
const EDAMAM_APP_KEY = process.env.EXPO_PUBLIC_EDAMAM_APP_KEY;
const EDAMAM_BASE_URL = 'https://api.edamam.com/api/recipes/v2';

// Instruction cache configuration
const INSTRUCTION_CACHE_KEY = 'recipe_instructions_cache';
const CACHE_EXPIRY_HOURS = 24; // Instructions cache for 24 hours

// Valid Edamam API values (from official documentation)
const VALID_CUISINE_TYPES = [
  'American', 'Asian', 'British', 'Caribbean', 'Central Europe',
  'Chinese', 'Eastern Europe', 'French', 'Indian', 'Italian', 
  'Japanese', 'Kosher', 'Mediterranean', 'Mexican', 'Middle Eastern',
  'Nordic', 'South American', 'South East Asian'
];

const VALID_MEAL_TYPES = ['Breakfast', 'Dinner', 'Lunch', 'Snack', 'Teatime'];

const VALID_DISH_TYPES = [
  'Biscuits and cookies', 'Bread', 'Cereals', 'Condiments and sauces',
  'Desserts', 'Drinks', 'Main course', 'Pancake', 'Preps', 'Preserve',
  'Salad', 'Sandwiches', 'Side dish', 'Soup', 'Starter', 'Sweets'
];

class EdamamService {
  /**
   * Sanitize and validate Edamam API parameters
   */
  static sanitizeEdamamParams(options) {
    const sanitized = { ...options };

    // Sanitize cuisineType
    if (sanitized.cuisineType) {
      // Map common variants to valid values
      const cuisineMap = {
        'filipino': 'Asian',
        'fusion': 'Asian', // Default fusion to Asian
        'filipino/fusion': 'Asian',
        'western': 'American',
        'spanish': 'Mediterranean',
        'thai': 'South East Asian',
        'vietnamese': 'South East Asian',
        'korean': 'Asian',
        'greek': 'Mediterranean',
        'turkish': 'Middle Eastern'
      };

      const lowerCuisine = sanitized.cuisineType.toLowerCase();
      const mapped = cuisineMap[lowerCuisine];
      
      if (mapped) {
        sanitized.cuisineType = mapped;
      } else {
        // Check if it's a valid cuisine type (case-insensitive)
        const validCuisine = VALID_CUISINE_TYPES.find(
          c => c.toLowerCase() === lowerCuisine
        );
        if (validCuisine) {
          sanitized.cuisineType = validCuisine;
        } else {
          // Invalid cuisine - remove it
          console.warn(`⚠️ Invalid cuisineType: ${sanitized.cuisineType}, removing filter`);
          delete sanitized.cuisineType;
        }
      }
    }

    // Sanitize mealType
    if (sanitized.mealType) {
      const mealMap = {
        'breakfast': 'Breakfast',
        'lunch': 'Lunch',
        'dinner': 'Dinner',
        'snack': 'Snack',
        'teatime': 'Teatime'
      };

      const lowerMeal = sanitized.mealType.toLowerCase();
      const mapped = mealMap[lowerMeal];
      
      if (mapped) {
        sanitized.mealType = mapped;
      } else {
        console.warn(`⚠️ Invalid mealType: ${sanitized.mealType}, removing filter`);
        delete sanitized.mealType;
      }
    }

    // Sanitize dishType
    if (sanitized.dishType) {
      const dishMap = {
        'main': 'Main course',
        'main course': 'Main course',
        'side': 'Side dish',
        'side dish': 'Side dish',
        'dessert': 'Desserts',
        'appetizer': 'Starter',
        'starter': 'Starter',
        'soup': 'Soup',
        'salad': 'Salad',
        'bread': 'Bread',
        'drink': 'Drinks',
        'sandwich': 'Sandwiches'
      };

      const lowerDish = sanitized.dishType.toLowerCase();
      const mapped = dishMap[lowerDish];
      
      if (mapped) {
        sanitized.dishType = mapped;
      } else {
        // Check if it's already valid (case-insensitive)
        const validDish = VALID_DISH_TYPES.find(
          d => d.toLowerCase() === lowerDish
        );
        if (validDish) {
          sanitized.dishType = validDish;
        } else {
          console.warn(`⚠️ Invalid dishType: ${sanitized.dishType}, removing filter`);
          delete sanitized.dishType;
        }
      }
    }

    return sanitized;
  }

  /**
   * Search for recipes using the Edamam API with intelligent caching
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
   * @param {boolean} options.skipCache - Skip cache lookup (default: false)
   * @returns {Promise<Object>} Recipe search results
   */
  static async searchRecipes(query, options = {}) {
    try {
      // Sanitize parameters before using them
      const sanitizedOptions = this.sanitizeEdamamParams(options);

      // ⚠️ CACHING DISABLED - Now handled by supabase-cache-service.js
      // Old AsyncStorage cache was filling device storage
      // Import RecipeCacheService dynamically to avoid circular dependency
      // const RecipeCacheService = (await import('./recipe-cache-service.js')).default;
      
      // Check cache first (unless explicitly skipped)
      // if (!sanitizedOptions.skipCache) {
      //   const cachedResults = RecipeCacheService.getCachedSearchResults(query, sanitizedOptions);
      //   if (cachedResults) {
      //     return {
      //       success: true,
      //       data: cachedResults,
      //       cached: true
      //     };
      //   }
      // }
      // Build URL parameters
      const params = new URLSearchParams({
        type: 'public',
        q: query,
        app_id: EDAMAM_APP_ID,
        app_key: EDAMAM_APP_KEY,
        from: sanitizedOptions.from || 0,
        to: sanitizedOptions.to || 20,
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

      // Add optional parameters (using sanitized options)
      if (sanitizedOptions.cuisineType) params.append('cuisineType', sanitizedOptions.cuisineType);
      if (sanitizedOptions.mealType) params.append('mealType', sanitizedOptions.mealType);
      if (sanitizedOptions.dishType) params.append('dishType', sanitizedOptions.dishType);
      if (sanitizedOptions.calories) params.append('calories', sanitizedOptions.calories);
      if (sanitizedOptions.time) params.append('time', sanitizedOptions.time);
      
      // Add health labels
      if (sanitizedOptions.health && Array.isArray(sanitizedOptions.health)) {
        sanitizedOptions.health.forEach(label => params.append('health', label));
      }
      
      // Add diet labels
      if (sanitizedOptions.diet && Array.isArray(sanitizedOptions.diet)) {
        sanitizedOptions.diet.forEach(label => params.append('diet', label));
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

      const searchResults = {
        count: data.count,
        from: data.from,
        to: data.to,
        more: data.more,
        recipes: data.hits?.map(hit => this.formatRecipe(hit.recipe)) || []
      };

      // ⚠️ CACHING DISABLED - Now handled by supabase-cache-service.js
      // Cache the results for future use (skip if this is for cache service itself)
      // if (!options.skipCache) {
      //   try {
      //     await RecipeCacheService.cacheSearchResults(query, options, searchResults);
      //   } catch (cacheError) {
      //     console.warn('⚠️ Failed to cache search results:', cacheError.message);
      //   }
      // }

      return {
        success: true,
        data: searchResults
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
        const formattedRecipe = this.formatRecipe(data.hits[0].recipe);
        console.log('✅ Recipe found and formatted');
        return {
          success: true,
          recipe: formattedRecipe // Changed from 'data' to 'recipe' for consistency
        };
      } else {
        // Recipe not found in API - this is expected for some URIs (removed recipes, rate limits, etc.)
        console.log('ℹ️ Recipe not found in API (will use cached data if available)');
        return {
          success: false,
          error: 'Recipe not found'
        };
      }

    } catch (error) {
      // Log network/API errors differently than "not found" errors
      if (error.message.includes('Recipe not found')) {
        console.log('ℹ️ Recipe not available from API:', error.message);
      } else {
        console.error('❌ API error:', error.message);
      }
      return {
        success: false,
        error: error.message || 'Failed to get recipe details'
      };
    }
  }

  /**
   * FAST scraping method for APK builds - prioritizes speed over completeness
   * @param {string} recipeUrl - Recipe URL
   * @returns {Promise<Object>} Instructions result
   */
  static async getRecipeInstructionsFast(recipeUrl) {
    try {
      console.log('⚡ Fast instruction extraction for:', recipeUrl);
      
      // Try only the fastest method - direct fetch with JSON-LD parsing
      const htmlContent = await this.optimizedDirectFetch(recipeUrl);
      if (htmlContent) {
        // Try JSON-LD extraction (fastest method)
        const instructions = this.extractJsonLdInstructions(htmlContent);
        if (instructions.length > 0) {
          console.log(`✅ Fast extraction successful: ${instructions.length} steps`);
          return {
            success: true,
            instructions,
            source: 'json-ld'
          };
        }
      }
      
      // If fast method fails, return immediately with fallback
      return {
        success: false,
        needsFullScrape: true
      };
    } catch (error) {
      return {
        success: false,
        needsFullScrape: true
      };
    }
  }

  /**
   * Extract recipe instructions from the recipe URL using OPTIMIZED web scraping
   * @param {string} recipeUrl - The URL of the original recipe
   * @returns {Promise<Object>} Instructions result object
   */
  static async getRecipeInstructions(recipeUrl) {
    try {
      console.log('🔍 Starting optimized instruction extraction for:', recipeUrl);
      
      // Check cache first
      const cachedInstructions = await this.getCachedInstructions(recipeUrl);
      if (cachedInstructions) {
        console.log('✅ Using cached instructions');
        return {
          success: true,
          instructions: cachedInstructions,
          cached: true
        };
      }

      // OPTIMIZED WEB SCRAPING with 10-second timeout
      console.log('🚀 Starting optimized web scraping with timeout...');
      
      // Try scraping with timeout wrapper
      const scrapingResult = await Promise.race([
        this.tryMultipleScrapeStrategies(recipeUrl),
        new Promise((resolve) => 
          setTimeout(() => {
            console.log('⏱️ Scraping timeout (10s) - will use fallback');
            resolve({ success: false, timeout: true });
          }, 10000)
        )
      ]);
      
      if (scrapingResult.success && scrapingResult.instructions && scrapingResult.instructions.length > 0) {
        console.log(`✅ Scraping successful: ${scrapingResult.instructions.length} steps`);
        await this.cacheInstructions(recipeUrl, scrapingResult.instructions);
        return scrapingResult;
      }
      
      // Only use fallback if scraping fails or times out
      if (scrapingResult.timeout) {
        console.log('⏱️ Scraping timed out - using smart fallback');
      } else {
        console.log('⚠️ Scraping failed - using smart fallback');
      }
      
      const fallbackInstructions = this.generateSmartFallback(recipeUrl);
      await this.cacheInstructions(recipeUrl, fallbackInstructions);
      
      return {
        success: true,
        instructions: fallbackInstructions,
        cached: false,
        fallback: true
      };
      
    } catch (error) {
      console.error('❌ Complete instruction extraction failure:', error);
      return this.generateFallbackInstructions();
    }
  }

  /**
   * Try multiple scraping strategies with site-specific optimizations (OPTIMIZED)
   * @param {string} recipeUrl - Recipe URL
   * @returns {Promise<Object>} Scraping result
   */
  static async tryMultipleScrapeStrategies(recipeUrl) {
    // Only use the fastest strategy with timeout
    const strategies = [
      () => this.scrapeSiteSpecific(recipeUrl)
    ];

    for (let i = 0; i < strategies.length; i++) {
      try {
        console.log(`🎯 Trying scraping strategy ${i + 1}...`);
        
        // Add 8-second timeout per strategy
        const result = await Promise.race([
          strategies[i](),
          new Promise((resolve) => 
            setTimeout(() => resolve({ success: false, strategyTimeout: true }), 8000)
          )
        ]);
        
        if (result.success && result.instructions && result.instructions.length > 0) {
          console.log(`✅ Strategy ${i + 1} successful with ${result.instructions.length} steps!`);
          return result;
        }
        
        if (result.strategyTimeout) {
          console.log(`⏱️ Strategy ${i + 1} timed out`);
        }
      } catch (error) {
        console.log(`❌ Strategy ${i + 1} failed:`, error.message);
        continue;
      }
    }
    
    return { success: false };
  }

  /**
   * Site-specific scraping optimized for popular recipe sites
   * @param {string} recipeUrl - Recipe URL
   * @returns {Promise<Object>} Scraping result
   */
  static async scrapeSiteSpecific(recipeUrl) {
    const domain = new URL(recipeUrl).hostname.toLowerCase();
    console.log('🎯 Site-specific scraping for domain:', domain);
    
    // Get HTML content first
    const htmlContent = await this.fetchWithBestMethod(recipeUrl);
    if (!htmlContent) {
      throw new Error('Failed to fetch content');
    }
    
    console.log('📄 Content fetched, length:', htmlContent.length);
    
    // Site-specific parsing strategies
    if (domain.includes('allrecipes')) {
      return this.parseAllRecipes(htmlContent);
    } else if (domain.includes('foodnetwork')) {
      return this.parseFoodNetwork(htmlContent);
    } else if (domain.includes('epicurious')) {
      return this.parseEpicurious(htmlContent);
    } else if (domain.includes('seriouseats')) {
      return this.parseSeriousEats(htmlContent);
    } else if (domain.includes('food.com')) {
      return this.parseFoodDotCom(htmlContent);
    } else if (domain.includes('food52')) {
      return this.parseFood52(htmlContent);
    } else if (domain.includes('marthastewart')) {
      return this.parseMarthaStewart(htmlContent);
    } else if (domain.includes('menshealth')) {
      return this.parseMensHealth(htmlContent);
    } else if (domain.includes('realsimple')) {
      return this.parseRealSimple(htmlContent);
    } else if (domain.includes('simplyrecipes')) {
      return this.parseSimplyRecipes(htmlContent);
    } else if (domain.includes('foodandwine')) {
      return this.parseFoodAndWine(htmlContent);
    } else {
      return this.parseGenericRecipe(htmlContent);
    }
  }

  /**
   * Fetch content using the most reliable method available (OPTIMIZED)
   * @param {string} url - URL to fetch
   * @returns {Promise<string|null>} HTML content
   */
  static async fetchWithBestMethod(url) {
    const methods = [
      // Method 1: Multiple reliable proxies in parallel
      () => this.parallelProxyFetch(url),
      // Method 2: Direct fetch with optimal headers
      () => this.optimizedDirectFetch(url)
    ];

    for (const method of methods) {
      try {
        // Add 5-second timeout per method
        const content = await Promise.race([
          method(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Method timeout')), 5000)
          )
        ]);
        
        if (content && content.length > 200) {
          return content;
        }
      } catch (error) {
        console.log('Fetch method failed:', error.message);
        continue;
      }
    }
    
    return null;
  }

  /**
   * Try multiple proxies in parallel for faster results
   * @param {string} url - URL to fetch
   * @returns {Promise<string>} HTML content
   */
  static async parallelProxyFetch(url) {
    console.log('🚀 Trying parallel proxy fetch...');
    
    const proxyPromises = [
      this.fetchViaProxy(url, 'allorigins'),
      this.fetchViaProxy(url, 'corsproxy'),
      this.fetchViaProxy(url, 'thingproxy')
    ];

    try {
      // Race the promises - use the first one that succeeds
      const result = await Promise.race(proxyPromises);
      console.log('✅ Parallel proxy fetch successful');
      return result;
    } catch (error) {
      console.log('❌ All parallel proxies failed');
      throw error;
    }
  }

  /**
   * Fetch via specific proxy service
   * @param {string} url - URL to fetch
   * @param {string} proxyType - Type of proxy to use
   * @returns {Promise<string>} HTML content
   */
  static async fetchViaProxy(url, proxyType) {
    let proxyUrl;
    
    switch (proxyType) {
      case 'allorigins':
        proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        break;
      case 'corsproxy':
        proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
        break;
      case 'thingproxy':
        proxyUrl = `https://thingproxy.freeboard.io/fetch/${url}`;
        break;
      default:
        throw new Error('Unknown proxy type');
    }

    console.log(`🌐 Fetching via ${proxyType}:`, proxyUrl);
    
    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'RecipeApp/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`${proxyType} proxy failed: ${response.status}`);
    }

    if (proxyType === 'allorigins') {
      const data = await response.json();
      return data.contents;
    } else {
      return await response.text();
    }
  }

  /**
   * Optimized direct fetch with best headers for recipe sites
   * @param {string} url - URL to fetch
   * @returns {Promise<string>} HTML content
   */
  static async optimizedDirectFetch(url) {
    console.log('🎯 Trying optimized direct fetch...');
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });

    if (!response.ok) {
      throw new Error(`Direct fetch failed: ${response.status}`);
    }

    const content = await response.text();
    console.log('✅ Direct fetch successful, content length:', content.length);
    return content;
  }

  /**
   * Aggressive proxy scraping with multiple retry strategies
   * @param {string} recipeUrl - Recipe URL
   * @returns {Promise<Object>} Scraping result
   */
  static async aggressiveProxyScraping(recipeUrl) {
    console.log('🔥 Starting aggressive proxy scraping...');
    
    try {
      const htmlContent = await this.fetchWithBestMethod(recipeUrl);
      if (htmlContent) {
        const instructions = this.extractHtmlInstructionsAggressive(htmlContent);
        if (instructions.length > 0) {
          return {
            success: true,
            instructions: instructions,
            source: 'aggressive-proxy'
          };
        }
      }
    } catch (error) {
      console.log('❌ Aggressive proxy scraping failed:', error.message);
    }
    
    return { success: false };
  }

  /**
   * Alternative parsing approach with different strategies
   * @param {string} recipeUrl - Recipe URL
   * @returns {Promise<Object>} Scraping result
   */
  static async alternativeParsingApproach(recipeUrl) {
    console.log('🔍 Trying alternative parsing approach...');
    
    try {
      const htmlContent = await this.fetchWithBestMethod(recipeUrl);
      if (htmlContent) {
        // Try desperate extraction
        const instructions = this.extractDesperateInstructions(htmlContent);
        if (instructions.length > 0) {
          return {
            success: true,
            instructions: instructions,
            source: 'alternative-parsing'
          };
        }
      }
    } catch (error) {
      console.log('❌ Alternative parsing failed:', error.message);
    }
    
    return { success: false };
  }

  /**
   * Scrape with multiple proxies strategy
   * @param {string} recipeUrl - Recipe URL
   * @returns {Promise<Object>} Scraping result
   */
  static async scrapeWithMultipleProxies(recipeUrl) {
    console.log('🌐 Scraping with multiple proxies...');
    
    try {
      const htmlContent = await this.parallelProxyFetch(recipeUrl);
      if (htmlContent) {
        const instructions = this.parseGenericRecipe(htmlContent);
        return instructions;
      }
    } catch (error) {
      console.log('❌ Multiple proxy scraping failed:', error.message);
    }
    
    return { success: false };
  }

  /**
   * Scrape with alternative headers
   * @param {string} recipeUrl - Recipe URL
   * @returns {Promise<Object>} Scraping result
   */
  static async scrapeWithAlternativeHeaders(recipeUrl) {
    console.log('📋 Scraping with alternative headers...');
    
    try {
      const response = await fetch(recipeUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      });

      if (response.ok) {
        const htmlContent = await response.text();
        const instructions = this.parseGenericRecipe(htmlContent);
        return instructions;
      }
    } catch (error) {
      console.log('❌ Alternative headers scraping failed:', error.message);
    }
    
    return { success: false };
  }

  /**
   * Scrape with mobile user agent
   * @param {string} recipeUrl - Recipe URL
   * @returns {Promise<Object>} Scraping result
   */
  static async scrapeWithMobileUserAgent(recipeUrl) {
    console.log('📱 Scraping with mobile user agent...');
    
    try {
      const response = await fetch(recipeUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        }
      });

      if (response.ok) {
        const htmlContent = await response.text();
        const instructions = this.parseGenericRecipe(htmlContent);
        return instructions;
      }
    } catch (error) {
      console.log('❌ Mobile user agent scraping failed:', error.message);
    }
    
    return { success: false };
  }

  /**
   * Backup proxy fetch with different services
   * @param {string} url - URL to fetch
   * @returns {Promise<string>} HTML content
   */
  static async backupProxyFetch(url) {
    console.log('🔄 Trying backup proxy services...');
    
    const backupProxies = [
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
      `https://cors-proxy.htmldriven.com/?url=${encodeURIComponent(url)}`
    ];

    for (const proxyUrl of backupProxies) {
      try {
        console.log('🌐 Trying backup proxy:', proxyUrl);
        const response = await fetch(proxyUrl);
        
        if (response.ok) {
          const content = await response.text();
          if (content && content.length > 200) {
            console.log('✅ Backup proxy successful');
            return content;
          }
        }
      } catch (error) {
        console.log('❌ Backup proxy failed:', error.message);
        continue;
      }
    }
    
    throw new Error('All backup proxies failed');
  }

  /**
   * Fetch recipe content using various methods to bypass CORS
   * @param {string} recipeUrl - Recipe URL
   * @returns {Promise<string|null>} HTML content or null
   */
  static async fetchRecipeContent(recipeUrl) {
    console.log('🔄 Starting fetchRecipeContent for:', recipeUrl);
    
    const methods = [
      // Method 1: Proxy service (most likely to work in React Native)
      () => this.proxyFetch(recipeUrl),
      // Method 2: Direct fetch (try this second)
      () => this.directFetch(recipeUrl),
      // Method 3: Alternative proxy
      () => this.alternativeProxyFetch(recipeUrl)
    ];

    for (let i = 0; i < methods.length; i++) {
      const methodName = ['Proxy', 'Direct', 'Alternative Proxy'][i];
      try {
        console.log(`🌐 Trying method ${i + 1}: ${methodName}`);
        const content = await methods[i]();
        
        if (content && content.length > 500) { // Lower threshold for initial testing
          console.log(`✅ ${methodName} fetch successful, content length:`, content.length);
          return content;
        } else {
          console.log(`❌ ${methodName} fetch returned insufficient content:`, content?.length || 0);
        }
      } catch (error) {
        console.log(`❌ ${methodName} fetch failed:`, error.message);
        continue;
      }
    }

    console.log('❌ All fetch methods failed');
    return null;
  }

  /**
   * Direct fetch method (simplified for React Native)
   * @param {string} url - Recipe URL
   * @returns {Promise<string>} HTML content
   */
  static async directFetch(url) {
    console.log('🌐 Attempting direct fetch for:', url);
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'RecipeApp/1.0 (Mobile)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
      });

      console.log('📡 Direct fetch response status:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const content = await response.text();
      console.log('📄 Direct fetch content length:', content.length);
      
      return content;
    } catch (error) {
      console.log('❌ Direct fetch failed:', error.message);
      throw error;
    }
  }

  /**
   * Proxy fetch method using reliable CORS proxies
   * @param {string} url - Recipe URL
   * @returns {Promise<string>} HTML content
   */
  static async proxyFetch(url) {
    console.log('🌐 Attempting proxy fetch for:', url);
    
    // Use AllOrigins as primary proxy (most reliable for React Native)
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    console.log('🔗 Proxy URL:', proxyUrl);
    
    try {
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('📡 Proxy response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`Proxy responded with status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('📄 Proxy response received, content length:', data.contents?.length || 0);
      
      if (data.contents && data.contents.length > 100) {
        return data.contents;
      } else {
        throw new Error('Proxy returned empty or insufficient content');
      }
    } catch (error) {
      console.log('❌ AllOrigins proxy failed:', error.message);
      throw error;
    }
  }

  /**
   * Alternative proxy fetch method
   * @param {string} url - Recipe URL
   * @returns {Promise<string>} HTML content
   */
  static async alternativeProxyFetch(url) {
    console.log('🌐 Attempting alternative proxy fetch for:', url);
    
    const proxies = [
      {
        url: `https://corsproxy.io/?${encodeURIComponent(url)}`,
        format: 'text'
      },
      {
        url: `https://proxy.cors.sh/${url}`,
        format: 'text'
      }
    ];

    for (const proxy of proxies) {
      try {
        console.log('🔗 Trying proxy:', proxy.url);
        const response = await fetch(proxy.url, {
          method: 'GET',
          headers: {
            'User-Agent': 'RecipeApp/1.0',
          }
        });
        
        console.log('📡 Response status:', response.status);
        
        if (!response.ok) {
          console.log('❌ Proxy responded with error status');
          continue;
        }
        
        const content = await response.text();
        console.log('📄 Content length received:', content.length);
        
        if (content && content.length > 100) {
          return content;
        }
      } catch (error) {
        console.log(`❌ Proxy ${proxy.url} failed:`, error.message);
        continue;
      }
    }
    
    throw new Error('All alternative proxies failed');
  }

  /**
   * CORS proxy fetch method
   * @param {string} url - Recipe URL
   * @returns {Promise<string>} HTML content
   */
  static async corsFetch(url) {
    const corsProxyUrl = `https://cors-anywhere.herokuapp.com/${url}`;
    const response = await fetch(corsProxyUrl, {
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
      }
    });
    
    if (!response.ok) {
      throw new Error(`CORS proxy failed: ${response.status}`);
    }
    
    return await response.text();
  }

  /**
   * Parse AllRecipes.com specifically
   * @param {string} htmlContent - HTML content
   * @returns {Object} Parsing result
   */
  static parseAllRecipes(htmlContent) {
    console.log('🥘 Parsing AllRecipes...');
    
    const instructions = [];
    
    try {
      // AllRecipes uses specific classes and structures
      const patterns = [
        // New AllRecipes structure
        /<span[^>]*class[^>]*instruction-text[^>]*>(.*?)<\/span>/gi,
        /<div[^>]*class[^>]*recipe-instruction[^>]*>(.*?)<\/div>/gi,
        // JSON-LD specifically for AllRecipes
        /"recipeInstructions"\s*:\s*\[(.*?)\]/gi,
        // Ordered list approach
        /<ol[^>]*class[^>]*recipe-directions[^>]*>(.*?)<\/ol>/gi
      ];

      for (const pattern of patterns) {
        const matches = [...htmlContent.matchAll(pattern)];
        
        for (const match of matches) {
          if (pattern.source.includes('recipeInstructions')) {
            // Parse JSON structure
            try {
              const jsonStr = '[' + match[1] + ']';
              const parsed = JSON.parse(jsonStr);
              for (const item of parsed) {
                if (item.text) {
                  instructions.push(this.cleanInstructionText(item.text));
                }
              }
            } catch (e) {
              continue;
            }
          } else {
            const cleaned = this.cleanInstructionText(match[1]);
            if (this.isValidInstruction(cleaned)) {
              instructions.push(cleaned);
            }
          }
        }
        
        if (instructions.length > 0) break;
      }
      
      return {
        success: instructions.length > 0,
        instructions: instructions.slice(0, 20),
        source: 'allrecipes'
      };
    } catch (error) {
      console.log('❌ AllRecipes parsing failed:', error.message);
      return { success: false };
    }
  }

  /**
   * Parse Food Network specifically
   * @param {string} htmlContent - HTML content
   * @returns {Object} Parsing result
   */
  static parseFoodNetwork(htmlContent) {
    console.log('📺 Parsing Food Network...');
    
    const instructions = [];
    
    try {
      const patterns = [
        /<li[^>]*class[^>]*o-Method__m-Step[^>]*>(.*?)<\/li>/gi,
        /<div[^>]*class[^>]*o-Method__m-Body[^>]*>(.*?)<\/div>/gi,
        /<p[^>]*class[^>]*o-AssetTitle__a-HeadlineText[^>]*>(.*?)<\/p>/gi
      ];

      for (const pattern of patterns) {
        const matches = [...htmlContent.matchAll(pattern)];
        
        for (const match of matches) {
          const cleaned = this.cleanInstructionText(match[1]);
          // isValidInstruction already checks length, no need for redundant check
          if (this.isValidInstruction(cleaned)) {
            instructions.push(cleaned);
          }
        }
        
        if (instructions.length > 0) break;
      }
      
      return {
        success: instructions.length > 0,
        instructions: instructions.slice(0, 20),
        source: 'foodnetwork'
      };
    } catch (error) {
      console.log('❌ Food Network parsing failed:', error.message);
      return { success: false };
    }
  }

  /**
   * Parse Epicurious specifically
   * @param {string} htmlContent - HTML content
   * @returns {Object} Parsing result
   */
  static parseEpicurious(htmlContent) {
    console.log('🍽️ Parsing Epicurious...');
    
    const instructions = [];
    
    try {
      const patterns = [
        /<div[^>]*class[^>]*preparation-step[^>]*>(.*?)<\/div>/gi,
        /<li[^>]*class[^>]*preparation-step[^>]*>(.*?)<\/li>/gi,
        /<p[^>]*class[^>]*preparation-step[^>]*>(.*?)<\/p>/gi
      ];

      for (const pattern of patterns) {
        const matches = [...htmlContent.matchAll(pattern)];
        
        for (const match of matches) {
          const cleaned = this.cleanInstructionText(match[1]);
          if (this.isValidInstruction(cleaned)) {
            instructions.push(cleaned);
          }
        }
        
        if (instructions.length > 0) break;
      }
      
      return {
        success: instructions.length > 0,
        instructions: instructions.slice(0, 20),
        source: 'epicurious'
      };
    } catch (error) {
      console.log('❌ Epicurious parsing failed:', error.message);
      return { success: false };
    }
  }

  /**
   * Parse Serious Eats specifically
   * @param {string} htmlContent - HTML content
   * @returns {Object} Parsing result
   */
  static parseSeriousEats(htmlContent) {
    console.log('🧑‍🍳 Parsing Serious Eats...');
    
    const instructions = [];
    
    try {
      // Try JSON-LD first (most reliable for Serious Eats)
      const jsonLdInstructions = this.extractJsonLdInstructions(htmlContent);
      if (jsonLdInstructions.length > 0) {
        console.log(`✅ Extracted ${jsonLdInstructions.length} instructions from Serious Eats JSON-LD`);
        return {
          success: true,
          instructions: jsonLdInstructions,
          source: 'seriouseats-jsonld'
        };
      }
      
      // Fallback to HTML patterns (updated for current Serious Eats structure)
      const patterns = [
        /<li[^>]*class[^>]*structured-method__list-item[^>]*>(.*?)<\/li>/gi,
        /<li[^>]*class[^>]*mntl-sc-block-html[^>]*>(.*?)<\/li>/gi,
        /<div[^>]*class[^>]*recipe-procedure-text[^>]*>(.*?)<\/div>/gi,
        /<p[^>]*class[^>]*recipe-instruction[^>]*>(.*?)<\/p>/gi,
        /<li[^>]*class[^>]*comp[^>]*mntl-sc-block[^>]*>(.*?)<\/li>/gi
      ];

      for (const pattern of patterns) {
        const matches = [...htmlContent.matchAll(pattern)];
        
        for (const match of matches) {
          const cleaned = this.cleanInstructionText(match[1]);
          if (this.isValidInstruction(cleaned)) {
            instructions.push(cleaned);
          }
        }
        
        if (instructions.length > 0) break;
      }
      
      return {
        success: instructions.length > 0,
        instructions: instructions.slice(0, 20),
        source: 'seriouseats-html'
      };
    } catch (error) {
      console.log('❌ Serious Eats parsing failed:', error.message);
      return { success: false };
    }
  }

  /**
   * Parse Food.com specifically
   * @param {string} htmlContent - HTML content
   * @returns {Object} Parsing result
   */
  static parseFoodDotCom(htmlContent) {
    console.log('🍴 Parsing Food.com...');
    
    const instructions = [];
    
    try {
      const patterns = [
        /<span[^>]*class[^>]*recipe-directions__list__item[^>]*>(.*?)<\/span>/gi,
        /<div[^>]*class[^>]*directions__section__body[^>]*>(.*?)<\/div>/gi,
        /<li[^>]*class[^>]*recipe-directions[^>]*>(.*?)<\/li>/gi
      ];

      for (const pattern of patterns) {
        const matches = [...htmlContent.matchAll(pattern)];
        
        for (const match of matches) {
          const cleaned = this.cleanInstructionText(match[1]);
          if (this.isValidInstruction(cleaned)) {
            instructions.push(cleaned);
          }
        }
        
        if (instructions.length > 0) break;
      }
      
      return {
        success: instructions.length > 0,
        instructions: instructions.slice(0, 20),
        source: 'fooddotcom'
      };
    } catch (error) {
      console.log('❌ Food.com parsing failed:', error.message);
      return { success: false };
    }
  }

  /**
   * Parse Food52 specifically
   * @param {string} htmlContent - HTML content
   * @returns {Object} Parsing result
   */
  static parseFood52(htmlContent) {
    console.log('🍽️ Parsing Food52...');
    
    const instructions = [];
    
    try {
      // Try JSON-LD first (most reliable for Food52)
      const jsonLdInstructions = this.extractJsonLdInstructions(htmlContent);
      if (jsonLdInstructions.length > 0) {
        console.log(`✅ Extracted ${jsonLdInstructions.length} instructions from Food52 JSON-LD`);
        return {
          success: true,
          instructions: jsonLdInstructions,
          source: 'food52-jsonld'
        };
      }
      
      // Fallback to HTML patterns
      const patterns = [
        /<li[^>]*class[^>]*recipe__list-step[^>]*>(.*?)<\/li>/gi,
        /<div[^>]*class[^>]*recipe-step[^>]*>(.*?)<\/div>/gi,
        /<p[^>]*class[^>]*step-text[^>]*>(.*?)<\/p>/gi,
        /<div[^>]*data-test[^>]*="recipe-step"[^>]*>(.*?)<\/div>/gi
      ];

      for (const pattern of patterns) {
        const matches = [...htmlContent.matchAll(pattern)];
        
        for (const match of matches) {
          const cleaned = this.cleanInstructionText(match[1]);
          if (this.isValidInstruction(cleaned)) {
            instructions.push(cleaned);
          }
        }
        
        if (instructions.length > 0) break;
      }
      
      return {
        success: instructions.length > 0,
        instructions: instructions.slice(0, 20),
        source: 'food52-html'
      };
    } catch (error) {
      console.log('❌ Food52 parsing failed:', error.message);
      return { success: false };
    }
  }

  /**
   * Parse Martha Stewart specifically
   * @param {string} htmlContent - HTML content
   * @returns {Object} Parsing result
   */
  static parseMarthaStewart(htmlContent) {
    console.log('👩‍🍳 Parsing Martha Stewart...');
    
    const instructions = [];
    
    try {
      // Try JSON-LD first (most reliable for Martha Stewart)
      const jsonLdInstructions = this.extractJsonLdInstructions(htmlContent);
      if (jsonLdInstructions.length > 0) {
        console.log(`✅ Extracted ${jsonLdInstructions.length} instructions from Martha Stewart JSON-LD`);
        return {
          success: true,
          instructions: jsonLdInstructions,
          source: 'marthastewart-jsonld'
        };
      }
      
      // Fallback to HTML patterns
      const patterns = [
        /<li[^>]*class[^>]*step[^>]*>(.*?)<\/li>/gi,
        /<div[^>]*class[^>]*recipe-step[^>]*>(.*?)<\/div>/gi,
        /<p[^>]*class[^>]*direction[^>]*>(.*?)<\/p>/gi,
        /<li[^>]*class[^>]*direction-item[^>]*>(.*?)<\/li>/gi,
        /<div[^>]*class[^>]*direction__text[^>]*>(.*?)<\/div>/gi
      ];

      for (const pattern of patterns) {
        const matches = [...htmlContent.matchAll(pattern)];
        
        for (const match of matches) {
          const cleaned = this.cleanInstructionText(match[1]);
          if (this.isValidInstruction(cleaned)) {
            instructions.push(cleaned);
          }
        }
        
        if (instructions.length > 0) break;
      }
      
      return {
        success: instructions.length > 0,
        instructions: instructions.slice(0, 20),
        source: 'marthastewart-html'
      };
    } catch (error) {
      console.log('❌ Martha Stewart parsing failed:', error.message);
      return { success: false };
    }
  }

  /**
   * Parse Simply Recipes specifically
   * @param {string} htmlContent - HTML content
   * @returns {Object} Parsing result
   */
  static parseSimplyRecipes(htmlContent) {
    console.log('📖 Parsing Simply Recipes...');
    
    const instructions = [];
    
    try {
      // Try JSON-LD first
      const jsonLdInstructions = this.extractJsonLdInstructions(htmlContent);
      if (jsonLdInstructions.length > 0) {
        console.log(`✅ Extracted ${jsonLdInstructions.length} instructions from Simply Recipes JSON-LD`);
        return {
          success: true,
          instructions: jsonLdInstructions,
          source: 'simplyrecipes-jsonld'
        };
      }
      
      // Fallback to HTML patterns
      const patterns = [
        /<li[^>]*class[^>]*structured-project__steps__list-item[^>]*>(.*?)<\/li>/gi,
        /<li[^>]*class[^>]*comp[^>]*mntl-sc-block[^>]*>(.*?)<\/li>/gi,
        /<div[^>]*class[^>]*entry-details[^>]*instruction[^>]*>(.*?)<\/div>/gi,
        /<p[^>]*class[^>]*direction[^>]*>(.*?)<\/p>/gi
      ];

      for (const pattern of patterns) {
        const matches = [...htmlContent.matchAll(pattern)];
        
        for (const match of matches) {
          const cleaned = this.cleanInstructionText(match[1]);
          if (this.isValidInstruction(cleaned)) {
            instructions.push(cleaned);
          }
        }
        
        if (instructions.length > 0) break;
      }
      
      return {
        success: instructions.length > 0,
        instructions: instructions.slice(0, 20),
        source: 'simplyrecipes-html'
      };
    } catch (error) {
      console.log('❌ Simply Recipes parsing failed:', error.message);
      return { success: false };
    }
  }

  /**
   * Parse Food & Wine specifically
   * @param {string} htmlContent - HTML content
   * @returns {Object} Parsing result
   */
  static parseFoodAndWine(htmlContent) {
    console.log('🍷 Parsing Food & Wine...');
    
    const instructions = [];
    
    try {
      // Try JSON-LD first
      const jsonLdInstructions = this.extractJsonLdInstructions(htmlContent);
      if (jsonLdInstructions.length > 0) {
        console.log(`✅ Extracted ${jsonLdInstructions.length} instructions from Food & Wine JSON-LD`);
        return {
          success: true,
          instructions: jsonLdInstructions,
          source: 'foodandwine-jsonld'
        };
      }
      
      // Fallback to HTML patterns
      const patterns = [
        /<li[^>]*class[^>]*instructions__item[^>]*>(.*?)<\/li>/gi,
        /<div[^>]*class[^>]*recipe-step[^>]*>(.*?)<\/div>/gi,
        /<p[^>]*class[^>]*step-text[^>]*>(.*?)<\/p>/gi,
        /<li[^>]*class[^>]*comp[^>]*mntl-sc-block[^>]*>(.*?)<\/li>/gi
      ];

      for (const pattern of patterns) {
        const matches = [...htmlContent.matchAll(pattern)];
        
        for (const match of matches) {
          const cleaned = this.cleanInstructionText(match[1]);
          if (this.isValidInstruction(cleaned)) {
            instructions.push(cleaned);
          }
        }
        
        if (instructions.length > 0) break;
      }
      
      return {
        success: instructions.length > 0,
        instructions: instructions.slice(0, 20),
        source: 'foodandwine-html'
      };
    } catch (error) {
      console.log('❌ Food & Wine parsing failed:', error.message);
      return { success: false };
    }
  }

  /**
   * Parse Men's Health specifically
   * @param {string} htmlContent - HTML content
   * @returns {Object} Parsing result
   */
  static parseMensHealth(htmlContent) {
    console.log('💪 Parsing Men\'s Health...');
    
    const instructions = [];
    
    try {
      // Try JSON-LD first (most reliable)
      const jsonLdInstructions = this.extractJsonLdInstructions(htmlContent);
      if (jsonLdInstructions.length > 0) {
        console.log(`✅ Extracted ${jsonLdInstructions.length} instructions from Men's Health JSON-LD`);
        return {
          success: true,
          instructions: jsonLdInstructions,
          source: 'menshealth-jsonld'
        };
      }
      
      // Fallback to HTML patterns specific to Men's Health structure
      const patterns = [
        /<li[^>]*class[^>]*comp[^>]*mntl-sc-block[^>]*mntl-sc-block-html[^>]*>(.*?)<\/li>/gi,
        /<div[^>]*class[^>]*recipe-step[^>]*>(.*?)<\/div>/gi,
        /<p[^>]*class[^>]*instruction-text[^>]*>(.*?)<\/p>/gi,
        /<li[^>]*class[^>]*direction[^>]*>(.*?)<\/li>/gi,
        /<div[^>]*class[^>]*mntl-sc-block-html[^>]*>(.*?)<\/div>/gi
      ];

      for (const pattern of patterns) {
        const matches = [...htmlContent.matchAll(pattern)];
        
        for (const match of matches) {
          const cleaned = this.cleanInstructionText(match[1]);
          if (this.isValidInstruction(cleaned)) {
            instructions.push(cleaned);
          }
        }
        
        if (instructions.length > 0) break;
      }
      
      return {
        success: instructions.length > 0,
        instructions: instructions.slice(0, 20),
        source: 'menshealth-html'
      };
    } catch (error) {
      console.log('❌ Men\'s Health parsing failed:', error.message);
      return { success: false };
    }
  }

  /**
   * Parse Real Simple specifically
   * @param {string} htmlContent - HTML content
   * @returns {Object} Parsing result
   */
  static parseRealSimple(htmlContent) {
    console.log('🏠 Parsing Real Simple...');
    
    const instructions = [];
    
    try {
      // Try JSON-LD first (most reliable for Real Simple)
      const jsonLdInstructions = this.extractJsonLdInstructions(htmlContent);
      if (jsonLdInstructions.length > 0) {
        console.log(`✅ Extracted ${jsonLdInstructions.length} instructions from Real Simple JSON-LD`);
        return {
          success: true,
          instructions: jsonLdInstructions,
          source: 'realsimple-jsonld'
        };
      }
      
      // Fallback to HTML patterns specific to Real Simple structure
      const patterns = [
        /<li[^>]*class[^>]*comp[^>]*mntl-sc-block[^>]*>(.*?)<\/li>/gi,
        /<div[^>]*class[^>]*recipe-instructions__item[^>]*>(.*?)<\/div>/gi,
        /<p[^>]*class[^>]*direction-text[^>]*>(.*?)<\/p>/gi,
        /<li[^>]*class[^>]*mntl-sc-block-html[^>]*>(.*?)<\/li>/gi,
        /<div[^>]*class[^>]*step-by-step[^>]*>(.*?)<\/div>/gi
      ];

      for (const pattern of patterns) {
        const matches = [...htmlContent.matchAll(pattern)];
        
        for (const match of matches) {
          const cleaned = this.cleanInstructionText(match[1]);
          if (this.isValidInstruction(cleaned)) {
            instructions.push(cleaned);
          }
        }
        
        if (instructions.length > 0) break;
      }
      
      return {
        success: instructions.length > 0,
        instructions: instructions.slice(0, 20),
        source: 'realsimple-html'
      };
    } catch (error) {
      console.log('❌ Real Simple parsing failed:', error.message);
      return { success: false };
    }
  }

  /**
   * Parse any recipe site with aggressive generic approach
   * @param {string} htmlContent - HTML content
   * @returns {Object} Parsing result
```   */
  static parseGenericRecipe(htmlContent) {
    console.log('🔍 Using aggressive generic parsing...');
    
    const instructions = [];
    
    try {
      // Aggressive JSON-LD extraction
      const jsonLdInstructions = this.extractJsonLdInstructionsAggressive(htmlContent);
      if (jsonLdInstructions.length > 0) {
        return {
          success: true,
          instructions: jsonLdInstructions,
          source: 'jsonld'
        };
      }

      // Aggressive HTML pattern matching
      const htmlInstructions = this.extractHtmlInstructionsAggressive(htmlContent);
      if (htmlInstructions.length > 0) {
        return {
          success: true,
          instructions: htmlInstructions,
          source: 'html'
        };
      }

      // Last resort: find any numbered or bulleted content that looks like instructions
      const desperateInstructions = this.extractDesperateInstructions(htmlContent);
      if (desperateInstructions.length > 0) {
        return {
          success: true,
          instructions: desperateInstructions,
          source: 'desperate'
        };
      }
      
      return { success: false };
    } catch (error) {
      console.log('❌ Generic parsing failed:', error.message);
      return { success: false };
    }
  }

  /**
   * Aggressive JSON-LD extraction that tries harder (with STRICT validation)
   * @param {string} htmlContent - HTML content
   * @returns {Array} Instructions
   */
  static extractJsonLdInstructionsAggressive(htmlContent) {
    const instructions = [];
    
    try {
      // Find all script tags with JSON-LD
      const jsonLdRegex = /<script[^>]*type[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
      const scripts = [...htmlContent.matchAll(jsonLdRegex)];
      
      console.log(`🔍 Found ${scripts.length} JSON-LD scripts`);
      
      for (const script of scripts) {
        try {
          let jsonContent = script[1].trim();
          
          // Clean up common JSON issues
          jsonContent = jsonContent.replace(/\n/g, ' ').replace(/\r/g, '');
          
          const data = JSON.parse(jsonContent);
          const recipes = Array.isArray(data) ? data : [data];
          
          for (const item of recipes) {
            // Check multiple possible structures
            const recipe = item['@type'] === 'Recipe' ? item : 
                          item['@graph']?.find(g => g['@type'] === 'Recipe') ||
                          item.recipe;
            
            if (recipe?.recipeInstructions) {
              console.log(`📋 Found ${recipe.recipeInstructions.length || 1} instructions in JSON-LD`);
              const instructionData = Array.isArray(recipe.recipeInstructions)
                ? recipe.recipeInstructions
                : [recipe.recipeInstructions];
              
              for (const instruction of instructionData) {
                let text = '';
                
                if (typeof instruction === 'string') {
                  text = instruction;
                } else if (instruction.text) {
                  text = instruction.text;
                } else if (instruction.name) {
                  text = instruction.name;
                } else if (instruction['@type'] === 'HowToStep' && instruction.text) {
                  text = instruction.text;
                } else if (instruction['@type'] === 'HowToSection') {
                  // Handle sections with multiple steps
                  const steps = instruction.itemListElement || [];
                  for (const step of steps) {
                    const stepText = step.text || step.name || '';
                    if (stepText && stepText.length > 10) {
                      const cleaned = this.cleanInstructionText(stepText);
                      // STRICT validation
                      if (this.isValidInstruction(cleaned)) {
                        instructions.push(cleaned);
                      }
                    }
                  }
                  continue;
                }
                
                if (text && text.length > 5) {
                  const cleaned = this.cleanInstructionText(text);
                  // STRICT validation - must be actual cooking instruction
                  if (cleaned.length > 10 && this.isValidInstruction(cleaned)) {
                    instructions.push(cleaned);
                    console.log(`✅ Valid instruction: ${cleaned.substring(0, 60)}...`);
                  } else {
                    console.log(`🚫 Rejected: ${cleaned.substring(0, 60)}...`);
                  }
                }
              }
              
              if (instructions.length > 0) {
                console.log(`✅ Aggressive JSON-LD: ${instructions.length} validated instructions`);
                return instructions.slice(0, 25);
              }
            }
          }
        } catch (e) {
          console.log('⚠️ JSON parsing failed for script, continuing...');
          continue;
        }
      }
    } catch (error) {
      console.log('JSON-LD aggressive extraction failed:', error.message);
    }
    
    return instructions;
  }

  /**
   * Aggressive HTML pattern extraction (with STRICT validation)
   * @param {string} htmlContent - HTML content
   * @returns {Array} Instructions
   */
  static extractHtmlInstructionsAggressive(htmlContent) {
    const instructions = [];
    
    try {
      // Much more comprehensive pattern list BUT with strict validation
      const patterns = [
        // Common instruction containers (MOST SPECIFIC FIRST)
        /<ol[^>]*class[^>]*(?:instructions|directions|method|steps|recipe-instructions|recipe-directions)[^>]*>(.*?)<\/ol>/gi,
        /<ul[^>]*class[^>]*(?:instructions|directions|method|steps|recipe-instructions)[^>]*>(.*?)<\/ul>/gi,
        /<div[^>]*class[^>]*(?:instructions|directions|method|steps|recipe-instructions|instruction-list)[^>]*>(.*?)<\/div>/gi,
        
        // Numbered steps (specific classes)
        /<div[^>]*class[^>]*(?:step|instruction-step|recipe-step)[^>]*>(.*?)<\/div>/gi,
        /<p[^>]*class[^>]*(?:step|instruction-step|recipe-step)[^>]*>(.*?)<\/p>/gi,
        
        // Individual instruction items
        /<li[^>]*class[^>]*(?:instruction|step|direction)[^>]*>(.*?)<\/li>/gi
      ];

      for (const pattern of patterns) {
        const matches = [...htmlContent.matchAll(pattern)];
        console.log(`🔍 Aggressive pattern found ${matches.length} matches`);
        
        for (const match of matches) {
          const content = match[1];
          
          // Skip sections that look like ingredient lists
          if (/(?:ingredients?|what you need|shopping list)/i.test(content.substring(0, 100))) {
            console.log('🚫 Skipping - looks like ingredient section');
            continue;
          }
          
          // Extract list items if this is a list container
          if (pattern.source.includes('<ol') || pattern.source.includes('<ul') || pattern.source.includes('<div')) {
            const listItems = [...content.matchAll(/<li[^>]*>(.*?)<\/li>/gi)];
            
            if (listItems.length > 0) {
              for (const item of listItems) {
                const text = this.cleanInstructionText(item[1]);
                // STRICT validation - must have action verbs, not be ingredients
                if (text.length > 15 && text.length < 800 && this.isValidInstruction(text)) {
                  instructions.push(text);
                }
              }
            } else {
              // Try paragraphs within the container
              const paragraphs = [...content.matchAll(/<p[^>]*>(.*?)<\/p>/gi)];
              for (const para of paragraphs) {
                const text = this.cleanInstructionText(para[1]);
                if (text.length > 15 && text.length < 800 && this.isValidInstruction(text)) {
                  instructions.push(text);
                }
              }
            }
          } else {
            // Direct instruction text
            const text = this.cleanInstructionText(content);
            if (text.length > 15 && text.length < 800 && this.isValidInstruction(text)) {
              instructions.push(text);
            }
          }
        }
        
        // If we found enough good instructions (at least 4), stop searching
        if (instructions.length >= 4) {
          console.log(`✅ Found ${instructions.length} validated instructions - stopping`);
          break;
        }
      }
      
      // Deduplicate and limit
      const uniqueInstructions = [...new Set(instructions)];
      console.log(`📊 Aggressive extraction: ${uniqueInstructions.length} unique instructions`);
      return uniqueInstructions.slice(0, 25);
      
    } catch (error) {
      console.log('HTML aggressive extraction failed:', error.message);
      return [];
    }
  }

  /**
   * Desperate last-resort instruction extraction
   * @param {string} htmlContent - HTML content
   * @returns {Array} Instructions
   */
  static extractDesperateInstructions(htmlContent) {
    console.log('🆘 Using desperate extraction methods...');
    
    const instructions = [];
    
    try {
      // Look for numbered patterns in text
      const numberedPatterns = [
        /(?:^|\n)\s*(\d+\.?\s+[^.\n]{20,200}[.!])/gm,
        /(?:^|\n)\s*(\d+\)\s+[^.\n]{20,200}[.!])/gm,
        /(?:^|\n)\s*(Step\s+\d+[:\.]?\s+[^.\n]{20,200}[.!])/gmi
      ];

      for (const pattern of numberedPatterns) {
        const matches = [...htmlContent.matchAll(pattern)];
        
        for (const match of matches) {
          const text = this.cleanInstructionText(match[1]);
          if (text.length > 20 && this.isValidInstruction(text)) {
            instructions.push(text);
          }
        }
        
        if (instructions.length > 0) break;
      }
      
      console.log(`🆘 Desperate extraction found ${instructions.length} potential instructions`);
      return instructions.slice(0, 15);
      
    } catch (error) {
      console.log('❌ Desperate extraction failed:', error.message);
      return [];
    }
  }

  /**
   * Parse cooking instructions from HTML content
   * @param {string} htmlContent - Raw HTML from recipe page
   * @returns {Array} Array of instruction steps
   */
  static parseInstructionsFromHTML(htmlContent) {
    console.log('🔍 Starting to parse instructions from HTML content...');
    
    try {
      // Try JSON-LD structured data first (most reliable)
      console.log('📋 Trying JSON-LD extraction...');
      const jsonLdInstructions = this.extractJsonLdInstructions(htmlContent);
      if (jsonLdInstructions.length > 0) {
        console.log(`✅ Found ${jsonLdInstructions.length} instructions via JSON-LD`);
        return jsonLdInstructions.slice(0, 15);
      }

      // Try common HTML patterns
      console.log('📋 Trying HTML pattern extraction...');
      const htmlInstructions = this.extractHtmlInstructions(htmlContent);
      if (htmlInstructions.length > 0) {
        console.log(`✅ Found ${htmlInstructions.length} instructions via HTML patterns`);
        return htmlInstructions.slice(0, 15);
      }

      console.log('❌ No instructions found in content');
      return [];
      
    } catch (error) {
      console.error('❌ Error parsing instructions:', error);
      return [];
    }
  }

  /**
   * Test method to debug web scraping with a specific URL
   * @param {string} testUrl - URL to test
   * @returns {Promise<Object>} Test results
   */
  static async testWebScraping(testUrl = 'https://www.allrecipes.com/recipe/213742/cheesy-chicken-broccoli-casserole/') {
    console.log('🧪 Testing web scraping with URL:', testUrl);
    
    try {
      const result = await this.getRecipeInstructions(testUrl);
      console.log('🧪 Test result:', result);
      return result;
    } catch (error) {
      console.error('🧪 Test failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Extract instructions from JSON-LD structured data (STRICT)
   * @param {string} htmlContent - HTML content
   * @returns {Array} Instructions array
   */
  static extractJsonLdInstructions(htmlContent) {
    const instructions = [];
    
    try {
      const jsonLdRegex = /<script[^>]*type[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
      const scripts = [...htmlContent.matchAll(jsonLdRegex)];
      
      console.log(`🔍 Found ${scripts.length} JSON-LD scripts to parse`);
      
      for (const script of scripts) {
        try {
          const jsonContent = script[1].trim();
          const data = JSON.parse(jsonContent);
          
          const recipes = Array.isArray(data) ? data : [data];
          
          for (const item of recipes) {
            // Handle different JSON-LD structures
            const recipe = item['@type'] === 'Recipe' ? item : 
                          item['@graph']?.find(g => g['@type'] === 'Recipe');
            
            if (recipe?.recipeInstructions) {
              console.log(`📋 Found recipeInstructions in JSON-LD`);
              const instructionData = Array.isArray(recipe.recipeInstructions) 
                ? recipe.recipeInstructions 
                : [recipe.recipeInstructions];
              
              for (const instruction of instructionData) {
                let text = '';
                
                // Handle different instruction formats
                if (typeof instruction === 'string') {
                  text = instruction;
                } else if (instruction.text) {
                  text = instruction.text;
                } else if (instruction.name) {
                  text = instruction.name;
                } else if (instruction['@type'] === 'HowToStep') {
                  text = instruction.text || instruction.name || '';
                } else if (instruction['@type'] === 'HowToSection') {
                  // Handle sections with multiple steps
                  const steps = instruction.itemListElement || [];
                  for (const step of steps) {
                    const stepText = step.text || step.name || '';
                    if (stepText && stepText.length > 10) {
                      const cleaned = this.cleanInstructionText(stepText);
                      if (this.isValidInstruction(cleaned)) {
                        instructions.push(cleaned);
                      }
                    }
                  }
                  continue; // Skip to next iteration
                }
                
                if (text && text.length > 10) {
                  const cleaned = this.cleanInstructionText(text);
                  
                  // Strict validation - must be actual instruction
                  if (this.isValidInstruction(cleaned)) {
                    instructions.push(cleaned);
                    console.log(`✅ Valid JSON-LD instruction: ${cleaned.substring(0, 60)}...`);
                  } else {
                    console.log(`🚫 Rejected JSON-LD text: ${cleaned.substring(0, 60)}...`);
                  }
                }
              }
              
              // If we found instructions in this recipe object, we're done
              if (instructions.length > 0) {
                console.log(`✅ Extracted ${instructions.length} instructions from JSON-LD`);
                return instructions.slice(0, 25); // Max 25 steps
              }
            }
          }
        } catch (e) {
          console.log('⚠️ JSON parsing failed for one script, continuing...');
          continue;
        }
      }
    } catch (error) {
      console.error('JSON-LD extraction error:', error);
    }
    
    console.log(`📊 Total JSON-LD instructions found: ${instructions.length}`);
    return instructions;
  }

  /**
   * Extract instructions from HTML patterns (STRICT - only instructions for THIS recipe)
   * @param {string} htmlContent - HTML content
   * @returns {Array} Instructions array
   */
  static extractHtmlInstructions(htmlContent) {
    const instructions = [];
    
    try {
      // STRICT patterns - target ONLY instruction sections, not ingredients or other recipes
      const patterns = [
        // Most specific first - ordered lists with instruction-specific classes
        /<ol[^>]*class[^>]*(?:recipe-instructions|instructions|recipe-directions|directions|method|recipe-method|recipe-steps|preparation-steps)[^>]*>([\s\S]*?)<\/ol>/gi,
        
        // Div containers specifically for instructions (not ingredients)
        /<div[^>]*class[^>]*(?:recipe-instructions|instructions-section|directions-section|method-section|recipe-method|preparation)[^>]*>([\s\S]*?)<\/div>/gi,
        
        // Section tags for instructions
        /<section[^>]*class[^>]*(?:recipe-instructions|instructions|directions|method|preparation)[^>]*>([\s\S]*?)<\/section>/gi,
        
        // Unordered lists (only if they have instruction-specific classes)
        /<ul[^>]*class[^>]*(?:recipe-instructions|instructions|directions|method|recipe-steps)[^>]*>([\s\S]*?)<\/ul>/gi
      ];

      for (const pattern of patterns) {
        const matches = [...htmlContent.matchAll(pattern)];
        console.log(`🔍 Strict pattern found ${matches.length} potential instruction sections`);
        
        for (const match of matches) {
          const content = match[1];
          
          // Check if this section contains "Ingredients" header - if so, SKIP IT
          if (/(?:ingredients?|what you(?:'ll)? need|shopping list)/i.test(content.substring(0, 200))) {
            console.log('🚫 Skipping section - contains ingredient markers');
            continue;
          }
          
          // Extract list items from this section
          const listItems = [...content.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)];
          
          if (listItems.length > 0) {
            console.log(`📋 Found ${listItems.length} list items in section`);
            let validCount = 0;
            
            for (const item of listItems) {
              const text = this.cleanInstructionText(item[1]);
              
              // Very strict validation - must be real instructions
              if (text.length > 15 && 
                  text.length < 500 && 
                  this.isValidInstruction(text)) {
                instructions.push(text);
                validCount++;
                console.log(`✅ Valid instruction ${validCount}: ${text.substring(0, 60)}...`);
              } else {
                console.log(`🚫 Rejected: ${text.substring(0, 60)}...`);
              }
            }
            
            // If we found at least 3 valid instructions in this section, we're done
            if (validCount >= 3) {
              console.log(`✅ Found ${validCount} valid instructions in section - stopping search`);
              break;
            } else if (validCount > 0) {
              // Found some but not enough, keep searching
              console.log(`⚠️ Only found ${validCount} instructions, continuing search...`);
            }
          } else {
            // No list items, try paragraphs
            const paragraphs = [...content.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)];
            console.log(`📝 No list items, trying ${paragraphs.length} paragraphs`);
            
            for (const para of paragraphs) {
              const text = this.cleanInstructionText(para[1]);
              if (text.length > 15 && 
                  text.length < 500 && 
                  this.isValidInstruction(text)) {
                instructions.push(text);
                console.log(`✅ Valid paragraph: ${text.substring(0, 60)}...`);
              }
            }
            
            if (instructions.length >= 3) {
              console.log(`✅ Found ${instructions.length} instructions from paragraphs`);
              break;
            }
          }
        }
        
        // If we found instructions with this pattern, don't try more generic ones
        if (instructions.length >= 3) {
          console.log(`✅ Stopping - found ${instructions.length} instructions`);
          break;
        }
      }
      
      // Return only unique instructions (deduplicate)
      const uniqueInstructions = [...new Set(instructions)];
      console.log(`📊 Returning ${uniqueInstructions.length} unique instructions`);
      
      return uniqueInstructions.slice(0, 25); // Max 25 steps
      
    } catch (error) {
      console.error('HTML extraction error:', error);
      return [];
    }
  }

  /**
   * Check if text looks like a valid cooking instruction (NOT an ingredient)
   * @param {string} text - Text to validate
   * @returns {boolean} Whether text is a valid instruction
   */
  static isValidInstruction(text) {
    const lowerText = text.toLowerCase().trim();
    
    // Reject very short or very long text
    // RELAXED: Allow shorter instructions (e.g., "Mix well", "Stir in salt")
    if (lowerText.length < 8 || lowerText.length > 1000) {
      return false;
    }
    
    // ❌ REJECT if it looks like an ingredient (just a list item with measurements)
    const ingredientPatterns = [
      /^\d+\s*(cup|cups|tablespoon|tbsp|teaspoon|tsp|pound|lb|ounce|oz|gram|g|kg|ml|l)\s+/i,
      /^\d+\/\d+\s*(cup|cups|tablespoon|tbsp|teaspoon|tsp|pound|lb|ounce|oz)\s+/i,
      /^\d+\s+to\s+\d+\s+/i, // "2 to 3 cups"
      /^(one|two|three|four|five|six|seven|eight|nine|ten)\s+(cup|tablespoon|teaspoon|pound|ounce)/i,
      // Reject if it's ONLY ingredient-like (no verbs)
      /^[\d\s\/\-]*(cup|tablespoon|teaspoon|pound|ounce|gram|ml|pinch|dash|can|package|pkg|lb|oz|tsp|tbsp)s?\s+[\w\s,\(\)]+$/i
    ];
    
    const looksLikeIngredient = ingredientPatterns.some(pattern => pattern.test(lowerText));
    if (looksLikeIngredient) {
      console.log('🚫 Rejected as ingredient:', text.substring(0, 50));
      return false;
    }
    
    // ✅ REQUIRE action verbs for instructions (must have at least one)
    const actionVerbs = [
      'heat', 'cook', 'bake', 'fry', 'saute', 'sauté', 'boil', 'simmer', 'mix', 'stir', 'combine',
      'add', 'pour', 'season', 'chop', 'dice', 'slice', 'mince', 'preheat', 'serve', 'whip',
      'remove', 'place', 'put', 'set', 'whisk', 'beat', 'fold', 'sprinkle', 'garnish', 'grill',
      'blend', 'process', 'marinate', 'chill', 'freeze', 'thaw', 'drain', 'rinse', 'wash',
      'roast', 'broil', 'steam', 'poach', 'braise', 'sear', 'brown', 'caramelize', 'reduce',
      'strain', 'cut', 'trim', 'peel', 'core', 'seed', 'zest', 'juice', 'squeeze', 'crush',
      'knead', 'roll', 'shape', 'form', 'wrap', 'cover', 'uncover', 'flip', 'turn', 'toss',
      'baste', 'brush', 'coat', 'dust', 'drizzle', 'spoon', 'ladle', 'scoop', 'transfer',
      'bring', 'let', 'allow', 'continue', 'repeat', 'adjust', 'taste', 'check'
    ];
    
    // Must have at least one action verb
    const hasActionVerb = actionVerbs.some(verb => {
      const verbPattern = new RegExp(`\\b${verb}\\b`, 'i');
      return verbPattern.test(lowerText);
    });
    
    if (!hasActionVerb) {
      console.log('🚫 Rejected (no action verb):', text.substring(0, 50));
      return false;
    }
    
    // ❌ Reject obvious non-instructions
    const rejectPatterns = [
      /^(recipe|print|save|share|comment|rate|review|photo|image|video)/i,
      /^(copyright|©|all rights|terms|privacy|policy)/i,
      /^(advertisement|ads|sponsor|affiliate)/i,
      /^(sign up|subscribe|newsletter|email)/i,
      /^(facebook|twitter|instagram|pinterest|social)/i,
      /^(related|similar|more recipes|you might like|recommended|trending)/i,
      /^(nutritional|nutrition facts|calories per|servings|prep time|cook time|total time)/i,
      /^(ingredients|ingredient list|you will need|what you need)/i, // Ingredient section headers
      /^\s*\d+\s*$/, // Just numbers
      /^[^a-zA-Z]*$/, // No letters at all
      /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i, // Dates
      /^(watch|read|see|view|click|learn|discover|find out)/i, // Call to action
      /^(equipment|tools|you need|required)/i, // Equipment lists
      /^(notes?|tips?|tricks?|variations?|substitutions?)/i // Meta content
    ];
    
    const shouldReject = rejectPatterns.some(pattern => pattern.test(lowerText));
    if (shouldReject) {
      console.log('🚫 Rejected (non-instruction pattern):', text.substring(0, 50));
      return false;
    }
    
    // ✅ Must have reasonable word count (instructions are usually sentences)
    // RELAXED: Allow shorter instructions (2+ words)
    const wordCount = text.split(/\s+/).length;
    if (wordCount < 2 || wordCount > 200) {
      console.log('🚫 Rejected (word count):', text.substring(0, 50));
      return false;
    }
    
    // ✅ PASSED all checks
    return true;
  }

  /**
   * Clean and format instruction text
   * @param {string} text - Raw instruction text
   * @returns {string} Cleaned instruction text
   */
  static cleanInstructionText(text) {
    return text
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
      .replace(/&amp;/g, '&') // Replace &amp; with &
      .replace(/&lt;/g, '<') // Replace &lt; with <
      .replace(/&gt;/g, '>') // Replace &gt; with >
      .replace(/&quot;/g, '"') // Replace &quot; with "
      .replace(/&#39;/g, "'") // Replace &#39; with '
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim(); // Remove leading/trailing whitespace
  }

  /**
   * Get cached instructions for a recipe URL
   * @param {string} recipeUrl - Recipe URL
   * @returns {Promise<Array|null>} Cached instructions or null
   */
  static async getCachedInstructions(recipeUrl) {
    try {
      const cacheKey = this.generateCacheKey(recipeUrl);
      const cachedData = await AsyncStorage.getItem(`${INSTRUCTION_CACHE_KEY}_${cacheKey}`);
      
      if (cachedData) {
        const { instructions, timestamp } = JSON.parse(cachedData);
        const now = Date.now();
        const expiry = CACHE_EXPIRY_HOURS * 60 * 60 * 1000;
        
        if (now - timestamp < expiry) {
          return instructions;
        } else {
          // Remove expired cache
          await AsyncStorage.removeItem(`${INSTRUCTION_CACHE_KEY}_${cacheKey}`);
        }
      }
      
      return null;
    } catch (error) {
      console.error('Cache read error:', error);
      return null;
    }
  }

  /**
   * Cache instructions for a recipe URL
   * @param {string} recipeUrl - Recipe URL
   * @param {Array} instructions - Instructions to cache
   */
  static async cacheInstructions(recipeUrl, instructions) {
    try {
      const cacheKey = this.generateCacheKey(recipeUrl);
      const cacheData = {
        instructions,
        timestamp: Date.now()
      };
      
      await AsyncStorage.setItem(
        `${INSTRUCTION_CACHE_KEY}_${cacheKey}`, 
        JSON.stringify(cacheData)
      );
    } catch (error) {
      console.error('Cache write error:', error);
    }
  }

  /**
   * Generate cache key from URL
   * @param {string} url - Recipe URL
   * @returns {string} Cache key
   */
  static generateCacheKey(url) {
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Generate smart contextual fallback instructions
   * @param {string} recipeUrl - Recipe URL for context
   * @returns {Array} Contextual fallback instructions
   */
  static generateSmartFallback(recipeUrl) {
    const domain = recipeUrl.toLowerCase();
    
    let instructions = [
      "Prepare all ingredients according to the recipe requirements.",
      "Follow the cooking method described in the original recipe.",
    ];

    if (domain.includes('baking') || domain.includes('dessert') || domain.includes('cake')) {
      instructions.push("Preheat oven as specified in the recipe.");
      instructions.push("Mix ingredients in the order described for best results.");
    } else if (domain.includes('soup') || domain.includes('stew')) {
      instructions.push("Heat ingredients in a large pot over medium heat.");
      instructions.push("Simmer until all ingredients are tender.");
    } else {
      instructions.push("Cook according to the time and temperature specified.");
      instructions.push("Season and adjust flavors to taste.");
    }

    instructions.push("Visit the original recipe for complete detailed instructions.");
    
    return instructions;
  }

  /**
   * Generate fallback instructions when all else fails
   * @returns {Object} Fallback instruction object
   */
  static generateFallbackInstructions() {
    const fallbackInstructions = [
      "Gather and prepare all ingredients according to the recipe requirements.",
      "Preheat your oven or prepare your cooking equipment as needed.",
      "Follow the preparation steps for each ingredient (washing, chopping, measuring).",
      "Combine ingredients in the order specified in the original recipe.",
      "Cook according to the time and temperature guidelines provided.",
      "Check for doneness using the recommended testing method.",
      "Allow to rest or cool as directed before serving.",
      "For complete detailed instructions, please visit the original recipe link."
    ];

    return {
      success: true,
      instructions: fallbackInstructions
    };
  }

  /**
   * Format recipe data for consistent use in the app
   * @param {Object} recipe - Raw recipe data from Edamam
   * @returns {Object} Formatted recipe object
   */
  static formatRecipe(recipe) {
    return {
      id: recipe.uri,
      uri: recipe.uri, // Include uri for favorites functionality
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

  /**
   * Get recipes similar to the provided recipe with smart ingredient and protein analysis
   * @param {Object} currentRecipe - The reference recipe object
   * @param {number} count - Number of similar recipes to fetch (default: 15)
   * @param {Object} options - Additional options for similarity matching
   * @returns {Promise<Object>} Similar recipes result
   */
  static async getSimilarRecipes(currentRecipe, count = 15, options = {}) {
    try {
      // Handle both Edamam (label) and AI (recipeName) recipe structures
      const recipeTitle = currentRecipe.label || currentRecipe.recipeName || 'Unknown Recipe';
      console.log('🔍 Fetching SMART similar recipes for:', recipeTitle);
      
      // ⚠️ CACHING DISABLED - Now handled by supabase-cache-service.js
      // Check cache first for similar recipes
      // const cacheKey = this.generateSimilarRecipesCacheKey(currentRecipe, count);
      // let cachedSimilarRecipes = null;
      
      // try {
      //   const RecipeCacheService = (await import('./recipe-cache-service.js')).default;
      //   cachedSimilarRecipes = await RecipeCacheService.getCachedSimilarRecipes(cacheKey);
        
      //   if (cachedSimilarRecipes && cachedSimilarRecipes.length > 0) {
      //     console.log(`✅ Using cached similar recipes (${cachedSimilarRecipes.length} recipes)`);
      //     return {
      //       success: true,
      //       data: {
      //         recipes: cachedSimilarRecipes,
      //         total: cachedSimilarRecipes.length,
      //         cached: true
      //       }
      //     };
      //   }
      // } catch (cacheError) {
      //   console.log('⚠️ Cache check failed, proceeding with fresh search:', cacheError.message);
      // }

      // Analyze the current recipe for intelligent matching
      const recipeAnalysis = this.analyzeRecipeForSimilarity(currentRecipe);
      console.log('🧬 Recipe analysis:', recipeAnalysis);
      
      // Create intelligent search strategies based on analysis
      const searchStrategies = this.buildIntelligentSearchStrategies(currentRecipe, recipeAnalysis, count);
      console.log(`🎯 Using ${searchStrategies.length} intelligent search strategies`);
      
      const allRecipes = [];
      const seenUris = new Set([currentRecipe.id, currentRecipe.uri]);
      
      // Execute search strategies with intelligent scoring
      for (let i = 0; i < searchStrategies.length && allRecipes.length < count * 3; i++) {
        const strategy = searchStrategies[i];
        
        try {
          console.log(`🔍 Strategy ${i + 1} (${strategy.type}): "${strategy.query}"`);
          
          const result = await this.searchRecipes(strategy.query, {
            ...strategy.options,
            skipCache: options.skipCache || false
          });
          
          if (result.success && result.data.recipes) {
            console.log(`✅ Strategy ${i + 1} found ${result.data.recipes.length} recipes`);
            
            result.data.recipes.forEach(foundRecipe => {
              if (!seenUris.has(foundRecipe.id) && 
                  !seenUris.has(foundRecipe.uri) && 
                  allRecipes.length < count * 3) {
                
                // Calculate similarity score
                const similarityScore = this.calculateSimilarityScore(currentRecipe, foundRecipe, recipeAnalysis);
                foundRecipe._similarityScore = similarityScore;
                foundRecipe._strategy = strategy.type;
                
                allRecipes.push(foundRecipe);
                seenUris.add(foundRecipe.id);
                seenUris.add(foundRecipe.uri);
              }
            });
          }
        } catch (searchError) {
          console.log(`⚠️ Strategy ${i + 1} error:`, searchError.message);
        }
      }
      
      // Sort by similarity score and select best matches
      const rankedRecipes = allRecipes
        .sort((a, b) => (b._similarityScore || 0) - (a._similarityScore || 0))
        .slice(0, count);
      
      // Clean up scoring data before returning
      rankedRecipes.forEach(recipe => {
        delete recipe._similarityScore;
        delete recipe._strategy;
      });
      
      console.log(`🎉 Smart similar recipes: ${rankedRecipes.length} selected from ${allRecipes.length} candidates`);
      
      // ⚠️ CACHING DISABLED - Now handled by supabase-cache-service.js
      // Cache the results for future use
      // try {
      //   const RecipeCacheService = (await import('./recipe-cache-service.js')).default;
      //   await RecipeCacheService.cacheSimilarRecipes(cacheKey, rankedRecipes);
      // } catch (cacheError) {
      //   console.warn('⚠️ Failed to cache similar recipes:', cacheError.message);
      // }
      
      return {
        success: true,
        data: {
          recipes: rankedRecipes,
          total: rankedRecipes.length,
          analysis: recipeAnalysis,
          strategiesUsed: searchStrategies.length
        }
      };

    } catch (error) {
      console.error('❌ Error fetching smart similar recipes:', error);
      
      // Fallback to basic similarity search
      return this.getFallbackSimilarRecipes(currentRecipe, count);
    }
  }

  /**
   * Analyze recipe for intelligent similarity matching
   * @param {Object} recipe - Recipe to analyze
   * @returns {Object} Analysis results
   */
  static analyzeRecipeForSimilarity(recipe) {
    const analysis = {
      mainProteins: [],
      cookingMethods: [],
      keyIngredients: [],
      cuisineStyle: recipe.cuisineType?.[0] || 'unknown',
      mealType: recipe.mealType?.[0] || 'unknown',
      dishType: recipe.dishType?.[0] || 'unknown',
      dietaryRestrictions: recipe.healthLabels || [],
      difficulty: 'medium' // Could be enhanced based on recipe complexity
    };

    // Handle both Edamam (label) and AI (recipeName) recipe structures
    const recipeTitle = recipe.label || recipe.recipeName || '';
    const title = recipeTitle.toLowerCase();
    const ingredients = (recipe.ingredientLines || []).join(' ').toLowerCase();
    const allText = `${title} ${ingredients}`;

    // Identify main proteins
    const proteinKeywords = {
      chicken: ['chicken', 'poultry'],
      beef: ['beef', 'steak', 'ground beef', 'chuck', 'sirloin'],
      pork: ['pork', 'bacon', 'ham', 'sausage'],
      fish: ['fish', 'salmon', 'tuna', 'cod', 'tilapia', 'trout'],
      seafood: ['shrimp', 'crab', 'lobster', 'scallops', 'mussels', 'clams'],
      turkey: ['turkey'],
      lamb: ['lamb'],
      tofu: ['tofu', 'tempeh'],
      beans: ['beans', 'lentils', 'chickpeas', 'legumes'],
      eggs: ['egg', 'eggs']
    };

    for (const [protein, keywords] of Object.entries(proteinKeywords)) {
      if (keywords.some(keyword => allText.includes(keyword))) {
        analysis.mainProteins.push(protein);
      }
    }

    // Identify cooking methods
    const cookingMethods = {
      baked: ['baked', 'baking', 'oven'],
      grilled: ['grilled', 'grilling', 'grill'],
      fried: ['fried', 'frying', 'pan-fried'],
      roasted: ['roasted', 'roasting'],
      steamed: ['steamed', 'steaming'],
      sauteed: ['sauteed', 'sauté', 'sautéed'],
      braised: ['braised', 'braising'],
      stewed: ['stewed', 'stew'],
      slow_cooked: ['slow cook', 'crockpot', 'slow cooker']
    };

    for (const [method, keywords] of Object.entries(cookingMethods)) {
      if (keywords.some(keyword => allText.includes(keyword))) {
        analysis.cookingMethods.push(method);
      }
    }

    // Extract key ingredients from ingredient lines
    const commonIngredients = [
      'onion', 'garlic', 'tomato', 'cheese', 'rice', 'pasta', 'potato',
      'mushroom', 'bell pepper', 'carrot', 'celery', 'herbs', 'spices',
      'olive oil', 'butter', 'cream', 'milk', 'wine', 'broth', 'stock'
    ];

    analysis.keyIngredients = commonIngredients.filter(ingredient => 
      allText.includes(ingredient)
    );

    return analysis;
  }

  /**
   * Build intelligent search strategies based on recipe analysis
   * @param {Object} recipe - Current recipe
   * @param {Object} analysis - Recipe analysis
   * @param {number} count - Target recipe count
   * @returns {Array} Search strategies
   */
  static buildIntelligentSearchStrategies(recipe, analysis, count) {
    const strategies = [];
    const maxResultsPerStrategy = Math.min(count * 2, 20);

    // Strategy 1: Protein-based similarity (highest priority)
    if (analysis.mainProteins.length > 0) {
      analysis.mainProteins.forEach(protein => {
        strategies.push({
          type: 'protein',
          query: protein,
          options: {
            cuisineType: analysis.cuisineStyle !== 'unknown' ? analysis.cuisineStyle : undefined,
            mealType: analysis.mealType !== 'unknown' ? analysis.mealType : undefined,
            from: 0,
            to: maxResultsPerStrategy
          },
          priority: 10
        });
      });
    }

    // Strategy 2: Key ingredient combinations
    if (analysis.keyIngredients.length >= 2) {
      const ingredientPairs = analysis.keyIngredients.slice(0, 3);
      strategies.push({
        type: 'ingredients',
        query: ingredientPairs.join(' '),
        options: {
          dishType: analysis.dishType !== 'unknown' ? analysis.dishType : undefined,
          from: 0,
          to: maxResultsPerStrategy
        },
        priority: 9
      });
    }

    // Strategy 3: Cooking method + protein combination
    if (analysis.cookingMethods.length > 0 && analysis.mainProteins.length > 0) {
      strategies.push({
        type: 'method-protein',
        query: `${analysis.cookingMethods[0]} ${analysis.mainProteins[0]}`,
        options: {
          from: 0,
          to: maxResultsPerStrategy
        },
        priority: 8
      });
    }

    // Strategy 4: Dish type similarity
    if (analysis.dishType !== 'unknown') {
      strategies.push({
        type: 'dish-type',
        query: analysis.dishType,
        options: {
          dishType: analysis.dishType,
          cuisineType: analysis.cuisineStyle !== 'unknown' ? analysis.cuisineStyle : undefined,
          from: 0,
          to: maxResultsPerStrategy
        },
        priority: 7
      });
    }

    // Strategy 5: Cuisine-specific searches
    if (analysis.cuisineStyle !== 'unknown') {
      strategies.push({
        type: 'cuisine',
        query: 'popular',
        options: {
          cuisineType: analysis.cuisineStyle,
          mealType: analysis.mealType !== 'unknown' ? analysis.mealType : undefined,
          from: 0,
          to: maxResultsPerStrategy
        },
        priority: 6
      });
    }

    // Strategy 6: Dietary restriction compatibility
    if (analysis.dietaryRestrictions.length > 0) {
      const mainDietLabel = analysis.dietaryRestrictions.find(label => 
        ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'keto-friendly'].includes(label.toLowerCase())
      );
      
      if (mainDietLabel && analysis.mainProteins.length > 0) {
        strategies.push({
          type: 'dietary',
          query: analysis.mainProteins[0],
          options: {
            health: mainDietLabel.toLowerCase(),
            from: 0,
            to: maxResultsPerStrategy
          },
          priority: 5
        });
      }
    }

    // Sort by priority and return
    return strategies.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  /**
   * Calculate similarity score between two recipes
   * @param {Object} currentRecipe - Reference recipe
   * @param {Object} candidateRecipe - Recipe to score
   * @param {Object} analysis - Current recipe analysis
   * @returns {number} Similarity score (0-100)
   */
  static calculateSimilarityScore(currentRecipe, candidateRecipe, analysis) {
    let score = 0;
    const candidateAnalysis = this.analyzeRecipeForSimilarity(candidateRecipe);

    // Protein similarity (30% weight)
    const proteinMatch = analysis.mainProteins.some(protein => 
      candidateAnalysis.mainProteins.includes(protein)
    );
    if (proteinMatch) score += 30;

    // Cooking method similarity (20% weight)
    const methodMatch = analysis.cookingMethods.some(method => 
      candidateAnalysis.cookingMethods.includes(method)
    );
    if (methodMatch) score += 20;

    // Cuisine type similarity (15% weight)
    if (analysis.cuisineStyle === candidateAnalysis.cuisineStyle && 
        analysis.cuisineStyle !== 'unknown') {
      score += 15;
    }

    // Dish type similarity (15% weight)
    if (analysis.dishType === candidateAnalysis.dishType && 
        analysis.dishType !== 'unknown') {
      score += 15;
    }

    // Ingredient overlap (15% weight)
    const ingredientOverlap = analysis.keyIngredients.filter(ingredient => 
      candidateAnalysis.keyIngredients.includes(ingredient)
    ).length;
    
    if (ingredientOverlap > 0) {
      score += Math.min(15, (ingredientOverlap / Math.max(analysis.keyIngredients.length, 1)) * 15);
    }

    // Meal type similarity (5% weight)
    if (analysis.mealType === candidateAnalysis.mealType && 
        analysis.mealType !== 'unknown') {
      score += 5;
    }

    return Math.round(score);
  }

  /**
   * Generate cache key for similar recipes
   * @param {Object} recipe - Recipe object
   * @param {number} count - Number of recipes requested
   * @returns {string} Cache key
   */
  static generateSimilarRecipesCacheKey(recipe, count) {
    const key = `similar_${recipe.id || recipe.uri}_${count}`;
    return key.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  /**
   * Fallback similar recipe search when main method fails
   * @param {Object} currentRecipe - Reference recipe
   * @param {number} count - Number of recipes to return
   * @returns {Promise<Object>} Similar recipes result
   */
  static async getFallbackSimilarRecipes(currentRecipe, count) {
    try {
      console.log('🔄 Using fallback similar recipe search...');
      
      // Handle both Edamam (label) and AI (recipeName) recipe structures
      const recipeTitle = currentRecipe.label || currentRecipe.recipeName || 'popular';
      
      // Simple title-based search
      const titleWords = recipeTitle.toLowerCase()
        .split(' ')
        .filter(word => word.length > 3)
        .slice(0, 2);
      
      const query = titleWords.length > 0 ? titleWords[0] : 'popular';
      
      const result = await this.searchRecipes(query, { 
        from: 0, 
        to: count + 5,
        skipCache: true
      });
      
      if (result.success && result.data.recipes) {
        const fallbackRecipes = result.data.recipes
          .filter(r => r.id !== currentRecipe.id && r.uri !== currentRecipe.uri)
          .slice(0, count);
          
        return {
          success: true,
          data: {
            recipes: fallbackRecipes,
            total: fallbackRecipes.length,
            fallback: true
          }
        };
      }
    } catch (fallbackError) {
      console.error('❌ Fallback search also failed:', fallbackError);
    }
    
    return {
      success: false,
      error: 'Failed to fetch similar recipes',
      data: {
        recipes: [],
        total: 0
      }
    };
  }

  /**
   * Extract detailed nutrition information from a recipe
   * @param {Object} recipe - Recipe object with nutrition data
   * @returns {Object} Formatted nutrition information
   */
  static extractNutritionInfo(recipe) {
    if (!recipe) {
      return {
        calories: 0,
        nutrients: {
          carbs: { amount: 0, unit: 'g', daily: 0 },
          protein: { amount: 0, unit: 'g', daily: 0 },
          fat: { amount: 0, unit: 'g', daily: 0 },
          fiber: { amount: 0, unit: 'g', daily: 0 },
          sodium: { amount: 0, unit: 'mg', daily: 0 }
        }
      };
    }

    const nutrition = recipe.totalNutrients || {};
    const dailyValues = recipe.totalDaily || {};
    const servings = recipe.yield || 1;

    // Calculate per-serving values
    const caloriesPerServing = Math.round((recipe.calories || 0) / servings);

    return {
      calories: caloriesPerServing,
      servings: servings,
      nutrients: {
        carbs: {
          amount: Math.round((nutrition.CHOCDF?.quantity || 0) / servings),
          unit: 'g',
          daily: Math.round(dailyValues.CHOCDF?.quantity || 0)
        },
        protein: {
          amount: Math.round((nutrition.PROCNT?.quantity || 0) / servings),
          unit: 'g', 
          daily: Math.round(dailyValues.PROCNT?.quantity || 0)
        },
        fat: {
          amount: Math.round((nutrition.FAT?.quantity || 0) / servings),
          unit: 'g',
          daily: Math.round(dailyValues.FAT?.quantity || 0)
        },
        fiber: {
          amount: Math.round((nutrition.FIBTG?.quantity || 0) / servings),
          unit: 'g',
          daily: Math.round(dailyValues.FIBTG?.quantity || 0)
        },
        sodium: {
          amount: Math.round((nutrition.NA?.quantity || 0) / servings),
          unit: 'mg',
          daily: Math.round(dailyValues.NA?.quantity || 0)
        },
        sugar: {
          amount: Math.round((nutrition.SUGAR?.quantity || 0) / servings),
          unit: 'g',
          daily: Math.round(dailyValues.SUGAR?.quantity || 0)
        },
        saturatedFat: {
          amount: Math.round((nutrition.FASAT?.quantity || 0) / servings),
          unit: 'g',
          daily: Math.round(dailyValues.FASAT?.quantity || 0)
        },
        cholesterol: {
          amount: Math.round((nutrition.CHOLE?.quantity || 0) / servings),
          unit: 'mg',
          daily: Math.round(dailyValues.CHOLE?.quantity || 0)
        }
      },
      // Additional nutrition info
      totalNutrients: nutrition,
      totalDaily: dailyValues,
      co2Emissions: recipe.totalCO2Emissions || 0,
      co2EmissionsClass: recipe.co2EmissionsClass || 'A+'
    };
  }

  /**
   * Comprehensive test method for the new aggressive web scraping
   * @param {string} testUrl - Optional URL to test (defaults to popular recipe URLs)
   * @returns {Promise<Object>} Test results
   */
  static async testAggressiveScraping(testUrl = null) {
    console.log('🧪 Starting comprehensive aggressive scraping test...');
    
    const testUrls = testUrl ? [testUrl] : [
      'https://www.allrecipes.com/recipe/213742/cheesy-chicken-broccoli-casserole/',
      'https://www.foodnetwork.com/recipes/alton-brown/baked-mac-and-cheese-recipe-1939524',
      'https://www.epicurious.com/recipes/food/views/simple-perfect-enchiladas-51166160',
      'https://www.seriouseats.com/classic-sage-and-sausage-stuffing-or-dressing-recipe',
      'https://www.food.com/recipe/moms-zesty-chicken-27712'
    ];

    const results = [];
    
    for (const url of testUrls) {
      console.log(`\n🎯 Testing: ${url}`);
      
      try {
        const startTime = Date.now();
        const result = await this.getRecipeInstructions(url);
        const endTime = Date.now();
        
        const testResult = {
          url: url,
          success: result.success,
          instructionCount: result.instructions?.length || 0,
          source: result.scraped ? 'scraped' : result.cached ? 'cached' : 'fallback',
          processingTime: endTime - startTime,
          firstInstruction: result.instructions?.[0] || 'None',
          error: result.error || null
        };
        
        console.log(`✅ Result:`, testResult);
        results.push(testResult);
        
        // Small delay between requests to be respectful
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.log(`❌ Test failed for ${url}:`, error.message);
        results.push({
          url: url,
          success: false,
          error: error.message,
          processingTime: 0,
          instructionCount: 0
        });
      }
    }
    
    // Summary
    const successCount = results.filter(r => r.success && r.instructionCount > 0).length;
    const scrapedCount = results.filter(r => r.source === 'scraped').length;
    
    console.log(`\n📊 TEST SUMMARY:`);
    console.log(`   Total URLs tested: ${results.length}`);
    console.log(`   Successful extractions: ${successCount}/${results.length}`);
    console.log(`   Real scraping success: ${scrapedCount}/${results.length}`);
    console.log(`   Average processing time: ${results.reduce((a, b) => a + b.processingTime, 0) / results.length}ms`);
    
    return {
      summary: {
        totalTested: results.length,
        successfulExtractions: successCount,
        realScrapingSuccess: scrapedCount,
        averageTime: results.reduce((a, b) => a + b.processingTime, 0) / results.length
      },
      results: results
    };
  }

  /**
   * Quick connectivity test
   * @returns {Promise<boolean>} Whether basic connectivity works
   */
  static async quickConnectivityTest() {
    console.log('🔌 Testing basic connectivity...');
    
    try {
      const result = await this.fetchViaProxy('https://httpbin.org/html', 'allorigins');
      console.log('✅ Connectivity test passed');
      return true;
    } catch (error) {
      console.log('❌ Connectivity test failed:', error.message);
      return false;
    }
  }
}

export default EdamamService;
