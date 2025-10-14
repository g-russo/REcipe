import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

/**
 * ONE-TIME CLEANUP UTILITY
 * Clears old AsyncStorage cache that was filling up phone storage
 * Run this once, then you can remove this file
 */
export const clearOldCache = async () => {
  try {
    console.log('🧹 Starting one-time cache cleanup...');
    
    // Get all keys
    const allKeys = await AsyncStorage.getAllKeys();
    console.log(`📋 Found ${allKeys.length} AsyncStorage keys`);
    
    // Filter for cache-related keys
    const cacheKeys = allKeys.filter(key => 
      key.includes('cache') || 
      key.includes('recipe') || 
      key.includes('popular') ||
      key.includes('search') ||
      key.includes('similar')
    );
    
    if (cacheKeys.length === 0) {
      console.log('✅ No old cache found - already clean!');
      return { success: true, keysRemoved: 0 };
    }
    
    console.log(`🗑️ Removing ${cacheKeys.length} old cache keys:`, cacheKeys);
    
    // Remove all cache keys
    await AsyncStorage.multiRemove(cacheKeys);
    
    console.log('✅ Old cache cleared successfully!');
    console.log(`💾 Freed up device storage`);
    console.log(`🌐 All future caching will use Supabase`);
    
    return { 
      success: true, 
      keysRemoved: cacheKeys.length,
      keys: cacheKeys 
    };
    
  } catch (error) {
    console.error('❌ Cache cleanup failed:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
};

/**
 * Clear ALL AsyncStorage (nuclear option)
 */
export const clearAllAsyncStorage = async () => {
  try {
    console.log('🚨 NUCLEAR OPTION: Clearing ALL AsyncStorage...');
    await AsyncStorage.clear();
    console.log('✅ All AsyncStorage cleared!');
    return { success: true };
  } catch (error) {
    console.error('❌ Failed to clear AsyncStorage:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get storage usage info
 */
export const getStorageInfo = async () => {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    let totalSize = 0;
    const keyDetails = [];
    
    for (const key of allKeys) {
      const value = await AsyncStorage.getItem(key);
      const size = value ? new Blob([value]).size : 0;
      totalSize += size;
      
      keyDetails.push({
        key,
        size,
        sizeKB: (size / 1024).toFixed(2),
        preview: value ? value.substring(0, 100) : ''
      });
    }
    
    return {
      totalKeys: allKeys.length,
      totalSize,
      totalSizeKB: (totalSize / 1024).toFixed(2),
      totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
      keys: keyDetails.sort((a, b) => b.size - a.size) // Sort by size
    };
  } catch (error) {
    console.error('❌ Failed to get storage info:', error);
    return null;
  }
};

/**
 * Interactive cleanup with confirmation
 */
export const interactiveCacheCleanup = async () => {
  try {
    // Get storage info first
    const info = await getStorageInfo();
    
    if (!info) {
      Alert.alert('Error', 'Could not read storage info');
      return;
    }
    
    const cacheKeys = info.keys.filter(item => 
      item.key.includes('cache') || 
      item.key.includes('recipe')
    );
    
    const cacheSizeMB = (cacheKeys.reduce((sum, item) => sum + item.size, 0) / 1024 / 1024).toFixed(2);
    
    Alert.alert(
      '🧹 Clear Old Cache?',
      `Found ${cacheKeys.length} cache items using ${cacheSizeMB} MB\n\nThis will free up space on your device.\n\nAll future caching will use Supabase (unlimited space).`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Cache',
          style: 'destructive',
          onPress: async () => {
            const result = await clearOldCache();
            if (result.success) {
              Alert.alert(
                '✅ Cache Cleared!',
                `Removed ${result.keysRemoved} items\nFreed ${cacheSizeMB} MB\n\nRestart the app for changes to take effect.`,
                [{ text: 'OK' }]
              );
            } else {
              Alert.alert('Error', `Failed to clear cache: ${result.error}`);
            }
          }
        }
      ]
    );
  } catch (error) {
    Alert.alert('Error', error.message);
  }
};

export default {
  clearOldCache,
  clearAllAsyncStorage,
  getStorageInfo,
  interactiveCacheCleanup
};
