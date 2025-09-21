/**
 * REcipe App Configuration
 * Centralized configuration for the entire application
 */

export const AppConfig = {
  // App Information
  APP_NAME: 'REcipe',
  APP_VERSION: '1.0.0',
  
  // Performance Settings
  PERFORMANCE: {
    ENABLE_MONITORING: __DEV__, // Enable performance monitoring in development
    CACHE_DURATION: 30 * 60 * 1000, // 30 minutes
    SPLASH_SCREEN_MIN_DURATION: 1000, // Minimum splash screen duration (ms)
    API_TIMEOUT: 10000, // API request timeout (ms)
  },

  // Cache Settings
  CACHE: {
    POPULAR_RECIPES_COUNT: 8,
    RECENT_SEARCHES_LIMIT: 5,
    RECIPE_CACHE_DURATION: 30 * 60 * 1000, // 30 minutes
    IMAGE_CACHE_DURATION: 24 * 60 * 60 * 1000, // 24 hours
  },

  // UI Settings
  UI: {
    THEME: {
      PRIMARY_COLOR: '#4CAF50',
      SECONDARY_COLOR: '#81C784',
      ERROR_COLOR: '#e74c3c',
      WARNING_COLOR: '#f39c12',
      SUCCESS_COLOR: '#27ae60',
      BACKGROUND_COLOR: '#ffffff',
      TEXT_COLOR: '#333333',
    },
    ANIMATIONS: {
      DURATION_SHORT: 200,
      DURATION_MEDIUM: 400,
      DURATION_LONG: 600,
    },
  },

  // API Settings
  API: {
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000, // Base delay for exponential backoff
    PARALLEL_REQUESTS_LIMIT: 5,
  },

  // Features Flags
  FEATURES: {
    ENABLE_ANALYTICS: !__DEV__, // Enable analytics in production
    ENABLE_CRASH_REPORTING: !__DEV__, // Enable crash reporting in production
    ENABLE_OFFLINE_MODE: true,
    ENABLE_PUSH_NOTIFICATIONS: true,
    ENABLE_BIOMETRIC_AUTH: false,
  },

  // Storage Keys
  STORAGE_KEYS: {
    USER_PREFERENCES: 'user_preferences',
    RECENT_SEARCHES: 'recent_searches',
    CACHED_RECIPES: 'cached_recipes',
    APP_STATE: 'app_state',
    ONBOARDING_COMPLETED: 'onboarding_completed',
  },

  // Recipe Categories
  RECIPE_CATEGORIES: [
    { id: 'breakfast', name: 'Breakfast', icon: '🍳' },
    { id: 'lunch', name: 'Lunch', icon: '🥗' },
    { id: 'dinner', name: 'Dinner', icon: '🍽️' },
    { id: 'dessert', name: 'Dessert', icon: '🍰' },
    { id: 'snack', name: 'Snack', icon: '🍿' },
    { id: 'beverage', name: 'Beverage', icon: '🥤' },
  ],

  // Popular Search Terms
  POPULAR_SEARCHES: [
    'chicken breast',
    'pasta carbonara', 
    'chocolate cake',
    'caesar salad',
    'tomato soup',
    'beef stir fry',
    'pancakes',
    'fish tacos'
  ],

  // Development Settings
  DEV: {
    ENABLE_LOGS: true,
    ENABLE_REDUX_DEVTOOLS: true,
    MOCK_API_RESPONSES: false,
    SKIP_SPLASH_SCREEN: false,
  },
};

/**
 * Get configuration value with fallback
 */
export const getConfig = (path, fallback = null) => {
  try {
    const keys = path.split('.');
    let value = AppConfig;
    
    for (const key of keys) {
      value = value[key];
      if (value === undefined) {
        return fallback;
      }
    }
    
    return value;
  } catch (error) {
    console.warn(`Config path "${path}" not found, using fallback:`, fallback);
    return fallback;
  }
};

/**
 * Check if feature is enabled
 */
export const isFeatureEnabled = (featureName) => {
  return getConfig(`FEATURES.${featureName}`, false);
};

/**
 * Get theme colors
 */
export const getTheme = () => {
  return getConfig('UI.THEME', {});
};