import React from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const HowToUseModal = ({ visible, onClose }) => {
  const steps = [
    {
      icon: 'camera',
      title: 'Scan Your Food',
      description: 'Use your camera to identify and add items to your inventory instantly. Our AI recognizes thousands of food items with over 90% accuracy.',
      details: 'Simply tap the scan button, point your camera at the food item, and let our AI do the work. You can also manually add items if needed.',
    },
    {
      icon: 'time',
      title: 'Track Expiry Dates',
      description: 'Receive timely notifications before your food expires. Never waste food again!',
      details: 'Set expiration dates for each item. REcipe will notify you 3 days before, 1 day before, and on the expiration day.',
    },
    {
      icon: 'restaurant',
      title: 'Get Recipe Ideas',
      description: 'Discover delicious recipes based on what you have available in your pantry.',
      details: 'Select ingredients from your pantry and let our AI generate custom recipes or browse curated recipes from Edamam.',
    },
    {
      icon: 'folder',
      title: 'Organize with Groups',
      description: 'Create custom groups to organize your pantry items by category, location, or any system that works for you.',
      details: 'Tap "Create Group" to organize items like "Spices", "Baking", "Refrigerator", or any custom category.',
    },
    {
      icon: 'heart',
      title: 'Save Favorite Recipes',
      description: 'Bookmark your favorite recipes for quick access anytime. Build your personal recipe collection.',
      details: 'Tap the heart icon on any recipe to add it to your favorites. Access them anytime from your profile.',
    },
    {
      icon: 'calendar',
      title: 'Schedule Meals',
      description: 'Plan your meals in advance by scheduling recipes for specific dates.',
      details: 'Choose a recipe and set a date to cook it. REcipe will remind you and help you prepare.',
    },
    {
      icon: 'swap-horizontal',
      title: 'Smart Substitutions',
      description: 'Missing an ingredient? REcipe suggests smart substitutions based on what you have.',
      details: 'Our AI analyzes your pantry and recommends suitable ingredient alternatives for any recipe.',
    },
    {
      icon: 'checkmark-done',
      title: 'Track Cooking History',
      description: 'Keep a record of all the recipes you\'ve cooked. Build your culinary journey!',
      details: 'Mark recipes as completed to track your cooking progress and revisit successful dishes.',
    },
    {
      icon: 'search',
      title: 'Advanced Search & Filters',
      description: 'Find exactly what you need with powerful search and filtering options.',
      details: 'Search by name, category, expiry status, or any combination. Filter items to find what you need quickly.',
    },
    {
      icon: 'notifications',
      title: 'Stay Notified',
      description: 'Receive smart notifications about expiring items, scheduled meals, and recipe suggestions.',
      details: 'Customize notification preferences in settings. Control when and how you want to be reminded.',
    },
  ];

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={visible}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>How to Use</Text>
          <View style={styles.placeholderRight} />
        </View>

        {/* Subtitle */}
        <View style={styles.subtitleContainer}>
          <Text style={styles.subtitle}>
            Get started with REcipe in simple steps
          </Text>
        </View>

        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          {steps.map((step, index) => (
            <View key={index} style={styles.stepCard}>
              <View style={styles.stepHeader}>
                <View style={styles.iconCircle}>
                  <Ionicons name={step.icon} size={28} color="#8BC34A" />
                </View>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{index + 1}</Text>
                </View>
              </View>
              
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepDescription}>{step.description}</Text>
                <View style={styles.detailsBox}>
                  <Ionicons name="bulb" size={16} color="#FFC107" />
                  <Text style={styles.stepDetails}>{step.details}</Text>
                </View>
              </View>
            </View>
          ))}

          <View style={styles.footer}>
            <View style={styles.footerCard}>
              <Ionicons name="rocket" size={32} color="#8BC34A" />
              <Text style={styles.footerTitle}>Ready to get started?</Text>
              <Text style={styles.footerText}>
                Start building your pantry and discovering amazing recipes today!
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholderRight: {
    width: 40,
  },
  subtitleContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#f9f9f9',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  stepCard: {
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F1F8E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumber: {
    marginLeft: 'auto',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#8BC34A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  stepContent: {
    marginTop: 8,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  detailsBox: {
    flexDirection: 'row',
    backgroundColor: '#FFFDE7',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#FFC107',
  },
  stepDetails: {
    flex: 1,
    fontSize: 13,
    color: '#555',
    lineHeight: 18,
    marginLeft: 8,
  },
  footer: {
    padding: 16,
    marginTop: 16,
    marginBottom: 40,
  },
  footerCard: {
    backgroundColor: '#F1F8E9',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  footerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginTop: 12,
    marginBottom: 8,
  },
  footerText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default HowToUseModal;
