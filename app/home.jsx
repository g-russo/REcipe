import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert
} from 'react-native';
import { useCustomAuth } from '../hooks/use-custom-auth';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import AuthGuard from '../components/AuthGuard';

const Home = () => {
  const { user, customUserData, signOut, loading } = useCustomAuth();
  const [userName, setUserName] = useState('');
  const [timeoutTriggered, setTimeoutTriggered] = useState(false);

  useEffect(() => {
    // Set user name from custom user data or email
    if (customUserData?.userName) {
      setUserName(customUserData.userName);
    } else if (user?.email) {
      // Extract name from email before @ symbol
      setUserName(user.email.split('@')[0]);
    }
  }, [user, customUserData]);

  useEffect(() => {
    // Set up 5-second timeout for loading state
    let timeoutId;
    
    if (loading && !timeoutTriggered) {
      console.log('⏰ Starting 5-second timeout for home loading...');
      
      timeoutId = setTimeout(async () => {
        console.log('⏰ 5-second timeout reached, checking session and reloading app...');
        setTimeoutTriggered(true);
        
        try {
          // Reload app by checking session directly
          console.log('🔄 Reloading app - checking for active session...');
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error('❌ Error checking session:', error);
            console.log('🏠 Redirecting to index due to session error');
            router.replace('/');
            return;
          }
          
          if (session?.user) {
            console.log('✅ Active session found after timeout, staying on home page');
            console.log('👤 User found:', session.user.email);
            // Session exists, force a re-render by clearing timeout flag after a brief moment
            setTimeout(() => {
              setTimeoutTriggered(false);
            }, 100);
          } else {
            console.log('❌ No active session found after timeout');
            console.log('🏠 Redirecting to index page');
            router.replace('/');
          }
        } catch (sessionError) {
          console.error('❌ Session check failed:', sessionError);
          console.log('🏠 Redirecting to index due to session check failure');
          router.replace('/');
        }
      }, 5000); // 5 seconds
    }
    
    // Clear timeout if loading completes before timeout
    if (!loading && timeoutId) {
      console.log('✅ Loading completed before timeout, clearing timeout');
      clearTimeout(timeoutId);
    }
    
    // Cleanup timeout on unmount
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [loading, timeoutTriggered]);

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Sign Out',
          onPress: async () => {
            try {
              await signOut();
              router.replace('/signin');
            } catch (error) {
              console.error('Sign out error:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          }
        }
      ]
    );
  };

  const menuItems = [
    { title: 'My Recipes', subtitle: 'View your saved recipes', action: () => console.log('My Recipes') },
    { title: 'Discover', subtitle: 'Find new recipes', action: () => router.push('/recipe-search') },
    { title: 'Favorites', subtitle: 'Your favorite recipes', action: () => router.push('/saved-recipes') },
    { title: 'Shopping List', subtitle: 'Manage ingredients', action: () => console.log('Shopping List') },
    { title: 'Pantry', subtitle: 'View your ingredients', action: () => router.push('/pantry') },
    { title: 'Categories', subtitle: 'Browse by category', action: () => console.log('Categories') },
    { title: 'Profile', subtitle: 'Manage your account', action: () => router.push('/profile') },
  ];

  if (loading && !timeoutTriggered) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
          <Text style={styles.timeoutHintText}>
            Checking your session... (timeout in 5 seconds)
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // If timeout was triggered but we're still here, show a message while session check completes
  if (timeoutTriggered && loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Reloading app...</Text>
          <Text style={styles.timeoutHintText}>
            Checking session and redirecting...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <AuthGuard>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        
        {/* Header */}
        <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Welcome back!</Text>
          <Text style={styles.userNameText}>{userName || 'Chef'}</Text>
        </View>
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* App Title */}
        <View style={styles.titleContainer}>
          <Text style={styles.appTitle}>REcipe</Text>
          
        </View>

        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Recipes</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Favorites</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Collections</Text>
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.menuContainer}>
          <Text style={styles.sectionTitle}>Explore</Text>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={item.action}
              activeOpacity={0.7}
            >
              <View style={styles.menuItemContent}>
                <Text style={styles.menuItemTitle}>{item.title}</Text>
                <Text style={styles.menuItemSubtitle}>{item.subtitle}</Text>
              </View>
              <Text style={styles.menuItemArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>REcipe v1.0</Text>
          <Text style={styles.footerSubtext}>Made with ❤️ for food lovers</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
    </AuthGuard>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: '#666',
  },
  timeoutHintText: {
    fontSize: 14,
    color: '#999',
    marginTop: 10,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  welcomeText: {
    fontSize: 16,
    color: '#666',
  },
  userNameText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 2,
  },
  signOutButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#ff6b6b',
    borderRadius: 20,
  },
  signOutText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  titleContainer: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  appTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#2c3e50',
    letterSpacing: 1,
  },
  appSubtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    marginTop: 5,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  statCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  statLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 5,
  },
  menuContainer: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
  },
  menuItem: {
    backgroundColor: '#fff',
    paddingVertical: 15,
    paddingHorizontal: 20,
    marginBottom: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
  },
  menuItemSubtitle: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 2,
  },
  menuItemArrow: {
    fontSize: 24,
    color: '#bdc3c7',
    fontWeight: '300',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
    marginTop: 20,
  },
  footerText: {
    fontSize: 14,
    color: '#95a5a6',
    fontWeight: '600',
  },
  footerSubtext: {
    fontSize: 12,
    color: '#bdc3c7',
    marginTop: 5,
  },
});

export default Home;
