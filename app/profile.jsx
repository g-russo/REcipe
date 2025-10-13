import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useCustomAuth } from '../hooks/use-custom-auth';
import styles from '../assets/css/profileStyles';
import AuthGuard from '../components/AuthGuard';

const Profile = () => {
  const { user, customUserData, signOut } = useCustomAuth();
  const [activeTab, setActiveTab] = useState('scheduled');
  const [profileData, setProfileData] = useState({
    name: 'User',
    email: 'user@example.com',
    verified: true
  });

  useEffect(() => {
    // Update profile data if user information is available
    if (user) {
      setProfileData({
        name: customUserData?.userName || user.email?.split('@')[0] || 'User',
        email: user.email || 'No email available',
        verified: user.email_confirmed_at !== null
      });
    }
  }, [user, customUserData]);

  const handleLogout = async () => {
    Alert.alert(
      'Log out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Log out', 
          onPress: async () => {
            try {
              await signOut();
              router.replace('/signin');
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to log out. Please try again.');
            }
          },
          style: 'destructive'
        }
      ]
    );
  };

  const handleBack = () => {
    router.back();
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'scheduled':
        return (
          <View style={styles.tabContent}>
            <View style={styles.emptyStateContainer}>
              <Ionicons name="calendar-outline" size={60} color="#ccc" />
              <Text style={styles.emptyStateText}>No scheduled items</Text>
              <Text style={styles.emptyStateSubText}>
                Items you schedule will appear here
              </Text>
            </View>
          </View>
        );
      case 'favorites':
        return (
          <View style={styles.tabContent}>
            <TouchableOpacity 
              style={styles.savedRecipesButton}
              onPress={() => router.push('/saved-recipes')}
            >
              <View style={styles.savedRecipesIconContainer}>
                <Ionicons name="bookmark" size={24} color="#FF6B6B" />
              </View>
              <View style={styles.savedRecipesTextContainer}>
                <Text style={styles.savedRecipesTitle}>View Saved Recipes</Text>
                <Text style={styles.savedRecipesSubtitle}>
                  See all your favorite recipes from Edamam and SousChef AI
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#ccc" />
            </TouchableOpacity>
          </View>
        );
      case 'history':
        return (
          <View style={styles.tabContent}>
            <View style={styles.emptyStateContainer}>
              <Ionicons name="time-outline" size={60} color="#ccc" />
              <Text style={styles.emptyStateText}>No history</Text>
              <Text style={styles.emptyStateSubText}>
                Your recipe history will appear here
              </Text>
            </View>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <AuthGuard>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={handleBack}
        >
          <Ionicons name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.placeholderRight} />
      </View>
      
      <ScrollView style={styles.scrollView}>
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.profileImageContainer}>
            <View style={styles.profileImage}>
              <Text style={styles.profileInitial}>
                {profileData.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          </View>
          
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profileData.name}</Text>
            <View style={styles.emailContainer}>
              <Text style={styles.profileEmail}>{profileData.email}</Text>
              {profileData.verified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark" size={12} color="#fff" />
                </View>
              )}
            </View>
          </View>
        </View>
        
        {/* Tabs Navigation */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity 
            style={[
              styles.tabItem, 
              activeTab === 'scheduled' && styles.activeTabItem
            ]}
            onPress={() => setActiveTab('scheduled')}
          >
            <Text style={[
              styles.tabText,
              activeTab === 'scheduled' && styles.activeTabText
            ]}>Scheduled</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.tabItem, 
              activeTab === 'favorites' && styles.activeTabItem
            ]}
            onPress={() => setActiveTab('favorites')}
          >
            <Text style={[
              styles.tabText,
              activeTab === 'favorites' && styles.activeTabText
            ]}>Favorites</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.tabItem, 
              activeTab === 'history' && styles.activeTabItem
            ]}
            onPress={() => setActiveTab('history')}
          >
            <Text style={[
              styles.tabText,
              activeTab === 'history' && styles.activeTabText
            ]}>History</Text>
          </TouchableOpacity>
        </View>
        
        {/* Tab Content */}
        {renderTabContent()}
        
        {/* Account Actions */}
        <View style={styles.actionsSection}>
          <TouchableOpacity style={styles.actionItem}>
            <Ionicons name="help-circle-outline" size={22} color="#555" />
            <Text style={styles.actionText}>FAQs</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" style={styles.actionArrow} />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionItem}>
            <Ionicons name="information-circle-outline" size={22} color="#555" />
            <Text style={styles.actionText}>Help Center</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" style={styles.actionArrow} />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionItem}>
            <Ionicons name="document-text-outline" size={22} color="#555" />
            <Text style={styles.actionText}>Terms & Policies</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" style={styles.actionArrow} />
          </TouchableOpacity>
        </View>
        
        {/* Logout Button */}
        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
        
        <Text style={styles.versionText}>Version 1.0.0 (Build 1)</Text>
      </ScrollView>
    </SafeAreaView>
    </AuthGuard>
  );
};

export default Profile;
