import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';

export default function ProfileTabs({ activeTab, onTabChange }) {
  const tabs = [
    { id: 'scheduled', label: 'Scheduled', icon: 'calendar-outline' },
    { id: 'favorites', label: 'Favorites', icon: 'heart-outline' },
    { id: 'history', label: 'History', icon: 'time-outline' },
  ];

  return (
    <View style={styles.tabsContainer}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.id}
          style={[
            styles.tabItem,
            activeTab === tab.id && styles.activeTabItem,
          ]}
          onPress={() => onTabChange(tab.id)}
        >
          <View style={styles.tabContent}>
            <Ionicons
              name={tab.icon}
              size={wp('6%')}
              color={activeTab === tab.id ? '#81A969' : '#999'}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === tab.id && styles.activeTabText,
              ]}
            >
              {tab.label}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('2%'),
    backgroundColor: '#F8F9FA',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: hp('2%'),
    paddingHorizontal: wp('2%'),
    marginHorizontal: wp('1%'),
    backgroundColor: '#fff',
    borderRadius: wp('5%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 6,
  },
  activeTabItem: {
    backgroundColor: '#E8F5E9',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: wp('3%'),
    color: '#999',
    marginTop: hp('0.5%'),
  },
  activeTabText: {
    color: '#81A969',
    fontWeight: '600',
  },
});
