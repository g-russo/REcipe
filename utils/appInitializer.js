import RecipeCacheService from '../services/recipeCacheService';
import PerformanceMonitor from './performanceMonitor';

/**
 * Initialize app-wide services and caches
 * Call this early in your app startup (in App.js)
 */
export const initializeAppServices = async () => {
  try {
    console.log('🚀 Initializing app services...');
    PerformanceMonitor.startTiming('App Services Initialization');
    
    // Initialize recipe cache in background
    const cachePromise = RecipeCacheService.initializeCache()
      .then(() => {
        console.log('✅ Recipe cache initialized');
      })
      .catch(error => {
        console.error('❌ Recipe cache initialization failed:', error);
      });
    
    // Initialize other services in parallel
    const initPromises = [
      cachePromise,
      // Add other service initializations here
      // initializeAnalytics(),
      // initializeCrashReporting(),
      // initializeNotifications(),
    ];

    await Promise.allSettled(initPromises);
    
    PerformanceMonitor.endTiming('App Services Initialization');
    PerformanceMonitor.logMemoryUsage('after app initialization');
    
    console.log('✅ All app services initialized');
    
  } catch (error) {
    console.error('❌ Error initializing app services:', error);
    PerformanceMonitor.endTiming('App Services Initialization');
  }
};

/**
 * Get cache status for debugging
 */
export const getAppCacheStatus = () => {
  return {
    recipeCache: RecipeCacheService.getCacheStatus(),
    performance: {
      activeTimings: PerformanceMonitor.getActiveTimings(),
      isMonitoringEnabled: PerformanceMonitor.isEnabled
    },
    // Add other cache statuses here
  };
};

/**
 * Initialize performance monitoring
 */
export const initializePerformanceMonitoring = () => {
  // Enable performance monitoring in development
  PerformanceMonitor.setEnabled(__DEV__);
  
  if (__DEV__) {
    console.log('📊 Performance monitoring enabled');
    PerformanceMonitor.logMemoryUsage('app startup');
  }
};