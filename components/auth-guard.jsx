import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useCustomAuth } from '../hooks/use-custom-auth';

/**
 * AuthGuard - Protects routes and redirects unauthenticated users
 * 
 * Usage: Wrap your protected screen content with this component
 * 
 * Example:
 * ```jsx
 * export default function ProtectedScreen() {
 *   return (
 *     <AuthGuard>
 *       <YourScreenContent />
 *     </AuthGuard>
 *   );
 * }
 * ```
 */
export default function AuthGuard({ children }) {
  const { user, loading } = useCustomAuth();
  const router = useRouter();
  const segments = useSegments();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    console.log('🔐 AuthGuard state:', { 
      loading, 
      isChecking, 
      hasUser: !!user, 
      email: user?.email,
      path: `/${segments.join('/')}`
    });
  }, [loading, isChecking, user, segments]);

  useEffect(() => {
    const checkAuth = async () => {
      // Wait for auth to finish loading
      if (loading) {
        console.log('⏳ AuthGuard: Still loading auth...');
        return;
      }

      const currentPath = `/${segments.join('/')}`;
      console.log('🔒 AuthGuard checking:', { 
        currentPath, 
        hasUser: !!user,
        userEmail: user?.email 
      });

      // Public routes that don't require authentication
      const publicRoutes = [
        '/',
        '/index',
        '/signin',
        '/signup',
        '/forgot-password',
        '/otp-verification',
        '/reset-password-otp',
        '/new-password',
        '/force-password-change'
      ];

      const isPublicRoute = publicRoutes.some(route => currentPath === route);

      // If not authenticated and not on a public route, redirect to signin
      if (!user && !isPublicRoute) {
        console.log('❌ Not authenticated, redirecting to signin');
        router.replace('/signin');
        return;
      }

      // If authenticated and on signin/signup, redirect to home
      if (user && (currentPath === '/signin' || currentPath === '/signup' || currentPath === '/index' || currentPath === '/')) {
        console.log('✅ Already authenticated, redirecting to home');
        router.replace('/home');
        return;
      }

      console.log('✅ AuthGuard: Auth check complete, rendering children');
      setIsChecking(false);
    };

    checkAuth();
  }, [user, loading, segments]);

  // Show loading spinner while checking auth
  if (loading || isChecking) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  // If user is not authenticated, don't render children (will redirect)
  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  // User is authenticated, render children
  return <>{children}</>;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
});
