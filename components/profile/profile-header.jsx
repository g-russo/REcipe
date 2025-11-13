import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';

export default function ProfileHeader({ profileData }) {
  return (
    <View style={styles.profileContainer}>
      <View style={styles.profileSection}>
        <View style={styles.profileImage}>
          <Text style={styles.profileInitial}>
            {profileData.name.charAt(0).toUpperCase()}
          </Text>
        </View>

        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{profileData.name}</Text>
          <Text style={styles.profileEmail}>{profileData.email}</Text>
        </View>

        <TouchableOpacity style={styles.editButton}>
          <Ionicons name="pencil" size={wp('4%')} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  profileContainer: {
    paddingHorizontal: wp('4%'),
    paddingTop: hp('2%'),
    paddingBottom: hp('2.5%'),
    backgroundColor: '#F8F9FA',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp('2.5%'),
    paddingHorizontal: wp('4%'),
    backgroundColor: '#fff',
    borderRadius: wp('5%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
  },
  profileImage: {
    width: wp('15%'),
    height: wp('15%'),
    borderRadius: wp('7.5%'),
    backgroundColor: '#D3D3D3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitial: {
    fontSize: wp('6%'),
    fontWeight: '500',
    color: '#888',
  },
  profileInfo: {
    flex: 1,
    marginLeft: wp('3%'),
    justifyContent: 'center',
  },
  profileName: {
    fontSize: wp('5%'),
    fontWeight: '600',
    color: '#000',
    marginBottom: hp('0.3%'),
  },
  profileEmail: {
    fontSize: wp('3.2%'),
    color: '#666',
  },
  editButton: {
    backgroundColor: '#81A969',
    width: wp('10%'),
    height: wp('10%'),
    borderRadius: wp('2%'),
    justifyContent: 'center',
    alignItems: 'center',
  },
});
