import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';

export default function ProfileActions({ onFAQPress, onHowToUsePress, onTermsPress }) {
  const actions = [
    { icon: 'help-circle-outline', label: 'FAQs', onPress: onFAQPress },
    { icon: 'information-circle-outline', label: 'How to Use', onPress: onHowToUsePress },
    { icon: 'document-text-outline', label: 'Terms & Policies', onPress: onTermsPress },
  ];

  return (
    <View style={styles.actionsContainer}>
      <View style={styles.actionsSection}>
        {actions.map((action, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.actionItem,
              index < actions.length - 1 && styles.actionItemBorder
            ]}
          >
            <View style={styles.actionLeft}>
              <Ionicons name={action.icon} size={wp('5.5%')} color="#333" />
              <Text style={styles.actionText}>{action.label}</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={wp('5%')}
              color="#ccc"
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actionsContainer: {
    paddingHorizontal: wp('4%'),
    paddingTop: hp('2%'),
    paddingBottom: hp('1%'),
    backgroundColor: '#F8F9FA',
  },
  actionsSection: {
    backgroundColor: '#fff',
    borderRadius: wp('5%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
    paddingHorizontal: wp('4%'),
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: hp('2%'),
  },
  actionItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  actionText: {
    fontSize: wp('4%'),
    color: '#333',
    marginLeft: wp('3%'),
  },
});
