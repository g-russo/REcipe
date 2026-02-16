import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';

/**
 * Pantry Header Component
 * Displays the pantry header with search and archive buttons
 */
const PantryHeader = ({ onSearchPress, onArchivePress, archivedCount = 0 }) => {
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Pantry</Text>
      <View style={styles.headerButtons}>
        <TouchableOpacity onPress={onArchivePress} style={styles.archiveButton}>
          <Ionicons name="archive-outline" size={wp('6%')} color="#333" />
          {archivedCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{archivedCount}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={onSearchPress} style={styles.searchButton}>
          <Ionicons name="search-outline" size={wp('6%')} color="#333" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp('5%'),
    paddingTop: hp('7%'),
    paddingBottom: hp('2%'),
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: wp('7.5%'),
    fontWeight: 'bold',
    color: '#000',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  archiveButton: {
    padding: wp('2%'),
    position: 'relative',
  },
  searchButton: {
    padding: wp('2%'),
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#F44336',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default PantryHeader;
