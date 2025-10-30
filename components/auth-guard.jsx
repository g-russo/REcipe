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

  useEffect(() => {
    // Wait for auth to finish loading
    if (loading) {
      return;
    }

    const currentPath = `/${segments.join('/')}`;

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
      router.replace('/signin');
      return;
    }

    // If authenticated and on signin/signup, redirect to home
    if (user && (currentPath === '/signin' || currentPath === '/signup' || currentPath === '/index' || currentPath === '/')) {
      router.replace('/home');
      return;
    }
  }, [user, loading, segments]);

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  // User is authenticated or on public route, render children
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
