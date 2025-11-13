import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_SMALL_SCREEN = SCREEN_WIDTH < 375;

/**
 * Pantry Header Component
 * Displays the pantry header with search and user profile icon
 */
const PantryHeader = ({ onSearchPress }) => {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <View style={styles.profileIconContainer}>
          <Ionicons name="person-outline" size={18} color="#777" />
        </View>
        <Text style={styles.headerTitle}>Your Pantry</Text>
      </View>
      <View style={styles.headerRight}>
        <TouchableOpacity 
          style={styles.iconButton}
          onPress={onSearchPress}
        >
          <Ionicons name="search-outline" size={22} color="#555" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: IS_SMALL_SCREEN ? 15 : 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  headerTitle: {
    fontSize: IS_SMALL_SCREEN ? 18 : 20,
    fontWeight: '600',
    color: '#333',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 8,
  },
});

export default PantryHeader;
