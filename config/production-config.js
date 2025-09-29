// Production Configuration for Recipe Cache System
// This file contains environment-specific settings for optimal production performance

const PRODUCTION_CONFIG = {
  // Environment Detection
  isDevelopment: __DEV__ || false,
  isProduction: !__DEV__,
  
  // Cache Size Limits (Production vs Development)
  CACHE_LIMITS: {
    development: {
      MAX_SEARCH_CACHE_SIZE: 50,
      MAX_SIMILAR_CACHE_SIZE: 100,
      PRELOAD_BATCH_SIZE: 3,
      MEMORY_WARNING_THRESHOLD: 20 * 1024 * 1024, // 20MB
    },
    production: {
      MAX_SEARCH_CACHE_SIZE: 200,
      MAX_SIMILAR_CACHE_SIZE: 500,
      PRELOAD_BATCH_SIZE: 10,
      MEMORY_WARNING_THRESHOLD: 100 * 1024 * 1024, // 100MB
    }
  },
  
  // Cache Durations (Optimized for Production)
  CACHE_DURATIONS: {
    development: {
      POPULAR_RECIPES: 2 * 60 * 60 * 1000, // 2 hours for testing
      SEARCH_RESULTS: 30 * 60 * 1000, // 30 minutes for testing
      SIMILAR_RECIPES: 1 * 60 * 60 * 1000, // 1 hour for testing
      CLEANUP_INTERVAL: 5 * 60 * 1000, // 5 minutes cleanup
    },
    production: {
      POPULAR_RECIPES: 7 * 24 * 60 * 60 * 1000, // 7 days
      SEARCH_RESULTS: 4 * 60 * 60 * 1000, // 4 hours (extended for production)
      SIMILAR_RECIPES: 48 * 60 * 60 * 1000, // 48 hours (extended for production)
      CLEANUP_INTERVAL: 30 * 60 * 1000, // 30 minutes cleanup
    }
  },
  
  // API Rate Limiting (Conservative for Production)
  API_LIMITS: {
    development: {
      CALLS_PER_MINUTE: 15, // More lenient for testing
      MONTHLY_LIMIT: 10000,
      BURST_LIMIT: 20, // Allow brief bursts
    },
    production: {
      CALLS_PER_MINUTE: 8, // Conservative for production
      MONTHLY_LIMIT: 10000,
      BURST_LIMIT: 12, // Controlled bursts
    }
  },
  
  // Background Processing
  BACKGROUND_PROCESSING: {
    development: {
      PRELOAD_ENABLED: false, // Disable for faster dev cycles
      BACKGROUND_REFRESH: false,
      AGGRESSIVE_OPTIMIZATION: false,
    },
    production: {
      PRELOAD_ENABLED: true,
      BACKGROUND_REFRESH: true,
      AGGRESSIVE_OPTIMIZATION: true,
    }
  },
  
  // Monitoring and Logging
  MONITORING: {
    development: {
      DETAILED_LOGGING: true,
      PERFORMANCE_TRACKING: true,
      MEMORY_MONITORING: true,
      CACHE_ANALYTICS: false, // Skip analytics in dev
    },
    production: {
      DETAILED_LOGGING: false, // Reduce log noise
      PERFORMANCE_TRACKING: true,
      MEMORY_MONITORING: true,
      CACHE_ANALYTICS: true,
      ERROR_REPORTING: true,
    }
  },
  
  // Storage Optimization
  STORAGE: {
    development: {
      COMPRESS_DATA: false, // Raw data for debugging
      BACKUP_ENABLED: false,
      MIGRATION_ENABLED: false,
    },
    production: {
      COMPRESS_DATA: true, // Save storage space
      BACKUP_ENABLED: true,
      MIGRATION_ENABLED: true,
    }
  },
  
  // Performance Thresholds
  PERFORMANCE_THRESHOLDS: {
    development: {
      MAX_RESPONSE_TIME: 5000, // 5 seconds
      MIN_HIT_RATE: 50, // 50%
      MAX_MEMORY_USAGE: 50 * 1024 * 1024, // 50MB
    },
    production: {
      MAX_RESPONSE_TIME: 1000, // 1 second
      MIN_HIT_RATE: 80, // 80%
      MAX_MEMORY_USAGE: 200 * 1024 * 1024, // 200MB
    }
  }
};

/**
 * Get environment-specific configuration
 * @param {string} environment - 'development' or 'production'
 * @returns {Object} Configuration object
 */
export function getConfig(environment = null) {
  const env = environment || (PRODUCTION_CONFIG.isDevelopment ? 'development' : 'production');
  
  const config = {
    environment: env,
    isDevelopment: env === 'development',
    isProduction: env === 'production',
    
    // Merge all configurations based on environment
    ...PRODUCTION_CONFIG.CACHE_LIMITS[env],
    ...PRODUCTION_CONFIG.CACHE_DURATIONS[env],
    ...PRODUCTION_CONFIG.API_LIMITS[env],
    ...PRODUCTION_CONFIG.BACKGROUND_PROCESSING[env],
    ...PRODUCTION_CONFIG.MONITORING[env],
    ...PRODUCTION_CONFIG.STORAGE[env],
    ...PRODUCTION_CONFIG.PERFORMANCE_THRESHOLDS[env],
  };
  
  return config;
}

/**
 * Production-specific optimizations
 */
export const PRODUCTION_OPTIMIZATIONS = {
  // Cache Key Optimization
  USE_SHORT_CACHE_KEYS: true,
  
  // Memory Management
  ENABLE_MEMORY_PRESSURE_DETECTION: true,
  AUTO_CLEANUP_ON_LOW_MEMORY: true,
  
  // Network Optimization
  BATCH_API_CALLS: true,
  USE_REQUEST_DEDUPLICATION: true,
  ENABLE_OFFLINE_FALLBACKS: true,
  
  // User Experience
  PRELOAD_CRITICAL_DATA: true,
  STALE_WHILE_REVALIDATE: true,
  INSTANT_LOADING_INDICATORS: false, // Cache should be instant
  
  // Error Handling
  GRACEFUL_DEGRADATION: true,
  AUTOMATIC_RETRY: true,
  FALLBACK_TO_OLDER_CACHE: true,
};

/**
 * Production Health Checks
 */
export const HEALTH_CHECKS = {
  MEMORY_USAGE: {
    WARNING_THRESHOLD: 100 * 1024 * 1024, // 100MB
    CRITICAL_THRESHOLD: 200 * 1024 * 1024, // 200MB
  },
  
  CACHE_PERFORMANCE: {
    MIN_HIT_RATE: 75, // 75% minimum
    MAX_RESPONSE_TIME: 500, // 500ms maximum
  },
  
  API_USAGE: {
    DAILY_LIMIT_WARNING: 8000, // 80% of monthly limit
    RATE_LIMIT_WARNING: 0.8, // 80% of rate limit
  },
  
  CACHE_HEALTH: {
    MAX_EXPIRED_ENTRIES: 50,
    MAX_CACHE_AGE_HOURS: 168, // 1 week
  }
};

export default PRODUCTION_CONFIG;