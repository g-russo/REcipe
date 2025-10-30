import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function EmptyState({ icon, title, subtitle }) {
  return (
    <View style={styles.emptyContainer}>
      <Ionicons name={icon} size={60} color="#ccc" />
      <Text style={styles.emptyText}>{title}</Text>
      <Text style={styles.emptySubText}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#555',
    marginTop: 16,
  },
  emptySubText: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
  },
});
