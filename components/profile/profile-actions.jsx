import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileActions() {
  const actions = [
    { icon: 'help-circle-outline', label: 'FAQs' },
    { icon: 'information-circle-outline', label: 'Help Center' },
    { icon: 'document-text-outline', label: 'Terms & Policies' },
  ];

  return (
    <View style={styles.actionsSection}>
      {actions.map((action, index) => (
        <TouchableOpacity key={index} style={styles.actionItem}>
          <Ionicons name={action.icon} size={22} color="#555" />
          <Text style={styles.actionText}>{action.label}</Text>
          <Ionicons
            name="chevron-forward"
            size={20}
            color="#ccc"
            style={styles.actionArrow}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  actionsSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    marginTop: 8,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  actionText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 16,
    flex: 1,
  },
  actionArrow: {
    marginLeft: 8,
  },
});
