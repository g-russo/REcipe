/**
 * Image Cache Service - Optimized for APK builds
 * 
 * Features:
 * - Local filesystem caching with expo-file-system
 * - Automatic cache management (size limits, expiry)
 * - Prefetching for faster load times
 * - Compression support
 * - Memory-efficient image loading
 */

import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_DIR = `${FileSystem.cacheDirectory}recipe-images/`;
const CACHE_INDEX_KEY = '@image_cache_index';
const MAX_CACHE_SIZE_MB = 100; // 100MB cache limit
const CACHE_EXPIRY_DAYS = 7; // Images expire after 7 days
const MAX_CACHE_AGE = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

class ImageCacheService {
  constructor() {
    this.initializeCache();
    this.cacheIndex = null;
  }

  /**
   * Initialize cache directory
   */
  async initializeCache() {
    try {
      const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
        console.log('📁 Image cache directory created');
      }

      // Load cache index
      await this.loadCacheIndex();
    } catch (error) {
      console.error('❌ Failed to initialize image cache:', error);
    }
  }

  /**
   * Load cache index from AsyncStorage
   */
  async loadCacheIndex() {
    try {
      const indexData = await AsyncStorage.getItem(CACHE_INDEX_KEY);
      this.cacheIndex = indexData ? JSON.parse(indexData) : {};
      console.log(`📊 Image cache index loaded: ${Object.keys(this.cacheIndex).length} entries`);
    } catch (error) {
      console.error('❌ Failed to load cache index:', error);
      this.cacheIndex = {};
    }
  }

  /**
   * Save cache index to AsyncStorage
   */
  async saveCacheIndex() {
    try {
      await AsyncStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(this.cacheIndex));
    } catch (error) {
      console.error('❌ Failed to save cache index:', error);
    }
  }

  /**
   * Generate cache key from image URL
   */
  generateCacheKey(url) {
    return url.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  }

  /**
   * Get cached image URI or download if not cached
   * @param {string} imageUrl - Original image URL
   * @param {boolean} prefetch - Whether this is a prefetch operation
   * @returns {Promise<string>} Local file URI or original URL
   */
  async getCachedImage(imageUrl, prefetch = false) {
    if (!imageUrl) return null;

    try {
      // Ensure cache is initialized
      if (!this.cacheIndex) {
        await this.loadCacheIndex();
      }

      const cacheKey = this.generateCacheKey(imageUrl);
      const localUri = `${CACHE_DIR}${cacheKey}.jpg`;

      // Check if file exists in cache
      const cacheEntry = this.cacheIndex[cacheKey];
      if (cacheEntry) {
        const fileInfo = await FileSystem.getInfoAsync(localUri);
        
        if (fileInfo.exists) {
          // Check if cache is still valid
          const age = Date.now() - cacheEntry.timestamp;
          if (age < MAX_CACHE_AGE) {
            if (!prefetch) {
              console.log(`✅ Image cache HIT: ${cacheKey.substring(0, 20)}...`);
            }
            return localUri;
          } else {
            // Cache expired, delete old file
            await FileSystem.deleteAsync(localUri, { idempotent: true });
            delete this.cacheIndex[cacheKey];
            await this.saveCacheIndex();
          }
        }
      }

      // Cache MISS - download image
      if (!prefetch) {
        console.log(`⏳ Image cache MISS: downloading ${cacheKey.substring(0, 20)}...`);
      }

      // Download image with timeout
      const downloadResult = await this.downloadWithTimeout(imageUrl, localUri, 10000);
      
      if (downloadResult.success) {
        // Update cache index
        this.cacheIndex[cacheKey] = {
          url: imageUrl,
          timestamp: Date.now(),
          size: downloadResult.size
        };
        await this.saveCacheIndex();

        // Check cache size and cleanup if needed
        await this.cleanupIfNeeded();

        if (!prefetch) {
          console.log(`✅ Image downloaded and cached: ${cacheKey.substring(0, 20)}...`);
        }
        return localUri;
      } else {
        // Download failed, return original URL as fallback
        console.warn(`⚠️ Image download failed, using original URL`);
        return imageUrl;
      }
    } catch (error) {
      console.error('❌ Image cache error:', error.message);
      return imageUrl; // Fallback to original URL
    }
  }

  /**
   * Download image with timeout
   */
  async downloadWithTimeout(url, localUri, timeout = 10000) {
    return new Promise(async (resolve) => {
      const timeoutId = setTimeout(() => {
        resolve({ success: false, error: 'timeout' });
      }, timeout);

      try {
        const downloadResumable = FileSystem.createDownloadResumable(
          url,
          localUri,
          {},
          null
        );

        const result = await downloadResumable.downloadAsync();
        clearTimeout(timeoutId);

        if (result && result.uri) {
          const fileInfo = await FileSystem.getInfoAsync(result.uri);
          resolve({ success: true, size: fileInfo.size || 0 });
        } else {
          resolve({ success: false, error: 'no_result' });
        }
      } catch (error) {
        clearTimeout(timeoutId);
        resolve({ success: false, error: error.message });
      }
    });
  }

  /**
   * Prefetch multiple images in background
   * @param {Array<string>} imageUrls - Array of image URLs to prefetch
   */
  async prefetchImages(imageUrls) {
    if (!imageUrls || imageUrls.length === 0) return;

    console.log(`🔄 Prefetching ${imageUrls.length} images...`);

    // Prefetch in parallel with limit
    const CONCURRENT_DOWNLOADS = 3;
    const chunks = [];
    for (let i = 0; i < imageUrls.length; i += CONCURRENT_DOWNLOADS) {
      chunks.push(imageUrls.slice(i, i + CONCURRENT_DOWNLOADS));
    }

    for (const chunk of chunks) {
      await Promise.allSettled(
        chunk.map(url => this.getCachedImage(url, true))
      );
    }

    console.log(`✅ Prefetch complete`);
  }

  /**
   * Get total cache size
   */
  async getCacheSize() {
    try {
      let totalSize = 0;
      for (const key in this.cacheIndex) {
        totalSize += this.cacheIndex[key].size || 0;
      }
      return totalSize;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Cleanup old cache entries if size exceeds limit
   */
  async cleanupIfNeeded() {
    try {
      const totalSize = await this.getCacheSize();
      const maxSize = MAX_CACHE_SIZE_MB * 1024 * 1024; // Convert to bytes

      if (totalSize > maxSize) {
        console.log(`🧹 Cache size (${Math.round(totalSize / 1024 / 1024)}MB) exceeds limit, cleaning up...`);

        // Sort by timestamp (oldest first)
        const entries = Object.entries(this.cacheIndex).sort(
          (a, b) => a[1].timestamp - b[1].timestamp
        );

        // Delete oldest entries until we're under the limit
        let currentSize = totalSize;
        for (const [key, entry] of entries) {
          if (currentSize <= maxSize * 0.8) break; // Clean to 80% of limit

          const localUri = `${CACHE_DIR}${key}.jpg`;
          await FileSystem.deleteAsync(localUri, { idempotent: true });
          currentSize -= entry.size || 0;
          delete this.cacheIndex[key];
        }

        await this.saveCacheIndex();
        console.log(`✅ Cache cleaned up, new size: ${Math.round(currentSize / 1024 / 1024)}MB`);
      }
    } catch (error) {
      console.error('❌ Cache cleanup failed:', error);
    }
  }

  /**
   * Clear entire cache
   */
  async clearCache() {
    try {
      await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
      await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
      this.cacheIndex = {};
      await AsyncStorage.removeItem(CACHE_INDEX_KEY);
      console.log('🗑️ Image cache cleared');
    } catch (error) {
      console.error('❌ Failed to clear cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    try {
      const totalSize = await this.getCacheSize();
      const entryCount = Object.keys(this.cacheIndex).length;
      
      return {
        entries: entryCount,
        sizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100,
        maxSizeMB: MAX_CACHE_SIZE_MB,
        expiryDays: CACHE_EXPIRY_DAYS
      };
    } catch (error) {
      return { entries: 0, sizeMB: 0, maxSizeMB: MAX_CACHE_SIZE_MB };
    }
  }
}

// Export singleton instance
const imageCacheService = new ImageCacheService();
export default imageCacheService;
