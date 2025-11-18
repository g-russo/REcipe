import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';

/**
 * Pantry Header Component
 * Displays the pantry header with search
 */
const PantryHeader = ({ onSearchPress }) => {
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Pantry</Text>
      <TouchableOpacity onPress={onSearchPress} style={styles.searchButton}>
        <Ionicons name="search-outline" size={wp('6%')} color="#333" />
      </TouchableOpacity>
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
  searchButton: {
    padding: wp('2%'),
  },
});

export default PantryHeader;
