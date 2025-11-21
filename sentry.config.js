/**
 * Sentry Configuration for REcipe App
 * Provides crash reporting and performance monitoring
 */

import * as Sentry from '@sentry/react-native';

// Initialize Sentry
Sentry.init({
  // Replace with your actual DSN from Sentry dashboard
  dsn: process.env.SENTRY_DSN || 'https://your-dsn@sentry.io/your-project-id',
  
  // Enable performance monitoring
  enableAutoSessionTracking: true,
  
  // Set sample rate for performance monitoring (1.0 = 100%)
  tracesSampleRate: 1.0,
  
  // Set sample rate for session replay (0.1 = 10%)
  replaysSessionSampleRate: 0.1,
  
  // Set sample rate for session replay on errors (1.0 = 100%)
  replaysOnErrorSampleRate: 1.0,
  
  // Enable native crash handling
  enableNative: true,
  
  // Enable auto breadcrumbs
  enableAutoPerformanceTracing: true,
  
  // Environment
  environment: __DEV__ ? 'development' : 'production',
  
  // Release version (from package.json or app.json)
  release: 'recipe-app@1.0.0',
  
  // Distribution (build number)
  dist: '1',
  
  // Integrations
  integrations: [
    new Sentry.ReactNativeTracing({
      // Routing instrumentation for React Navigation
      routingInstrumentation: new Sentry.ReactNavigationInstrumentation(),
      
      // Track slow API calls
      tracingOrigins: ['localhost', 'api.edamam.com', 'api.openai.com', /^\//],
      
      // Enable idle transaction tracking
      idleTimeout: 1000,
    }),
  ],
  
  // Before send hook - filter or modify events
  beforeSend(event, hint) {
    // Don't send events in development (optional)
    if (__DEV__) {
      console.log('Sentry Event (dev):', event);
      return null; // Don't send to Sentry in dev
    }
    
    // Filter out specific errors (optional)
    if (event.exception) {
      const error = hint.originalException;
      // Don't report expected errors
      if (error && error.message && error.message.includes('User cancelled')) {
        return null;
      }
    }
    
    return event;
  },
  
  // Attach user context automatically
  beforeBreadcrumb(breadcrumb, hint) {
    // Filter console logs from breadcrumbs (optional)
    if (breadcrumb.category === 'console') {
      return null;
    }
    return breadcrumb;
  },
});

// Helper function to set user context
export const setSentryUser = (userId, email, username) => {
  Sentry.setUser({
    id: userId,
    email: email,
    username: username,
  });
};

// Helper function to clear user context (on logout)
export const clearSentryUser = () => {
  Sentry.setUser(null);
};

// Helper function to add breadcrumb
export const addSentryBreadcrumb = (message, category = 'user-action', level = 'info') => {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    timestamp: Date.now() / 1000,
  });
};

// Helper function to capture custom error
export const captureError = (error, context = {}) => {
  Sentry.captureException(error, {
    extra: context,
  });
};

// Helper function to capture message
export const captureMessage = (message, level = 'info', context = {}) => {
  Sentry.captureMessage(message, {
    level,
    extra: context,
  });
};

// Helper function to track performance
export const startTransaction = (name, operation = 'navigation') => {
  return Sentry.startTransaction({
    name,
    op: operation,
  });
};

// Export Sentry for direct use
export default Sentry;

/**
 * Usage Examples:
 * 
 * 1. In your App.js or _layout.jsx:
 * ```javascript
 * import './sentry.config';
 * import Sentry from './sentry.config';
 * 
 * function App() {
 *   return <YourApp />;
 * }
 * 
 * export default Sentry.wrap(App);
 * ```
 * 
 * 2. Track user login:
 * ```javascript
 * import { setSentryUser } from './sentry.config';
 * 
 * async function handleLogin(user) {
 *   setSentryUser(user.id, user.email, user.name);
 * }
 * ```
 * 
 * 3. Track custom errors:
 * ```javascript
 * import { captureError } from './sentry.config';
 * 
 * try {
 *   await fetchRecipes();
 * } catch (error) {
 *   captureError(error, { context: 'recipe-search' });
 * }
 * ```
 * 
 * 4. Add breadcrumbs:
 * ```javascript
 * import { addSentryBreadcrumb } from './sentry.config';
 * 
 * addSentryBreadcrumb('User searched for recipes', 'user-action');
 * addSentryBreadcrumb('Recipe added to favorites', 'user-action');
 * ```
 * 
 * 5. Track performance:
 * ```javascript
 * import { startTransaction } from './sentry.config';
 * 
 * const transaction = startTransaction('LoadRecipeDetail', 'screen-load');
 * // ... load recipe data ...
 * transaction.finish();
 * ```
 */
