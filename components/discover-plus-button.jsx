import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export function DiscoverPlusButton({ children }) {
  const router = useRouter();
  return (
    <TouchableOpacity
      style={styles.fab}
      onPress={() => router.push('/food-recognition/upload')}
      accessibilityRole="button"
      accessibilityLabel="Open food recognition"
    >
      {children ?? <Text style={styles.plus}>＋</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  plus: { color: '#fff', fontSize: 28, lineHeight: 28, fontWeight: '700' },
});