// Edamam Recipe Search API Service
import AsyncStorage from '@react-native-async-storage/async-storage';

const EDAMAM_APP_ID = process.env.EXPO_PUBLIC_EDAMAM_APP_ID;
const EDAMAM_APP_KEY = process.env.EXPO_PUBLIC_EDAMAM_APP_KEY;
const EDAMAM_BASE_URL = 'https://api.edamam.com/api/recipes/v2';

// Instruction cache configuration
const INSTRUCTION_CACHE_KEY = 'recipe_instructions_cache';
const CACHE_EXPIRY_HOURS = 24; // Instructions cache for 24 hours

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
   * Extract recipe instructions from the recipe URL using aggressive web scraping
   * @param {string} recipeUrl - The URL of the original recipe
   * @returns {Promise<Object>} Instructions result object
   */
  static async getRecipeInstructions(recipeUrl) {
    try {
      console.log('🔍 Starting aggressive instruction extraction for:', recipeUrl);
      
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

      // AGGRESSIVE WEB SCRAPING - Try multiple strategies
      console.log('🚀 Starting aggressive web scraping...');
      
      // Strategy 1: Site-specific optimized scraping
      const siteSpecificResult = await this.tryMultipleScrapeStrategies(recipeUrl);
      if (siteSpecificResult.success) {
        console.log('� Site-specific scraping successful!');
        await this.cacheInstructions(recipeUrl, siteSpecificResult.instructions);
        return siteSpecificResult;
      }
      
      // Strategy 2: Multiple proxy approaches with retries
      const proxyResult = await this.aggressiveProxyScraping(recipeUrl);
      if (proxyResult.success) {
        console.log('🌐 Proxy scraping successful!');
        await this.cacheInstructions(recipeUrl, proxyResult.instructions);
        return proxyResult;
      }
      
      // Strategy 3: Alternative parsing approaches
      const alternativeResult = await this.alternativeParsingApproach(recipeUrl);
      if (alternativeResult.success) {
        console.log('� Alternative parsing successful!');
        await this.cacheInstructions(recipeUrl, alternativeResult.instructions);
        return alternativeResult;
      }
      
      // Only use fallback if ALL aggressive attempts fail
      console.log('⚠️ All aggressive scraping attempts failed, using smart fallback');
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
   * Try multiple scraping strategies with site-specific optimizations
   * @param {string} recipeUrl - Recipe URL
   * @returns {Promise<Object>} Scraping result
   */
  static async tryMultipleScrapeStrategies(recipeUrl) {
    const strategies = [
      () => this.scrapeSiteSpecific(recipeUrl),
      () => this.scrapeWithMultipleProxies(recipeUrl),
      () => this.scrapeWithAlternativeHeaders(recipeUrl),
      () => this.scrapeWithMobileUserAgent(recipeUrl)
    ];

    for (let i = 0; i < strategies.length; i++) {
      try {
        console.log(`🎯 Trying scraping strategy ${i + 1}...`);
        const result = await strategies[i]();
        if (result.success && result.instructions.length > 0) {
          console.log(`✅ Strategy ${i + 1} successful!`);
          return result;
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
    } else {
      return this.parseGenericRecipe(htmlContent);
    }
  }

  /**
   * Fetch content using the most reliable method available
   * @param {string} url - URL to fetch
   * @returns {Promise<string|null>} HTML content
   */
  static async fetchWithBestMethod(url) {
    const methods = [
      // Method 1: Multiple reliable proxies in parallel
      () => this.parallelProxyFetch(url),
      // Method 2: Direct fetch with optimal headers
      () => this.optimizedDirectFetch(url),
      // Method 3: Backup proxies
      () => this.backupProxyFetch(url)
    ];

    for (const method of methods) {
      try {
        const content = await method();
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
            if (cleaned.length > 10 && this.isValidInstruction(cleaned)) {
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
          if (cleaned.length > 15 && this.isValidInstruction(cleaned)) {
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
          if (cleaned.length > 15 && this.isValidInstruction(cleaned)) {
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
      const patterns = [
        /<li[^>]*class[^>]*structured-method__list-item[^>]*>(.*?)<\/li>/gi,
        /<div[^>]*class[^>]*recipe-procedure-text[^>]*>(.*?)<\/div>/gi,
        /<p[^>]*class[^>]*recipe-instruction[^>]*>(.*?)<\/p>/gi
      ];

      for (const pattern of patterns) {
        const matches = [...htmlContent.matchAll(pattern)];
        
        for (const match of matches) {
          const cleaned = this.cleanInstructionText(match[1]);
          if (cleaned.length > 15 && this.isValidInstruction(cleaned)) {
            instructions.push(cleaned);
          }
        }
        
        if (instructions.length > 0) break;
      }
      
      return {
        success: instructions.length > 0,
        instructions: instructions.slice(0, 20),
        source: 'seriouseats'
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
          if (cleaned.length > 15 && this.isValidInstruction(cleaned)) {
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
   * Parse any recipe site with aggressive generic approach
   * @param {string} htmlContent - HTML content
   * @returns {Object} Parsing result
   */
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
   * Aggressive JSON-LD extraction that tries harder
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
              console.log(`📋 Found ${recipe.recipeInstructions.length} instructions in JSON-LD`);
              
              for (const instruction of recipe.recipeInstructions) {
                let text = '';
                
                if (typeof instruction === 'string') {
                  text = instruction;
                } else if (instruction.text) {
                  text = instruction.text;
                } else if (instruction.name) {
                  text = instruction.name;
                } else if (instruction['@type'] === 'HowToStep' && instruction.text) {
                  text = instruction.text;
                }
                
                if (text && text.length > 5) {
                  const cleaned = this.cleanInstructionText(text);
                  if (cleaned.length > 10 && this.isValidInstruction(cleaned)) {
                    instructions.push(cleaned);
                  }
                }
              }
              
              if (instructions.length > 0) {
                return instructions.slice(0, 20);
              }
            }
          }
        } catch (e) {
          console.log('JSON parsing failed for script, continuing...');
          continue;
        }
      }
    } catch (error) {
      console.log('JSON-LD aggressive extraction failed:', error.message);
    }
    
    return instructions;
  }

  /**
   * Aggressive HTML pattern extraction
   * @param {string} htmlContent - HTML content
   * @returns {Array} Instructions
   */
  static extractHtmlInstructionsAggressive(htmlContent) {
    const instructions = [];
    
    try {
      // Much more comprehensive pattern list
      const patterns = [
        // Common instruction containers
        /<ol[^>]*class[^>]*(?:instructions|directions|method|steps|recipe-instructions)[^>]*>(.*?)<\/ol>/gi,
        /<ul[^>]*class[^>]*(?:instructions|directions|method|steps|recipe-instructions)[^>]*>(.*?)<\/ul>/gi,
        /<div[^>]*class[^>]*(?:instructions|directions|method|steps|recipe-instructions|instruction-list)[^>]*>(.*?)<\/div>/gi,
        
        // Numbered steps
        /<div[^>]*class[^>]*step[^>]*>(.*?)<\/div>/gi,
        /<p[^>]*class[^>]*step[^>]*>(.*?)<\/p>/gi,
        
        // Generic lists that might contain instructions
        /<ol[^>]*>(.*?)<\/ol>/gi,
        
        // Individual instruction items
        /<li[^>]*(?:class[^>]*(?:instruction|step|direction))?[^>]*>(.*?)<\/li>/gi,
        /<p[^>]*(?:class[^>]*(?:instruction|step|direction))?[^>]*>(.*?)<\/p>/gi
      ];

      for (const pattern of patterns) {
        const matches = [...htmlContent.matchAll(pattern)];
        console.log(`🔍 Pattern found ${matches.length} matches`);
        
        for (const match of matches) {
          const content = match[1];
          
          // Extract list items if this is a list container
          if (pattern.source.includes('<ol') || pattern.source.includes('<ul') || pattern.source.includes('<div')) {
            const listItems = [...content.matchAll(/<li[^>]*>(.*?)<\/li>/gi)];
            
            if (listItems.length > 0) {
              for (const item of listItems) {
                const text = this.cleanInstructionText(item[1]);
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
        
        if (instructions.length >= 3) {
          console.log(`✅ Found ${instructions.length} instructions with current pattern`);
          break;
        }
      }
      
      return instructions.slice(0, 20);
      
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
   * Extract instructions from JSON-LD structured data
   * @param {string} htmlContent - HTML content
   * @returns {Array} Instructions array
   */
  static extractJsonLdInstructions(htmlContent) {
    const instructions = [];
    
    try {
      const jsonLdRegex = /<script[^>]*type[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
      const scripts = [...htmlContent.matchAll(jsonLdRegex)];
      
      for (const script of scripts) {
        try {
          const jsonContent = script[1].trim();
          const data = JSON.parse(jsonContent);
          
          const recipes = Array.isArray(data) ? data : [data];
          
          for (const item of recipes) {
            const recipe = item['@type'] === 'Recipe' ? item : 
                          item['@graph']?.find(g => g['@type'] === 'Recipe');
            
            if (recipe?.recipeInstructions) {
              for (const instruction of recipe.recipeInstructions) {
                const text = typeof instruction === 'string' ? instruction : instruction.text;
                if (text && text.length > 10) {
                  instructions.push(this.cleanInstructionText(text));
                }
              }
              
              if (instructions.length > 0) {
                return instructions;
              }
            }
          }
        } catch (e) {
          continue;
        }
      }
    } catch (error) {
      console.error('JSON-LD extraction error:', error);
    }
    
    return instructions;
  }

  /**
   * Extract instructions from HTML patterns
   * @param {string} htmlContent - HTML content
   * @returns {Array} Instructions array
   */
  static extractHtmlInstructions(htmlContent) {
    const instructions = [];
    
    try {
      const patterns = [
        // Ordered lists with instruction classes
        /<ol[^>]*class[^>]*(?:recipe-instructions|instructions|directions|method|steps)[^>]*>([\s\S]*?)<\/ol>/gi,
        // Div containers with instruction classes
        /<div[^>]*class[^>]*(?:recipe-instructions|instructions|directions|method|steps|instruction-list)[^>]*>([\s\S]*?)<\/div>/gi,
        // Unordered lists with instruction classes
        /<ul[^>]*class[^>]*(?:recipe-instructions|instructions|directions|method|steps)[^>]*>([\s\S]*?)<\/ul>/gi,
        // General ordered lists (last resort)
        /<ol[^>]*>([\s\S]*?)<\/ol>/gi,
        // Section tags with instruction content
        /<section[^>]*class[^>]*(?:instructions|directions|method)[^>]*>([\s\S]*?)<\/section>/gi
      ];

      for (const pattern of patterns) {
        const matches = [...htmlContent.matchAll(pattern)];
        
        for (const match of matches) {
          const content = match[1];
          const listItems = [...content.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)];
          
          // Also try to extract from paragraphs if no list items found
          if (listItems.length === 0) {
            const paragraphs = [...content.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)];
            for (const para of paragraphs) {
              const text = this.cleanInstructionText(para[1]);
              if (text.length > 15 && text.length < 500 && this.isValidInstruction(text)) {
                instructions.push(text);
              }
            }
          } else {
            for (const item of listItems) {
              const text = this.cleanInstructionText(item[1]);
              if (text.length > 15 && text.length < 500 && this.isValidInstruction(text)) {
                instructions.push(text);
              }
            }
          }
          
          if (instructions.length > 0) {
            return instructions;
          }
        }
      }
    } catch (error) {
      console.error('HTML extraction error:', error);
    }
    
    return instructions;
  }

  /**
   * Check if text looks like a valid cooking instruction (AGGRESSIVE VERSION)
   * @param {string} text - Text to validate
   * @returns {boolean} Whether text is a valid instruction
   */
  static isValidInstruction(text) {
    const lowerText = text.toLowerCase().trim();
    
    // Reject very short or very long text
    if (lowerText.length < 10 || lowerText.length > 1000) {
      return false;
    }
    
    // Aggressive cooking vocabulary - much more comprehensive
    const cookingTerms = [
      // Actions
      'heat', 'cook', 'bake', 'fry', 'saute', 'sauté', 'boil', 'simmer', 'mix', 'stir', 'combine',
      'add', 'pour', 'season', 'chop', 'dice', 'slice', 'mince', 'preheat', 'serve', 'whip',
      'remove', 'place', 'put', 'set', 'whisk', 'beat', 'fold', 'sprinkle', 'garnish', 'grill',
      'blend', 'process', 'marinate', 'chill', 'freeze', 'thaw', 'drain', 'rinse', 'wash',
      'roast', 'broil', 'steam', 'poach', 'braise', 'sear', 'brown', 'caramelize', 'reduce',
      'strain', 'cut', 'trim', 'peel', 'core', 'seed', 'zest', 'juice', 'squeeze', 'crush',
      'knead', 'roll', 'shape', 'form', 'wrap', 'cover', 'uncover', 'flip', 'turn', 'toss',
      'baste', 'brush', 'coat', 'dust', 'drizzle', 'spoon', 'ladle', 'scoop', 'transfer',
      
      // Equipment
      'oven', 'pan', 'pot', 'bowl', 'skillet', 'saucepan', 'baking', 'sheet', 'dish',
      'mixer', 'blender', 'processor', 'knife', 'cutting', 'board', 'spatula', 'whisk',
      
      // Measurements & Time
      'cup', 'cups', 'tablespoon', 'teaspoon', 'pound', 'ounce', 'gram', 'liter', 'quart',
      'minute', 'minutes', 'hour', 'hours', 'second', 'seconds', 'until', 'degrees',
      'temperature', 'tender', 'golden', 'brown', 'bubbling', 'thick', 'smooth',
      
      // Common recipe words
      'ingredient', 'ingredients', 'mixture', 'batter', 'dough', 'sauce', 'marinade',
      'topping', 'filling', 'seasoning', 'spice', 'herb', 'salt', 'pepper', 'oil',
      'butter', 'onion', 'garlic', 'water', 'milk', 'egg', 'flour', 'sugar'
    ];
    
    // Check for cooking terms
    const hasCookingTerm = cookingTerms.some(term => lowerText.includes(term));
    
    // Instruction patterns
    const instructionPatterns = [
      /\b(step|steps?)\s*\d+/i,
      /^\d+[\.\)]\s/,  // Numbered steps
      /\b(first|second|third|then|next|finally|meanwhile|while|after|before)\b/i,
      /(heat|cook|bake|add|mix|stir|combine|place|put|remove)/i,
      /\d+\s*(minutes?|hours?|seconds?)/i,
      /\d+\s*(degrees?|°[fc]?)/i,
      /(until|when|once)\s+\w+/i
    ];
    
    const hasInstructionPattern = instructionPatterns.some(pattern => pattern.test(lowerText));
    
    // Reject obvious non-instructions
    const rejectPatterns = [
      /^(recipe|print|save|share|comment|rate|review|photo|image|video)/i,
      /^(copyright|©|all rights|terms|privacy|policy)/i,
      /^(advertisement|ads|sponsor|affiliate)/i,
      /^(sign up|subscribe|newsletter|email)/i,
      /^(facebook|twitter|instagram|pinterest|social)/i,
      /^(related|similar|more recipes|you might like)/i,
      /^(nutritional|nutrition facts|calories per)/i,
      /^(prep time|cook time|total time|servings|yield)/i,
      /^\s*\d+\s*$/, // Just numbers
      /^[^a-zA-Z]*$/, // No letters at all
      /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i // Dates
    ];
    
    const shouldReject = rejectPatterns.some(pattern => pattern.test(lowerText));
    
    // Final decision - much more aggressive acceptance
    const isValid = (hasCookingTerm || hasInstructionPattern) && 
                   !shouldReject && 
                   /[a-zA-Z]/.test(text) && // Has letters
                   text.split(' ').length >= 3; // At least 3 words
    
    return isValid;
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
   * Get recipes similar to the provided recipe
   * @param {Object} currentRecipe - The reference recipe object
   * @param {number} count - Number of similar recipes to fetch (default: 15)
   * @returns {Promise<Object>} Similar recipes result
   */
  static async getSimilarRecipes(currentRecipe, count = 15) {
    try {
      console.log('🔍 Fetching similar recipes for:', currentRecipe.label);
      console.log('📝 Recipe details:', {
        dishType: currentRecipe.dishType,
        cuisineType: currentRecipe.cuisineType,
        mealType: currentRecipe.mealType
      });
      
      // Extract meaningful search terms from the recipe title
      const recipeTitle = currentRecipe.label.toLowerCase();
      console.log('📋 Recipe title:', recipeTitle);
      
      // Extract key ingredients and cooking methods from title
      const meaningfulWords = recipeTitle
        .split(' ')
        .filter(word => 
          word.length > 3 && 
          !['with', 'and', 'the', 'recipe', 'easy', 'quick', 'simple', 'best', 'perfect', 'homemade', 'delicious'].includes(word)
        )
        .slice(0, 3); // Take first 3 meaningful words
      
      console.log('🎯 Meaningful words found:', meaningfulWords);
      
      // Create multiple search strategies
      const searchStrategies = [];
      
      // Strategy 1: Use dish type if available
      if (currentRecipe.dishType && currentRecipe.dishType.length > 0) {
        searchStrategies.push({
          query: currentRecipe.dishType[0],
          options: {
            dishType: currentRecipe.dishType[0],
            cuisineType: currentRecipe.cuisineType?.[0],
            from: 0,
            to: Math.min(count * 2, 20)
          }
        });
      }
      
      // Strategy 2: Use meaningful words from title
      if (meaningfulWords.length > 0) {
        searchStrategies.push({
          query: meaningfulWords[0],
          options: {
            cuisineType: currentRecipe.cuisineType?.[0],
            mealType: currentRecipe.mealType?.[0],
            from: 0,
            to: Math.min(count * 2, 20)
          }
        });
        
        // Strategy 3: Combine first two meaningful words
        if (meaningfulWords.length >= 2) {
          searchStrategies.push({
            query: `${meaningfulWords[0]} ${meaningfulWords[1]}`,
            options: {
              from: 0,
              to: Math.min(count * 2, 20)
            }
          });
        }
      }
      
      // Strategy 4: Use cuisine type if available
      if (currentRecipe.cuisineType && currentRecipe.cuisineType.length > 0) {
        searchStrategies.push({
          query: 'popular',
          options: {
            cuisineType: currentRecipe.cuisineType[0],
            mealType: currentRecipe.mealType?.[0],
            from: 0,
            to: Math.min(count * 2, 20)
          }
        });
      }
      
      // Strategy 5: Fallback searches
      searchStrategies.push(
        { query: 'chicken', options: { from: 0, to: 20 } },
        { query: 'pasta', options: { from: 0, to: 20 } },
        { query: 'healthy', options: { from: 0, to: 20 } }
      );
      
      console.log(`🔎 Using ${searchStrategies.length} search strategies`);
      
      const allRecipes = [];
      const seenUris = new Set([currentRecipe.id, currentRecipe.uri]); // Exclude original recipe
      
      // Try each search strategy until we have enough recipes
      for (let i = 0; i < searchStrategies.length && allRecipes.length < count * 2; i++) {
        const strategy = searchStrategies[i];
        
        try {
          console.log(`🔍 Strategy ${i + 1}: Searching for "${strategy.query}" with options:`, strategy.options);
          
          const result = await this.searchRecipes(strategy.query, {
            ...strategy.options,
            curatedOnly: false // Allow more sources for variety
          });
          
          if (result.success && result.data.recipes) {
            console.log(`✅ Strategy ${i + 1} found ${result.data.recipes.length} recipes`);
            
            result.data.recipes.forEach(foundRecipe => {
              // Avoid duplicates and ensure we don't include the original recipe
              if (!seenUris.has(foundRecipe.id) && 
                  !seenUris.has(foundRecipe.uri) && 
                  allRecipes.length < count * 2) {
                allRecipes.push(foundRecipe);
                seenUris.add(foundRecipe.id);
                seenUris.add(foundRecipe.uri);
              }
            });
            
            console.log(`📊 Total unique recipes collected: ${allRecipes.length}`);
          } else {
            console.log(`❌ Strategy ${i + 1} failed:`, result.error);
          }
        } catch (searchError) {
          console.log(`⚠️ Strategy ${i + 1} error:`, searchError.message);
        }
      }
      
      // Shuffle and limit results for variety
      const shuffledRecipes = allRecipes
        .sort(() => 0.5 - Math.random())
        .slice(0, count);
      
      console.log(`🎉 Final result: ${shuffledRecipes.length} similar recipes selected`);
      
      return {
        success: true,
        data: {
          recipes: shuffledRecipes,
          total: shuffledRecipes.length,
          searchTerms: meaningfulWords,
          strategiesUsed: searchStrategies.length
        }
      };

    } catch (error) {
      console.error('❌ Error fetching similar recipes:', error);
      
      // Fallback: try a simple search
      try {
        console.log('🔄 Trying fallback search for similar recipes...');
        const fallbackResult = await this.searchRecipes('popular', { 
          from: 0, 
          to: count,
          curatedOnly: false 
        });
        
        if (fallbackResult.success && fallbackResult.data.recipes) {
          const fallbackRecipes = fallbackResult.data.recipes
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
        error: error.message || 'Failed to fetch similar recipes',
        data: {
          recipes: [],
          total: 0
        }
      };
    }
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
