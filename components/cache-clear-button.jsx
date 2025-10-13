import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Emergency Cache Clear Component
 * Add this to your profile screen or settings to let users clear cache when storage is full
 */
export default function CacheClearButton() {
  const [storageSize, setStorageSize] = useState(null);
  const [loading, setLoading] = useState(false);

  const checkStorageSize = async () => {
    try {
      setLoading(true);
      const keys = await AsyncStorage.getAllKeys();
      let totalSize = 0;
      
      for (const key of keys) {
        const value = await AsyncStorage.getItem(key);
        totalSize += value ? value.length : 0;
      }
      
      const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);
      setStorageSize(sizeMB);
      
      Alert.alert(
        '📦 Storage Usage',
        `Current: ${sizeMB}MB / 50MB\n${keys.length} items stored`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('❌ Failed to check storage:', error);
      Alert.alert('Error', 'Failed to check storage size');
    } finally {
      setLoading(false);
    }
  };

  const clearAllCache = async () => {
    Alert.alert(
      '🗑️ Clear All Cache?',
      'This will delete all cached recipes and you\'ll need to restart the app.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await AsyncStorage.clear();
              console.log('✅ All cache cleared!');
              Alert.alert(
                'Success! ✅',
                'Cache cleared successfully.\n\nPlease restart the app now.',
                [{ text: 'OK' }]
              );
              setStorageSize(null);
            } catch (error) {
              console.error('❌ Failed to clear cache:', error);
              Alert.alert('Error', 'Failed to clear cache: ' + error.message);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🗄️ Storage Management</Text>
      
      {storageSize && (
        <Text style={styles.storageText}>
          Current Usage: {storageSize}MB / 50MB
        </Text>
      )}

      <TouchableOpacity
        style={[styles.button, styles.checkButton]}
        onPress={checkStorageSize}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? '⏳ Checking...' : '📊 Check Storage'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.clearButton]}
        onPress={clearAllCache}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? '⏳ Clearing...' : '🗑️ Clear All Cache'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.warningText}>
        ⚠️ Use this if you see "database or disk is full" errors
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    marginVertical: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  storageText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 12,
  },
  button: {
    padding: 14,
    borderRadius: 8,
    marginVertical: 6,
    alignItems: 'center',
  },
  checkButton: {
    backgroundColor: '#4CAF50',
  },
  clearButton: {
    backgroundColor: '#f44336',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  warningText: {
    fontSize: 12,
    color: '#ff9800',
    textAlign: 'center',
    marginTop: 12,
  },
});
