import EdamamService from './edamam-service';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getConfig, PRODUCTION_OPTIMIZATIONS, HEALTH_CHECKS } from '../config/production-config';

class RecipeCacheService {
  constructor() {
    // Load production configuration
    this.config = getConfig();
    console.log(`🚀 Initializing ${this.config.environment} cache configuration`);
    
    // Core cache data
    this.popularRecipes = null;
    this.trendingRecipes = null;
    this.searchCache = new Map(); // Cache for user search results
    this.similarRecipesCache = new Map(); // Cache for similar recipes
    this.lastFetchTime = null;
    
    // Environment-specific cache durations
    this.CACHE_DURATION = this.config.POPULAR_RECIPES;
    this.SEARCH_CACHE_DURATION = this.config.SEARCH_RESULTS;
    this.SIMILAR_RECIPES_CACHE_DURATION = this.config.SIMILAR_RECIPES;
    
    // Environment-specific cache limits
    this.MAX_SEARCH_CACHE_SIZE = this.config.MAX_SEARCH_CACHE_SIZE;
    this.MAX_SIMILAR_CACHE_SIZE = this.config.MAX_SIMILAR_CACHE_SIZE;
    this.MEMORY_WARNING_THRESHOLD = this.config.MEMORY_WARNING_THRESHOLD;
    this.CACHE_CLEANUP_INTERVAL = this.config.CLEANUP_INTERVAL;
    this.PRELOAD_BATCH_SIZE = this.config.PRELOAD_BATCH_SIZE;
    
    // Environment-specific API limits
    this.API_CALL_LIMIT = this.config.CALLS_PER_MINUTE;
    this.MONTHLY_LIMIT = this.config.MONTHLY_LIMIT;
    this.apiCallCount = 0;
    this.lastApiCallTime = null;
    
    // Production monitoring
    this.cacheStats = {
      hitRate: 0,
      missCount: 0,
      hitCount: 0,
      memoryUsage: 0,
      lastOptimization: Date.now()
    };
    
    // Cache access tracking for LRU eviction
    this.searchCacheAccess = new Map(); // Track access times
    this.similarCacheAccess = new Map(); // Track access times
    
    // Background tasks
    this.cleanupInterval = null;
    this.preloadInProgress = false;
    
    // Storage management
    this.MAX_STORAGE_SIZE = 50 * 1024 * 1024; // 50MB limit
    this.STORAGE_WARNING_THRESHOLD = 40 * 1024 * 1024; // 40MB warning
    this.currentStorageSize = 0;
    this.isStorageFull = false;
    this.lastStorageCheck = 0;
    
    this.STORAGE_KEYS = {
      POPULAR_RECIPES: 'cached_popular_recipes_v5',
      TRENDING_RECIPES: 'cached_trending_recipes_v5',
      SEARCH_CACHE: 'cached_search_results_v5',
      SIMILAR_RECIPES_CACHE: 'cached_similar_recipes_v5',
      CACHE_STATS: 'cache_statistics_v5',
      LAST_FETCH: 'recipes_last_fetch_v5',
      API_CALL_COUNT: 'api_call_count_v5',
      LAST_API_CALL: 'last_api_call_v5'
    };
  }

  /**
   * Initialize cache on app startup with production optimizations
   */
  async initializeCache() {
    try {
      console.log('🚀 Initializing production-optimized cache system...');
      
      // Check storage health before initialization
      await this.checkStorageHealth();
      
      // Load all cached data from persistent storage
      await this.loadFromStorage();
      await this.loadApiUsageTracking();
      await this.loadCacheStats();
      
      // Start background cache management
      this.startCacheManagement();
      
      // Handle initial cache population
      if (!this.popularRecipes || this.popularRecipes.length === 0) {
        console.log('🔄 First time setup - fetching initial popular recipes');
        await this.refreshPopularRecipes();
        
        // Start background preloading for instant access
        this.startBackgroundPreloading();
      } else {
        console.log(`✅ Using cached recipes (${this.popularRecipes.length} recipes available)`);
        console.log(`⏰ Cache age: ${this.getCacheAgeHours()} hours`);
        
        // Check if we need background refresh
        if (this.isCacheExpired() || this.getCacheAgeHours() > 48) {
          console.log('🔄 Starting background cache refresh...');
          this.refreshCacheInBackground();
        }
        
        // Continue background preloading
        this.startBackgroundPreloading();
      }
      
      // Optimize cache for production
      await this.optimizeCacheForProduction();
      
      console.log('✅ Production cache system initialized successfully');
      
    } catch (error) {
      console.error('❌ Error initializing production cache:', error);
    }
  }

  /**
   * Start production cache management (cleanup, monitoring, optimization)
   */
  startCacheManagement() {
    // Clear any existing interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Start periodic cache cleanup and optimization
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.performCacheOptimization();
      } catch (error) {
        console.error('Cache optimization error:', error);
      }
    }, this.CACHE_CLEANUP_INTERVAL);
    
    console.log('🧹 Production cache management started');
  }

  /**
   * Perform comprehensive cache optimization for production
   */
  async performCacheOptimization() {
    console.log('🔧 Performing cache optimization...');
    
    const startTime = Date.now();
    let optimizations = 0;
    
    // 1. Clean expired entries
    const expiredRemoved = await this.cleanExpiredEntries();
    optimizations += expiredRemoved;
    
    // 2. Enforce cache size limits with LRU eviction
    const lruEvicted = await this.enforceClacheSizeLimits();
    optimizations += lruEvicted;
    
    // 3. Monitor memory usage
    const memoryOptimized = await this.optimizeMemoryUsage();
    optimizations += memoryOptimized;
    
    // 4. Update cache statistics
    await this.updateCacheStats();
    
    const duration = Date.now() - startTime;
    console.log(`✅ Cache optimization completed: ${optimizations} items processed in ${duration}ms`);
    
    this.cacheStats.lastOptimization = Date.now();
  }

  /**
   * Clean all expired cache entries
   */
  async cleanExpiredEntries() {
    let removedCount = 0;
    const now = Date.now();
    
    // Clean search cache
    for (const [key, entry] of this.searchCache.entries()) {
      if (now - entry.timestamp > this.SEARCH_CACHE_DURATION) {
        this.searchCache.delete(key);
        this.searchCacheAccess.delete(key);
        removedCount++;
      }
    }
    
    // Clean similar recipes cache
    for (const [key, entry] of this.similarRecipesCache.entries()) {
      if (now - entry.timestamp > this.SIMILAR_RECIPES_CACHE_DURATION) {
        this.similarRecipesCache.delete(key);
        this.similarCacheAccess.delete(key);
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      await this.saveToStorage();
      console.log(`🧹 Cleaned ${removedCount} expired cache entries`);
    }
    
    return removedCount;
  }

  /**
   * Enforce cache size limits using LRU eviction
   */
  async enforceClacheSizeLimits() {
    let evictedCount = 0;
    
    // Enforce search cache limit
    if (this.searchCache.size > this.MAX_SEARCH_CACHE_SIZE) {
      const toRemove = this.searchCache.size - this.MAX_SEARCH_CACHE_SIZE;
      const lruKeys = this.getLRUKeys(this.searchCacheAccess, toRemove);
      
      for (const key of lruKeys) {
        this.searchCache.delete(key);
        this.searchCacheAccess.delete(key);
        evictedCount++;
      }
    }
    
    // Enforce similar recipes cache limit
    if (this.similarRecipesCache.size > this.MAX_SIMILAR_CACHE_SIZE) {
      const toRemove = this.similarRecipesCache.size - this.MAX_SIMILAR_CACHE_SIZE;
      const lruKeys = this.getLRUKeys(this.similarCacheAccess, toRemove);
      
      for (const key of lruKeys) {
        this.similarRecipesCache.delete(key);
        this.similarCacheAccess.delete(key);
        evictedCount++;
      }
    }
    
    if (evictedCount > 0) {
      await this.saveToStorage();
      console.log(`🗑️ Evicted ${evictedCount} LRU cache entries to enforce size limits`);
    }
    
    return evictedCount;
  }

  /**
   * Get least recently used keys for eviction
   */
  getLRUKeys(accessMap, count) {
    return Array.from(accessMap.entries())
      .sort(([,a], [,b]) => a.lastAccess - b.lastAccess)
      .slice(0, count)
      .map(([key]) => key);
  }

  /**
   * Update cache access tracking for LRU
   */
  updateCacheAccess(cacheType, key) {
    const accessMap = cacheType === 'search' ? this.searchCacheAccess : this.similarCacheAccess;
    accessMap.set(key, {
      lastAccess: Date.now(),
      accessCount: (accessMap.get(key)?.accessCount || 0) + 1
    });
  }

  /**
   * Monitor and optimize memory usage
   */
  async optimizeMemoryUsage() {
    try {
      // Estimate cache memory usage
      const memoryUsage = this.estimateCacheMemoryUsage();
      this.cacheStats.memoryUsage = memoryUsage;
      
      if (memoryUsage > this.MEMORY_WARNING_THRESHOLD) {
        console.warn(`⚠️ High memory usage detected: ${Math.round(memoryUsage / 1024 / 1024)}MB`);
        
        // Reduce cache sizes by 25%
        const searchReduction = Math.floor(this.MAX_SEARCH_CACHE_SIZE * 0.25);
        const similarReduction = Math.floor(this.MAX_SIMILAR_CACHE_SIZE * 0.25);
        
        // Temporarily reduce limits
        this.MAX_SEARCH_CACHE_SIZE -= searchReduction;
        this.MAX_SIMILAR_CACHE_SIZE -= similarReduction;
        
        // Force immediate cleanup
        await this.enforceClacheSizeLimits();
        
        console.log(`🔧 Reduced cache limits: search=${this.MAX_SEARCH_CACHE_SIZE}, similar=${this.MAX_SIMILAR_CACHE_SIZE}`);
        return searchReduction + similarReduction;
      }
      
      return 0;
    } catch (error) {
      console.error('Memory optimization error:', error);
      return 0;
    }
  }

  /**
   * Estimate cache memory usage
   */
  estimateCacheMemoryUsage() {
    let totalSize = 0;
    
    // Estimate popular recipes size
    if (this.popularRecipes) {
      totalSize += JSON.stringify(this.popularRecipes).length * 2; // UTF-16
    }
    
    // Estimate search cache size
    for (const [key, value] of this.searchCache.entries()) {
      totalSize += (key.length + JSON.stringify(value).length) * 2;
    }
    
    // Estimate similar recipes cache size
    for (const [key, value] of this.similarRecipesCache.entries()) {
      totalSize += (key.length + JSON.stringify(value).length) * 2;
    }
    
    return totalSize;
  }

  /**
   * Start background preloading for instant user experience
   */
  async startBackgroundPreloading() {
    if (this.preloadInProgress) {
      console.log('⏳ Background preloading already in progress');
      return;
    }
    
    this.preloadInProgress = true;
    console.log('🔄 Starting background preloading...');
    
    try {
      // Preload instructions for popular recipes
      await this.preloadPopularRecipeInstructions();
      
      // Preload similar recipes for top recipes
      await this.preloadSimilarRecipes();
      
      // Preload common search results
      await this.preloadCommonSearches();
      
      console.log('✅ Background preloading completed');
    } catch (error) {
      console.error('❌ Background preloading error:', error);
    } finally {
      this.preloadInProgress = false;
    }
  }

  /**
   * Preload instructions for popular recipes in background
   */
  async preloadPopularRecipeInstructions() {
    if (!this.popularRecipes || this.popularRecipes.length === 0) {
      return;
    }
    
    console.log('📋 Preloading recipe instructions...');
    
    // Preload instructions for top recipes only
    const topRecipes = this.popularRecipes.slice(0, this.PRELOAD_BATCH_SIZE);
    let preloadedCount = 0;
    
    for (const recipe of topRecipes) {
      try {
        if (recipe.url) {
          // Check if already cached
          const EdamamService = (await import('./edamam-service.js')).default;
          const cachedInstructions = await EdamamService.getCachedInstructions(recipe.url);
          
          if (!cachedInstructions) {
            // Preload in background without waiting
            EdamamService.getRecipeInstructions(recipe.url).catch(error => {
              console.log(`Failed to preload instructions for ${recipe.label}:`, error.message);
            });
            preloadedCount++;
            
            // Small delay to avoid overwhelming the API
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      } catch (error) {
        console.log(`Skipping instruction preload for ${recipe.label}:`, error.message);
      }
    }
    
    console.log(`📋 Started preloading ${preloadedCount} recipe instructions`);
  }

  /**
   * Preload similar recipes for popular recipes
   */
  async preloadSimilarRecipes() {
    if (!this.popularRecipes || this.popularRecipes.length === 0) {
      return;
    }
    
    console.log('🔗 Preloading similar recipes...');
    
    const topRecipes = this.popularRecipes.slice(0, this.PRELOAD_BATCH_SIZE);
    let preloadedCount = 0;
    
    for (const recipe of topRecipes) {
      try {
        const EdamamService = (await import('./edamam-service.js')).default;
        const cacheKey = EdamamService.generateSimilarRecipesCacheKey(recipe, 12);
        
        // Check if already cached
        const cached = await this.getCachedSimilarRecipes(cacheKey);
        
        if (!cached) {
          // Preload in background without waiting
          EdamamService.getSimilarRecipes(recipe, 12).catch(error => {
            console.log(`Failed to preload similar recipes for ${recipe.label}:`, error.message);
          });
          preloadedCount++;
          
          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.log(`Skipping similar recipes preload for ${recipe.label}:`, error.message);
      }
    }
    
    console.log(`🔗 Started preloading ${preloadedCount} similar recipe sets`);
  }

  /**
   * Preload common search queries
   */
  async preloadCommonSearches() {
    const commonQueries = [
      'chicken', 'pasta', 'salad', 'soup', 'beef',
      'vegetarian', 'healthy', 'quick', 'easy', 'dinner'
    ];
    
    console.log('🔍 Preloading common searches...');
    
    let preloadedCount = 0;
    
    for (const query of commonQueries.slice(0, 5)) { // Limit to 5 most common
      try {
        // Check if already cached
        const cacheKey = this.generateSearchCacheKey(query, {});
        const cached = this.getSearchResults(cacheKey);
        
        if (!cached) {
          // Preload in background
          const EdamamService = (await import('./edamam-service.js')).default;
          EdamamService.searchRecipes(query, { from: 0, to: 20 }).catch(error => {
            console.log(`Failed to preload search for "${query}":`, error.message);
          });
          preloadedCount++;
          
          // Delay between searches
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      } catch (error) {
        console.log(`Skipping search preload for "${query}":`, error.message);
      }
    }
    
    console.log(`🔍 Started preloading ${preloadedCount} common searches`);
  }

  /**
   * Refresh cache in background without blocking UI
   */
  async refreshCacheInBackground() {
    console.log('🔄 Starting background cache refresh...');
    
    // Use setTimeout to make it truly non-blocking
    setTimeout(async () => {
      try {
        await this.refreshPopularRecipes();
        console.log('✅ Background cache refresh completed');
      } catch (error) {
        console.error('❌ Background cache refresh failed:', error);
      }
    }, 100); // Small delay to avoid blocking
  }

  /**
   * Optimize cache for production environment
   */
  async optimizeCacheForProduction() {
    console.log('🚀 Optimizing cache for production...');
    
    // 1. Clean any invalid or corrupted data
    await this.validateAndCleanCache();
    
    // 2. Ensure optimal cache structure
    await this.optimizeCacheStructure();
    
    // 3. Set up monitoring
    this.setupCacheMonitoring();
    
    console.log('✅ Production cache optimization completed');
  }

  /**
   * Validate and clean corrupted cache data
   */
  async validateAndCleanCache() {
    let cleanedCount = 0;
    
    // Validate popular recipes
    if (this.popularRecipes) {
      this.popularRecipes = this.popularRecipes.filter(recipe => {
        return recipe && recipe.id && recipe.label && recipe.image;
      });
    }
    
    // Validate search cache
    for (const [key, value] of this.searchCache.entries()) {
      if (!value || !value.results || !value.timestamp) {
        this.searchCache.delete(key);
        this.searchCacheAccess.delete(key);
        cleanedCount++;
      }
    }
    
    // Validate similar recipes cache
    for (const [key, value] of this.similarRecipesCache.entries()) {
      if (!value || !value.recipes || !value.timestamp) {
        this.similarRecipesCache.delete(key);
        this.similarCacheAccess.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      await this.saveToStorage();
      console.log(`🧹 Cleaned ${cleanedCount} invalid cache entries`);
    }
  }

  /**
   * Optimize cache data structures for performance
   */
  async optimizeCacheStructure() {
    // Pre-generate common cache keys for faster lookups
    this.commonCacheKeys = new Set();
    
    // Add popular recipe cache keys
    if (this.popularRecipes) {
      this.popularRecipes.forEach(recipe => {
        if (recipe.id) {
          this.commonCacheKeys.add(`similar_${recipe.id}_12`);
        }
      });
    }
    
    console.log(`📊 Optimized cache structure with ${this.commonCacheKeys.size} common keys`);
  }

  /**
   * Setup cache performance monitoring
   */
  setupCacheMonitoring() {
    // Track cache performance metrics
    this.performanceTracker = {
      cacheHits: 0,
      cacheMisses: 0,
      avgResponseTime: 0,
      memoryPressure: false,
      lastOptimization: Date.now()
    };
    
    console.log('📊 Cache monitoring system activated');
  }

  /**
   * Track cache hit for performance monitoring
   */
  trackCacheHit(cacheType, responseTime) {
    if (this.cacheStats) {
      this.cacheStats.hitCount++;
      
      // Update average response time
      const totalTime = this.cacheStats.avgResponseTime * (this.cacheStats.hitCount - 1) + responseTime;
      this.cacheStats.avgResponseTime = totalTime / this.cacheStats.hitCount;
      
      // Update hit rate
      const totalRequests = this.cacheStats.hitCount + this.cacheStats.missCount;
      this.cacheStats.hitRate = (this.cacheStats.hitCount / totalRequests) * 100;
    }
    
    if (this.performanceTracker) {
      this.performanceTracker.cacheHits++;
    }
  }

  /**
   * Track cache miss for performance monitoring
   */
  trackCacheMiss(cacheType) {
    if (this.cacheStats) {
      this.cacheStats.missCount++;
      
      // Update hit rate
      const totalRequests = this.cacheStats.hitCount + this.cacheStats.missCount;
      this.cacheStats.hitRate = (this.cacheStats.hitCount / totalRequests) * 100;
    }
    
    if (this.performanceTracker) {
      this.performanceTracker.cacheMisses++;
    }
  }

  /**
   * Async cleanup of expired entries without blocking
   */
  async cleanupExpiredEntry(cacheType, cacheKey) {
    setTimeout(async () => {
      try {
        if (cacheType === 'similar') {
          const similarRecipesCacheArray = Array.from(this.similarRecipesCache.entries());
          await AsyncStorage.setItem(
            this.STORAGE_KEYS.SIMILAR_RECIPES_CACHE, 
            JSON.stringify(similarRecipesCacheArray)
          );
        }
      } catch (error) {
        console.error('Async cleanup failed:', error);
      }
    }, 100);
  }

  /**
   * Load cache statistics from storage
   */
  async loadCacheStats() {
    try {
      const statsData = await AsyncStorage.getItem(this.STORAGE_KEYS.CACHE_STATS);
      if (statsData) {
        this.cacheStats = { ...this.cacheStats, ...JSON.parse(statsData) };
      }
    } catch (error) {
      console.error('Error loading cache stats:', error);
    }
  }

  /**
   * Save cache statistics to storage
   */
  async saveCacheStats() {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEYS.CACHE_STATS, JSON.stringify(this.cacheStats));
    } catch (error) {
      console.error('Error saving cache stats:', error);
    }
  }

  /**
   * Update cache statistics
   */
  async updateCacheStats() {
    if (!this.cacheStats) return;
    
    this.cacheStats.memoryUsage = this.estimateCacheMemoryUsage();
    this.cacheStats.lastOptimization = Date.now();
    
    // Save stats periodically
    await this.saveCacheStats();
  }

  /**
   * Get comprehensive production cache statistics
   */
  getProductionStats() {
    const memoryUsageMB = Math.round(this.cacheStats.memoryUsage / 1024 / 1024 * 100) / 100;
    const hitRatePercent = Math.round(this.cacheStats.hitRate * 100) / 100;
    
    return {
      // Cache Performance
      hitRate: `${hitRatePercent}%`,
      totalHits: this.cacheStats.hitCount,
      totalMisses: this.cacheStats.missCount,
      avgResponseTime: `${Math.round(this.cacheStats.avgResponseTime)}ms`,
      
      // Memory Usage
      memoryUsage: `${memoryUsageMB}MB`,
      memoryWarning: memoryUsageMB > 50,
      
      // Cache Sizes
      popularRecipesCount: this.popularRecipes?.length || 0,
      searchCacheSize: this.searchCache.size,
      similarCacheSize: this.similarRecipesCache.size,
      
      // Cache Limits
      searchCacheLimit: this.MAX_SEARCH_CACHE_SIZE,
      similarCacheLimit: this.MAX_SIMILAR_CACHE_SIZE,
      
      // Production Status
      backgroundPreloadActive: this.preloadInProgress,
      cacheOptimizationActive: !!this.cleanupInterval,
      lastOptimization: new Date(this.cacheStats.lastOptimization).toISOString(),
      
      // API Efficiency
      apiCallsThisMinute: this.apiCallCount,
      canMakeApiCall: this.canMakeApiCall(),
      monthlyLimit: this.MONTHLY_LIMIT,
      
      // Cache Age
      cacheAgeHours: this.getCacheAgeHours(),
      cacheExpired: this.isCacheExpired(),
      
      // Production Health
      systemHealth: this.getSystemHealth()
    };
  }

  /**
   * Get overall system health status
   */
  getSystemHealth() {
    const memoryUsageMB = this.cacheStats.memoryUsage / 1024 / 1024;
    const hitRate = this.cacheStats.hitRate;
    
    if (memoryUsageMB > 100 || hitRate < 50) {
      return 'CRITICAL';
    } else if (memoryUsageMB > 50 || hitRate < 70) {
      return 'WARNING';
    } else if (hitRate > 85 && memoryUsageMB < 30) {
      return 'EXCELLENT';
    } else {
      return 'GOOD';
    }
  }

  /**
   * Force cache optimization (for production maintenance)
   */
  async forceOptimization() {
    console.log('🚨 Force cache optimization requested');
    await this.performCacheOptimization();
    return this.getProductionStats();
  }

  /**
   * Emergency cache cleanup (for critical memory situations)
   */
  async emergencyCleanup() {
    console.log('🆘 Emergency cache cleanup initiated');
    
    // Clear all non-essential caches
    this.searchCache.clear();
    this.searchCacheAccess.clear();
    
    // Keep only top 20 similar recipes (reduced from 50)
    const sortedSimilar = Array.from(this.similarCacheAccess.entries())
      .sort(([,a], [,b]) => b.accessCount - a.accessCount)
      .slice(0, 20);
    
    const keepKeys = new Set(sortedSimilar.map(([key]) => key));
    
    for (const key of this.similarRecipesCache.keys()) {
      if (!keepKeys.has(key)) {
        this.similarRecipesCache.delete(key);
        this.similarCacheAccess.delete(key);
      }
    }
    
    // Reduce popular recipes to essential only
    if (this.popularRecipes && this.popularRecipes.length > 50) {
      this.popularRecipes = this.popularRecipes.slice(0, 50);
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    this.isStorageFull = false;
    await this.saveToStorageWithRetry();
    console.log('✅ Emergency cleanup completed');
    
    return this.getProductionStats();
  }

  /**
   * Emergency storage cleanup when SQLite is full
   */
  async emergencyStorageCleanup() {
    console.log('🆘 SQLITE_FULL detected - Emergency storage cleanup');
    
    try {
      // Clear all volatile caches first
      this.searchCache.clear();
      this.searchCacheAccess.clear();
      this.similarRecipesCache.clear();
      this.similarCacheAccess.clear();
      
      // Remove all cache-related storage keys
      const keysToRemove = [
        this.STORAGE_KEYS.SEARCH_CACHE,
        this.STORAGE_KEYS.SIMILAR_RECIPES_CACHE,
        this.STORAGE_KEYS.CACHE_STATS
      ];
      
      await Promise.all(keysToRemove.map(key => 
        AsyncStorage.removeItem(key).catch(err => 
          console.warn(`Failed to remove ${key}:`, err.message)
        )
      ));
      
      // Keep only essential popular recipes (top 20)
      if (this.popularRecipes && this.popularRecipes.length > 20) {
        this.popularRecipes = this.popularRecipes.slice(0, 20);
      }
      
      // Save minimal essential data only
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.POPULAR_RECIPES, 
        JSON.stringify(this.popularRecipes || [])
      );
      
      this.isStorageFull = false;
      console.log('✅ Emergency storage cleanup completed');
      
    } catch (error) {
      console.error('❌ Emergency storage cleanup failed:', error);
      // Last resort - clear everything
      try {
        await AsyncStorage.clear();
        console.log('⚠️ Performed complete storage clear');
      } catch (clearError) {
        console.error('❌ Complete storage clear failed:', clearError);
      }
    }
  }

  /**
   * Check storage health and perform cleanup if needed
   */
  async checkStorageHealth() {
    try {
      // Try to get available storage info
      const testKey = 'storage_health_test';
      const testData = 'test';
      
      await AsyncStorage.setItem(testKey, testData);
      await AsyncStorage.removeItem(testKey);
      
      // Estimate current storage usage
      const currentSize = this.estimateStorageSize();
      
      if (currentSize > this.STORAGE_WARNING_THRESHOLD) {
        console.warn(`⚠️ Storage usage high: ${Math.round(currentSize / 1024 / 1024)}MB`);
        await this.performStorageOptimization();
      }
      
      console.log(`📊 Storage health check passed: ${Math.round(currentSize / 1024 / 1024)}MB used`);
      
    } catch (error) {
      console.error('❌ Storage health check failed:', error);
      
      if (error.message.includes('SQLITE_FULL') || error.code === 13) {
        console.log('🆘 Storage full detected during health check');
        await this.emergencyStorageCleanup();
      }
    }
  }

  /**
   * Production-ready shutdown cleanup
   */
  async shutdown() {
    console.log('🔄 Shutting down cache service...');
    
    // Clear intervals
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    // Save final state with error handling
    try {
      await this.updateCacheStats();
      await this.saveToStorage();
    } catch (error) {
      console.error('⚠️ Error during shutdown save:', error);
      // Don't throw during shutdown
    }
    
    console.log('✅ Cache service shutdown completed');
  }

  /**
   * Load cached recipes from AsyncStorage
   */
  async loadFromStorage() {
    try {
      // Load items individually to handle CursorWindow errors gracefully
      try {
        const popularData = await AsyncStorage.getItem(this.STORAGE_KEYS.POPULAR_RECIPES);
        if (popularData) this.popularRecipes = JSON.parse(popularData);
      } catch (error) {
        if (error.message.includes('CursorWindow') || error.message.includes('Row too big')) {
          console.warn('⚠️ Popular recipes cache too large, clearing...');
          await AsyncStorage.removeItem(this.STORAGE_KEYS.POPULAR_RECIPES);
        } else {
          throw error;
        }
      }

      try {
        const trendingData = await AsyncStorage.getItem(this.STORAGE_KEYS.TRENDING_RECIPES);
        if (trendingData) this.trendingRecipes = JSON.parse(trendingData);
      } catch (error) {
        if (error.message.includes('CursorWindow') || error.message.includes('Row too big')) {
          console.warn('⚠️ Trending recipes cache too large, clearing...');
          await AsyncStorage.removeItem(this.STORAGE_KEYS.TRENDING_RECIPES);
        } else {
          throw error;
        }
      }

      try {
        const searchCacheData = await AsyncStorage.getItem(this.STORAGE_KEYS.SEARCH_CACHE);
        if (searchCacheData) {
          const searchCacheArray = JSON.parse(searchCacheData);
          this.searchCache = new Map(searchCacheArray);
        }
      } catch (error) {
        if (error.message.includes('CursorWindow') || error.message.includes('Row too big')) {
          console.warn('⚠️ Search cache too large, clearing...');
          await AsyncStorage.removeItem(this.STORAGE_KEYS.SEARCH_CACHE);
        } else {
          throw error;
        }
      }

      try {
        const similarRecipesCacheData = await AsyncStorage.getItem(this.STORAGE_KEYS.SIMILAR_RECIPES_CACHE);
        if (similarRecipesCacheData) {
          const similarRecipesCacheArray = JSON.parse(similarRecipesCacheData);
          this.similarRecipesCache = new Map(similarRecipesCacheArray);
        }
      } catch (error) {
        if (error.message.includes('CursorWindow') || error.message.includes('Row too big')) {
          console.warn('⚠️ Similar recipes cache too large, clearing...');
          await AsyncStorage.removeItem(this.STORAGE_KEYS.SIMILAR_RECIPES_CACHE);
        } else {
          throw error;
        }
      }

      try {
        const lastFetchData = await AsyncStorage.getItem(this.STORAGE_KEYS.LAST_FETCH);
        if (lastFetchData) this.lastFetchTime = parseInt(lastFetchData);
      } catch (error) {
        console.warn('⚠️ Could not load last fetch time:', error.message);
      }

      console.log('✅ Storage loaded successfully');
    } catch (error) {
      console.error('Error loading from storage:', error);
      // Clear all cache if loading fails completely
      await this.clearAllStorage();
    }
  }

  /**
   * Load API usage tracking from storage
   */
  async loadApiUsageTracking() {
    try {
      const [apiCallData, lastApiCallData] = await Promise.all([
        AsyncStorage.getItem(this.STORAGE_KEYS.API_CALL_COUNT),
        AsyncStorage.getItem(this.STORAGE_KEYS.LAST_API_CALL)
      ]);

      if (apiCallData) this.apiCallCount = parseInt(apiCallData);
      if (lastApiCallData) this.lastApiCallTime = parseInt(lastApiCallData);
    } catch (error) {
      console.error('Error loading API usage tracking:', error);
    }
  }

  /**
   * Save API usage tracking to storage
   */
  async saveApiUsageTracking() {
    try {
      await Promise.all([
        AsyncStorage.setItem(this.STORAGE_KEYS.API_CALL_COUNT, this.apiCallCount.toString()),
        AsyncStorage.setItem(this.STORAGE_KEYS.LAST_API_CALL, this.lastApiCallTime.toString())
      ]);
    } catch (error) {
      console.error('Error saving API usage tracking:', error);
    }
  }

  /**
   * Save cached recipes to AsyncStorage with size management
   */
  async saveToStorage() {
    try {
      await this.saveToStorageWithRetry();
    } catch (error) {
      console.error('Error saving to storage:', error);
      
      // Handle SQLite full error
      if (error.message.includes('SQLITE_FULL') || error.code === 13) {
        await this.emergencyStorageCleanup();
      }
    }
  }

  /**
   * Save to storage with retry logic and size management
   */
  async saveToStorageWithRetry(retryCount = 0) {
    const maxRetries = 3;
    
    try {
      // Check storage size before saving
      const estimatedSize = this.estimateStorageSize();
      
      if (estimatedSize > this.STORAGE_WARNING_THRESHOLD) {
        console.warn(`⚠️ Storage size warning: ${Math.round(estimatedSize / 1024 / 1024)}MB`);
        await this.performStorageOptimization();
      }
      
      if (estimatedSize > this.MAX_STORAGE_SIZE) {
        console.error(`❌ Storage size limit exceeded: ${Math.round(estimatedSize / 1024 / 1024)}MB`);
        await this.emergencyCleanup();
      }
      
      // Convert Map to Array for JSON serialization
      const searchCacheArray = Array.from(this.searchCache.entries());
      const similarCacheArray = Array.from(this.similarRecipesCache.entries());
      
      // Save in smaller chunks to avoid hitting size limits
      await this.saveInChunks({
        [this.STORAGE_KEYS.POPULAR_RECIPES]: this.popularRecipes,
        [this.STORAGE_KEYS.TRENDING_RECIPES]: this.trendingRecipes,
        [this.STORAGE_KEYS.SEARCH_CACHE]: searchCacheArray,
        [this.STORAGE_KEYS.SIMILAR_RECIPES_CACHE]: similarCacheArray,
        [this.STORAGE_KEYS.LAST_FETCH]: this.lastFetchTime?.toString()
      });
      
    } catch (error) {
      console.error(`Storage save attempt ${retryCount + 1} failed:`, error);
      
      // Handle SQLite full error
      if (error.message.includes('SQLITE_FULL') || error.code === 13) {
        if (retryCount < maxRetries) {
          console.log(`🔄 Retrying save after cleanup (attempt ${retryCount + 1}/${maxRetries})`);
          await this.emergencyStorageCleanup();
          return this.saveToStorageWithRetry(retryCount + 1);
        } else {
          console.error('❌ Max retries exceeded for storage save');
          throw error;
        }
      }
      
      throw error;
    }
  }

  /**
   * Save data in smaller chunks to avoid size limits
   */
  async saveInChunks(dataMap) {
    const promises = [];
    
    for (const [key, value] of Object.entries(dataMap)) {
      if (value !== undefined && value !== null) {
        promises.push(
          AsyncStorage.setItem(key, JSON.stringify(value))
            .catch(error => {
              console.warn(`Failed to save ${key}:`, error.message);
              // If individual save fails, try with reduced data
              if (key === this.STORAGE_KEYS.POPULAR_RECIPES && Array.isArray(value)) {
                return AsyncStorage.setItem(key, JSON.stringify(value.slice(0, 20)));
              }
              throw error;
            })
        );
      }
    }
    
    await Promise.all(promises);
  }

  /**
   * Estimate total storage size
   */
  estimateStorageSize() {
    let totalSize = 0;
    
    // Estimate popular recipes
    if (this.popularRecipes) {
      totalSize += JSON.stringify(this.popularRecipes).length * 2;
    }
    
    // Estimate search cache
    for (const [key, value] of this.searchCache.entries()) {
      totalSize += (key.length + JSON.stringify(value).length) * 2;
    }
    
    // Estimate similar recipes cache
    for (const [key, value] of this.similarRecipesCache.entries()) {
      totalSize += (key.length + JSON.stringify(value).length) * 2;
    }
    
    this.currentStorageSize = totalSize;
    return totalSize;
  }

  /**
   * Perform storage optimization to free up space
   */
  async performStorageOptimization() {
    console.log('🔧 Performing storage optimization...');
    
    // Reduce cache sizes by 30%
    const searchReduction = Math.floor(this.searchCache.size * 0.3);
    const similarReduction = Math.floor(this.similarRecipesCache.size * 0.3);
    
    // Remove oldest entries
    if (searchReduction > 0) {
      const oldestKeys = this.getLRUKeys(this.searchCacheAccess, searchReduction);
      oldestKeys.forEach(key => {
        this.searchCache.delete(key);
        this.searchCacheAccess.delete(key);
      });
    }
    
    if (similarReduction > 0) {
      const oldestKeys = this.getLRUKeys(this.similarCacheAccess, similarReduction);
      oldestKeys.forEach(key => {
        this.similarRecipesCache.delete(key);
        this.similarCacheAccess.delete(key);
      });
    }
    
    // Reduce popular recipes if too many
    if (this.popularRecipes && this.popularRecipes.length > 80) {
      this.popularRecipes = this.popularRecipes.slice(0, 80);
    }
    
    console.log(`✅ Storage optimization completed: removed ${searchReduction + similarReduction} cache entries`);
  }

  /**
   * Check if cache should be refreshed (much more conservative)
   */
  shouldRefreshCache() {
    // Never refresh if we have recipes and they're less than 7 days old
    if (this.popularRecipes && this.popularRecipes.length > 0) {
      const cacheAge = Date.now() - this.lastFetchTime;
      if (cacheAge < this.CACHE_DURATION) {
        return false;
      }
    }
    
    // Only refresh if cache is completely empty
    return !this.popularRecipes || this.popularRecipes.length === 0;
  }

  /**
   * Check if we can make API calls without hitting rate limits
   */
  canMakeApiCall() {
    const now = Date.now();
    
    // Reset call count if it's been more than a minute
    if (this.lastApiCallTime && (now - this.lastApiCallTime) > 60000) {
      this.apiCallCount = 0;
    }
    
    // Check rate limit (10 per minute)
    if (this.apiCallCount >= this.API_CALL_LIMIT) {
      console.warn('⚠️ API rate limit reached (10/minute)');
      return false;
    }
    
    return true;
  }

  /**
   * Track API call usage
   */
  async trackApiCall() {
    this.apiCallCount++;
    this.lastApiCallTime = Date.now();
    await this.saveApiUsageTracking();
  }

  /**
   * Check if cache is expired
   */
  isCacheExpired() {
    if (!this.lastFetchTime) return true;
    const age = Date.now() - this.lastFetchTime;
    return age > this.CACHE_DURATION;
  }

  /**
   * Get cache age in hours
   */
  getCacheAgeHours() {
    if (!this.lastFetchTime) return 0;
    return Math.floor((Date.now() - this.lastFetchTime) / (60 * 60 * 1000));
  }

  /**
   * Fetch and cache popular recipes - OPTIMIZED for API limits
   */
  async refreshPopularRecipes() {
    try {
      // Check if we can make API calls
      if (!this.canMakeApiCall()) {
        console.warn('⚠️ Cannot refresh - API rate limit reached');
        throw new Error('API rate limit reached. Please wait before refreshing.');
      }

      console.log('🔄 Fetching popular recipes (API optimized)...');
      
      // SIGNIFICANTLY REDUCED: Only 8 strategic queries instead of 40+
      const strategicQueries = [
        { query: 'chicken', category: 'protein' },
        { query: 'pasta', category: 'pasta' },
        { query: 'salad', category: 'salad' },
        { query: 'soup', category: 'soup' },
        { query: 'dessert', category: 'dessert' },
        { query: 'breakfast', category: 'breakfast' },
        { query: 'vegetarian', category: 'healthy' },
        { query: 'seafood', category: 'seafood' }
      ];

      console.log(`📊 Making ${strategicQueries.length} API calls (conserving monthly limit)`);

      // Sequential API calls with rate limiting (instead of parallel)
      const recipes = [];
      const seenRecipeIds = new Set();

      for (const { query, category } of strategicQueries) {
        try {
          // Check rate limit before each call
          if (!this.canMakeApiCall()) {
            console.warn('⚠️ Rate limit reached during fetch, stopping');
            break;
          }

          console.log(`🔍 Fetching ${query} recipes...`);
          
          const result = await EdamamService.searchRecipes(query, {
            from: 0,
            to: 20, // Get more recipes per call to maximize value
            curatedOnly: false,
            skipCache: true // Skip cache for cache service's own requests
          });

          // Track the API call
          await this.trackApiCall();

          if (result.success && result.data.recipes.length > 0) {
            // Add recipes from this category, avoiding duplicates
            result.data.recipes.forEach((recipe, recipeIndex) => {
              const uniqueId = recipe.id || recipe.uri;
              
              if (!seenRecipeIds.has(uniqueId) && recipes.length < 200) {
                seenRecipeIds.add(uniqueId);
                
                recipes.push({
                  id: `${uniqueId}_${category}_${recipeIndex}`,
                  title: recipe.label.length > 20 ? recipe.label.substring(0, 20) + '...' : recipe.label,
                  fullTitle: recipe.label,
                  image: recipe.image,
                  category,
                  query,
                  fullData: recipe,
                  calories: Math.round(recipe.calories / recipe.yield),
                  time: recipe.totalTime || this.estimateTime(category),
                  difficulty: this.calculateDifficulty(recipe),
                  rating: this.generateRating(),
                  source: recipe.source,
                  yield: recipe.yield,
                  dietLabels: recipe.dietLabels || [],
                  healthLabels: recipe.healthLabels || []
                });
              }
            });
          }

          // Small delay between calls to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 6500)); // ~6.5 seconds = safe for 10/minute limit

        } catch (error) {
          console.error(`❌ Error fetching ${query}:`, error.message);
          continue;
        }
      }

      if (recipes.length === 0) {
        throw new Error('No recipes fetched - check API limits or connectivity');
      }

      // Select the best recipes with good variety
      this.popularRecipes = this.selectBestRecipes(recipes, 100);
      this.lastFetchTime = Date.now();
      
      await this.saveToStorage();
      
      console.log(`✅ Successfully cached ${this.popularRecipes.length} popular recipes`);
      console.log(`📊 API calls used: ${this.apiCallCount}/10 per minute`);
      console.log(`📊 Categories: ${[...new Set(this.popularRecipes.map(r => r.category))].join(', ')}`);
      
      return this.popularRecipes;
    } catch (error) {
      console.error('Error refreshing popular recipes:', error);
      throw error;
    }
  }

  /**
   * Select the best recipes with good variety across categories
   */
  selectBestRecipes(recipes, targetCount = 100) {
    // First, ensure we have good category distribution
    const categoryGroups = {};
    recipes.forEach(recipe => {
      if (!categoryGroups[recipe.category]) {
        categoryGroups[recipe.category] = [];
      }
      categoryGroups[recipe.category].push(recipe);
    });

    // Sort each category by quality factors
    Object.keys(categoryGroups).forEach(category => {
      categoryGroups[category].sort((a, b) => {
        // Prefer recipes with images
        if (a.image && !b.image) return -1;
        if (!a.image && b.image) return 1;
        
        // Prefer reasonable cooking times (not too long, not too short)
        const timeA = a.time || 45;
        const timeB = b.time || 45;
        const idealTime = 30;
        const timeScoreA = Math.abs(timeA - idealTime);
        const timeScoreB = Math.abs(timeB - idealTime);
        if (timeScoreA !== timeScoreB) return timeScoreA - timeScoreB;
        
        // Prefer higher ratings
        return parseFloat(b.rating) - parseFloat(a.rating);
      });
    });

    // Select recipes ensuring variety across categories
    const selectedRecipes = [];
    const categories = Object.keys(categoryGroups);
    const recipesPerCategory = Math.floor(targetCount / categories.length);
    const remainder = targetCount % categories.length;

    // Distribute recipes across categories
    categories.forEach((category, index) => {
      const categoryRecipes = categoryGroups[category];
      let countForCategory = recipesPerCategory;
      
      // Add remainder to first few categories
      if (index < remainder) {
        countForCategory += 1;
      }
      
      // Take the best recipes from this category
      selectedRecipes.push(...categoryRecipes.slice(0, countForCategory));
    });

    // If we still need more recipes, add the best remaining ones
    const remainingRecipes = recipes.filter(recipe => 
      !selectedRecipes.some(selected => selected.id === recipe.id)
    );

    while (selectedRecipes.length < targetCount && remainingRecipes.length > 0) {
      selectedRecipes.push(remainingRecipes.shift());
    }

    // Shuffle for variety
    return this.shuffleArray(selectedRecipes).slice(0, targetCount);
  }

  /**
   * Estimate cooking time based on category
   */
  estimateTime(category) {
    const timeEstimates = {
      'breakfast': 15,
      'salad': 10,
      'soup': 45,
      'dessert': 60,
      'pasta': 25,
      'protein': 30,
      'seafood': 20,
      'healthy': 15,
      'sides': 25,
      'stew': 90,
      'rice': 30
    };
    
    return timeEstimates[category] || 30;
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
  async getPopularRecipes(count = 8) {
    if (!this.popularRecipes || this.shouldRefreshCache()) {
      await this.refreshPopularRecipes();
    }
    
    return this.popularRecipes
      ? this.shuffleArray([...this.popularRecipes]).slice(0, count)
      : [];
  }

  /**
   * Force refresh popular recipes (for refresh button) - WITH API LIMITS CHECK
   */
  async forceRefreshPopularRecipes() {
    console.log('🔄 Force refreshing popular recipes...');
    
    // Check API limits first
    if (!this.canMakeApiCall()) {
      const waitTime = 60 - Math.floor((Date.now() - this.lastApiCallTime) / 1000);
      throw new Error(`API rate limit reached. Please wait ${waitTime} seconds before refreshing.`);
    }

    // Check if cache is still fresh (less than 6 hours old)
    const cacheAgeHours = this.getCacheAgeHours();
    if (this.popularRecipes && this.popularRecipes.length > 0 && cacheAgeHours < 6) {
      console.log(`⚠️ Cache is only ${cacheAgeHours} hours old. Shuffling existing recipes instead.`);
      
      // Instead of API calls, just shuffle existing recipes for variety
      this.popularRecipes = this.shuffleArray([...this.popularRecipes]);
      await this.saveToStorage();
      
      return this.popularRecipes;
    }

    // Clear current cache only if it's old enough
    this.popularRecipes = null;
    this.lastFetchTime = null;
    
    // Fetch fresh recipes
    return await this.refreshPopularRecipes();
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
    const cacheAge = this.lastFetchTime ? Date.now() - this.lastFetchTime : null;
    const cacheAgeHours = cacheAge ? Math.floor(cacheAge / (60 * 60 * 1000)) : null;
    
    return {
      hasPopularRecipes: !!this.popularRecipes,
      popularRecipesCount: this.popularRecipes?.length || 0,
      lastFetchTime: this.lastFetchTime,
      cacheAge: cacheAge,
      cacheAgeHours: cacheAgeHours,
      shouldRefresh: this.shouldRefreshCache(),
      cacheDurationHours: this.CACHE_DURATION / (60 * 60 * 1000),
      categories: this.popularRecipes ? [...new Set(this.popularRecipes.map(r => r.category))] : []
    };
  }

  /**
   * Log cache status for debugging
   */
  logCacheStatus() {
    const status = this.getCacheStatus();
    console.log('📊 Recipe Cache Status:', {
      'Has Recipes': status.hasPopularRecipes,
      'Recipe Count': status.popularRecipesCount,
      'Cache Age (hours)': status.cacheAgeHours,
      'Should Refresh': status.shouldRefresh,
      'Categories': status.categories.join(', '),
      'API Calls This Minute': this.apiCallCount,
      'Can Make API Call': this.canMakeApiCall()
    });
  }

  /**
   * Generate cache key for search queries
   */
  generateSearchCacheKey(query, options = {}) {
    const normalizedQuery = query.toLowerCase().trim();
    const optionsString = JSON.stringify(options, Object.keys(options).sort());
    return `${normalizedQuery}:${optionsString}`;
  }

  /**
   * Get cached search results
   */
  getCachedSearchResults(query, options = {}) {
    const cacheKey = this.generateSearchCacheKey(query, options);
    const cached = this.searchCache.get(cacheKey);
    
    if (!cached) return null;
    
    // Check if cache is expired
    const isExpired = Date.now() - cached.timestamp > this.SEARCH_CACHE_DURATION;
    if (isExpired) {
      this.searchCache.delete(cacheKey);
      return null;
    }
    
    console.log(`✅ Using cached search results for: "${query}"`);
    return cached.results;
  }

  /**
   * Cache search results with storage management
   */
  async cacheSearchResults(query, options, results) {
    try {
      const cacheKey = this.generateSearchCacheKey(query, options);
      
      this.searchCache.set(cacheKey, {
        results: results,
        timestamp: Date.now(),
        query: query
      });
      
      // Reduced cache size to prevent storage issues (30 instead of 50)
      if (this.searchCache.size > 30) {
        const entries = Array.from(this.searchCache.entries());
        // Sort by timestamp and keep the newest 25
        entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
        
        this.searchCache.clear();
        entries.slice(0, 25).forEach(([key, value]) => {
          this.searchCache.set(key, value);
        });
      }
      
      // Save to persistent storage with error handling
      await this.saveToStorage();
      console.log(`💾 Cached search results for: "${query}"`);
      
    } catch (error) {
      console.error(`Error caching search results for "${query}":`, error);
      
      // If storage is full, clear search cache and retry
      if (error.message.includes('SQLITE_FULL') || error.code === 13) {
        console.log('🧹 Clearing search cache due to storage full');
        this.searchCache.clear();
        this.searchCacheAccess.clear();
      }
    }
  }

  /**
   * Cache similar recipes for a specific recipe with storage management
   * @param {string} cacheKey - Cache key for the similar recipes
   * @param {Array} recipes - Array of similar recipes to cache
   */
  async cacheSimilarRecipes(cacheKey, recipes) {
    try {
      const cacheEntry = {
        recipes: recipes,
        timestamp: Date.now(),
        ttl: this.SIMILAR_RECIPES_CACHE_DURATION
      };

      this.similarRecipesCache.set(cacheKey, cacheEntry);
      
      // Enforce size limit to prevent storage issues
      if (this.similarRecipesCache.size > this.MAX_SIMILAR_CACHE_SIZE) {
        const oldestKeys = this.getLRUKeys(
          this.similarCacheAccess, 
          this.similarRecipesCache.size - this.MAX_SIMILAR_CACHE_SIZE
        );
        oldestKeys.forEach(key => {
          this.similarRecipesCache.delete(key);
          this.similarCacheAccess.delete(key);
        });
      }

      // Save to persistent storage with error handling
      await this.saveToStorage();
      console.log(`✅ Cached ${recipes.length} similar recipes with key: ${cacheKey}`);
      
    } catch (error) {
      console.error('Error caching similar recipes:', error);
      
      // If storage is full, clear similar recipes cache
      if (error.message.includes('SQLITE_FULL') || error.code === 13) {
        console.log('🧹 Clearing similar recipes cache due to storage full');
        this.similarRecipesCache.clear();
        this.similarCacheAccess.clear();
        
        // Try to save just the new entry
        try {
          this.similarRecipesCache.set(cacheKey, {
            recipes: recipes.slice(0, 5), // Keep only 5 recipes
            timestamp: Date.now(),
            ttl: this.SIMILAR_RECIPES_CACHE_DURATION
          });
          await this.saveToStorage();
        } catch (retryError) {
          console.error('Failed to save even reduced similar recipes:', retryError);
        }
      }
    }
  }

  /**
   * Get cached similar recipes with production optimizations
   * @param {string} cacheKey - Cache key to look up
   * @returns {Array|null} Cached similar recipes or null if not found/expired
   */
  async getCachedSimilarRecipes(cacheKey) {
    try {
      const startTime = Date.now();
      const cacheEntry = this.similarRecipesCache.get(cacheKey);
      
      if (!cacheEntry) {
        // Track cache miss
        this.trackCacheMiss('similar');
        return null;
      }

      const now = Date.now();
      const age = now - cacheEntry.timestamp;
      
      if (age > cacheEntry.ttl) {
        // Expired entry - remove and track miss
        this.similarRecipesCache.delete(cacheKey);
        this.similarCacheAccess.delete(cacheKey);
        this.trackCacheMiss('similar');
        
        // Async cleanup without blocking
        this.cleanupExpiredEntry('similar', cacheKey);
        
        return null;
      }

      // Track cache hit and access for LRU
      this.updateCacheAccess('similar', cacheKey);
      this.trackCacheHit('similar', Date.now() - startTime);
      
      console.log(`✅ Cache hit: ${cacheKey} (${cacheEntry.recipes.length} recipes, age: ${Math.round(age / (60 * 60 * 1000))}h)`);
      return cacheEntry.recipes;
    } catch (error) {
      console.error('Error getting cached similar recipes:', error);
      this.trackCacheMiss('similar');
      return null;
    }
  }

  /**
   * Clear similar recipes cache
   */
  async clearSimilarRecipesCache() {
    try {
      this.similarRecipesCache.clear();
      await AsyncStorage.removeItem(this.STORAGE_KEYS.SIMILAR_RECIPES_CACHE);
      console.log('✅ Similar recipes cache cleared');
    } catch (error) {
      console.error('Error clearing similar recipes cache:', error);
    }
  }

  /**
   * Clean expired similar recipes from cache
   */
  async cleanExpiredSimilarRecipes() {
    try {
      const now = Date.now();
      let removedCount = 0;

      for (const [key, entry] of this.similarRecipesCache.entries()) {
        const age = now - entry.timestamp;
        if (age > entry.ttl) {
          this.similarRecipesCache.delete(key);
          removedCount++;
        }
      }

      if (removedCount > 0) {
        // Update persistent storage
        const similarRecipesCacheArray = Array.from(this.similarRecipesCache.entries());
        await AsyncStorage.setItem(
          this.STORAGE_KEYS.SIMILAR_RECIPES_CACHE, 
          JSON.stringify(similarRecipesCacheArray)
        );
        
        console.log(`🧹 Cleaned ${removedCount} expired similar recipe cache entries`);
      }
    } catch (error) {
      console.error('Error cleaning expired similar recipes:', error);
    }
  }

  /**
   * Get API usage statistics
   */
  getApiUsageStats() {
    const now = Date.now();
    const timeSinceLastCall = this.lastApiCallTime ? now - this.lastApiCallTime : 0;
    const secondsUntilReset = timeSinceLastCall < 60000 ? Math.ceil((60000 - timeSinceLastCall) / 1000) : 0;
    
    return {
      apiCallsThisMinute: this.apiCallCount,
      canMakeApiCall: this.canMakeApiCall(),
      secondsUntilReset: secondsUntilReset,
      rateLimit: this.API_CALL_LIMIT,
      monthlyLimit: this.MONTHLY_LIMIT,
      cacheDurationDays: this.CACHE_DURATION / (24 * 60 * 60 * 1000),
      searchCacheSize: this.searchCache.size,
      searchCacheDurationHours: this.SEARCH_CACHE_DURATION / (60 * 60 * 1000),
      similarRecipesCacheSize: this.similarRecipesCache.size,
      similarRecipesCacheDurationHours: this.SIMILAR_RECIPES_CACHE_DURATION / (60 * 60 * 1000)
    };
  }
}

// Export singleton instance
export default new RecipeCacheService();