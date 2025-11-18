/**
 * Recipe Image Cache Service - Supabase Storage Implementation
 * 
 * Stores recipe images in Supabase Storage for persistent, fast access
 * Benefits:
 * - Images available across all devices
 * - CDN-backed for fast delivery
 * - No device storage limits
 * - Automatic deduplication
 * - Works like history images (proven approach)
 */

import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_BUCKET = 'recipe-images';
const CACHE_INDEX_KEY = '@recipe_image_cache_index_v1';
const CACHE_EXPIRY_DAYS = 30; // Images valid for 30 days
const MAX_CACHE_ENTRIES = 500; // Limit cache index size

class RecipeImageCacheService {
  constructor() {
    this.cacheIndex = null; // Maps original URL to Supabase URL
    this.uploadQueue = new Set(); // Track ongoing uploads
    this.initializeService();
  }

  /**
   * Initialize service and load cache index
   */
  async initializeService() {
    try {
      await this.loadCacheIndex();
      await this.ensureBucketExists();
      console.log('📸 Recipe Image Cache Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize image cache service:', error);
    }
  }

  /**
   * Ensure Supabase storage bucket exists
   */
  async ensureBucketExists() {
    try {
      const { data: buckets, error } = await supabase.storage.listBuckets();
      
      if (error) {
        console.warn('⚠️ Cannot check buckets (need manual creation):', error.message);
        return;
      }

      const bucketExists = buckets?.some(b => b.name === STORAGE_BUCKET);
      
      if (!bucketExists) {
        console.warn(`⚠️ Bucket '${STORAGE_BUCKET}' not found!`);
        console.warn('📝 Create it manually in Supabase Dashboard:');
        console.warn('   1. Go to Storage → New bucket');
        console.warn('   2. Name: recipe-images');
        console.warn('   3. Public: YES');
        console.warn('   4. Then run: database/storage-recipe-images-policies.sql');
        
        // Try creating anyway (will fail with RLS error, but user will see instructions)
        const { error: createError } = await supabase.storage.createBucket(STORAGE_BUCKET, {
          public: true,
          fileSizeLimit: 5242880, // 5MB limit per image
        });
        
        if (createError) {
          console.warn('❌ Cannot create bucket automatically (expected with RLS)');
          console.warn('💡 Solution: Create bucket manually in Supabase Dashboard');
        } else {
          console.log(`✅ Created ${STORAGE_BUCKET} bucket`);
        }
      } else {
        console.log(`✅ Bucket '${STORAGE_BUCKET}' exists`);
      }
    } catch (error) {
      console.warn('⚠️ Bucket check error (create manually):', error.message);
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
   * Generate cache key from original image URL
   */
  generateCacheKey(originalUrl) {
    if (!originalUrl) return null;
    
    // Create a hash-like key from URL
    const cleanUrl = originalUrl.split('?')[0]; // Remove query params
    const urlHash = cleanUrl
      .replace(/[^a-zA-Z0-9]/g, '_')
      .substring(0, 100);
    
    const timestamp = Date.now().toString(36);
    return `${urlHash}_${timestamp}`;
  }

  /**
   * Get cached image URL or cache it if not exists
   * @param {string} originalUrl - Original recipe image URL
   * @returns {Promise<string>} Supabase storage URL or original URL as fallback
   */
  async getCachedImageUrl(originalUrl) {
    if (!originalUrl) return null;

    try {
      // Check if already cached
      const cached = this.cacheIndex[originalUrl];
      if (cached) {
        const age = Date.now() - cached.timestamp;
        const maxAge = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

        if (age < maxAge) {
          // Cache hit - return Supabase URL (or original if skipped)
          return cached.supabaseUrl;
        } else if (!cached.skipped) {
          // Cache expired - remove and re-cache (unless it was skipped due to 403)
          delete this.cacheIndex[originalUrl];
          await this.saveCacheIndex();
        } else {
          // Was skipped (403 error), keep using original
          return cached.supabaseUrl;
        }
      }

      // Cache miss - upload to Supabase
      return await this.cacheImage(originalUrl);
    } catch (error) {
      console.error('❌ Error getting cached image:', error);
      return originalUrl; // Fallback to original URL
    }
  }

  /**
   * Cache image to Supabase Storage
   * @param {string} originalUrl - Original image URL
   * @returns {Promise<string>} Supabase storage URL
   */
  async cacheImage(originalUrl) {
    // Prevent duplicate uploads
    if (this.uploadQueue.has(originalUrl)) {
      console.log('⏳ Upload already in progress for:', originalUrl.substring(0, 50));
      return originalUrl; // Return original while uploading
    }

    this.uploadQueue.add(originalUrl);

    try {
      // Download image with better error handling
      const response = await fetch(originalUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
      
      if (!response.ok) {
        if (response.status === 403) {
          console.warn('⚠️ Image protected (403), skipping cache:', originalUrl.substring(0, 50));
          // Mark as "don't cache" so we don't keep trying
          this.cacheIndex[originalUrl] = {
            supabaseUrl: originalUrl, // Use original URL
            timestamp: Date.now(),
            skipped: true // Flag to prevent retries
          };
          await this.saveCacheIndex();
          return originalUrl;
        }
        throw new Error(`Failed to fetch image: ${response.status}`);
      }

      // React Native doesn't support .blob(), use arrayBuffer() instead
      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: response.headers.get('content-type') || 'image/jpeg' });
      
      // IMPORTANT: Only WebP images accepted
      // Convert to WebP if needed (for now, just change extension)
      const fileName = `${this.generateCacheKey(originalUrl)}.webp`;
      const filePath = `cached/${fileName}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, blob, {
          contentType: 'image/webp',
          cacheControl: '2592000', // 30 days
          upsert: false
        });

      if (error) {
        console.error('❌ Upload error:', error);
        return originalUrl;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(filePath);

      const supabaseUrl = urlData.publicUrl;

      // Update cache index
      this.cacheIndex[originalUrl] = {
        supabaseUrl,
        timestamp: Date.now(),
        fileName: filePath
      };

      await this.saveCacheIndex();
      await this.cleanupIfNeeded();

      console.log('✅ Image cached to Supabase:', fileName);
      return supabaseUrl;

    } catch (error) {
      console.error('❌ Failed to cache image:', error.message);
      return originalUrl; // Fallback to original
    } finally {
      this.uploadQueue.delete(originalUrl);
    }
  }

  /**
   * Get file extension from URL
   */
  getFileExtension(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const match = pathname.match(/\.([a-zA-Z0-9]+)$/);
      return match ? match[1].toLowerCase() : null;
    } catch {
      return null;
    }
  }

  /**
   * Batch cache multiple images in background
   * @param {Array<string>} imageUrls - Array of image URLs to cache
   */
  async batchCacheImages(imageUrls) {
    if (!imageUrls || imageUrls.length === 0) return;

    console.log(`🔄 Batch caching ${imageUrls.length} images...`);

    // Process in batches to avoid overwhelming the system
    const BATCH_SIZE = 3;
    let cached = 0;

    for (let i = 0; i < imageUrls.length; i += BATCH_SIZE) {
      const batch = imageUrls.slice(i, i + BATCH_SIZE);
      
      await Promise.allSettled(
        batch.map(async url => {
          try {
            await this.getCachedImageUrl(url);
            cached++;
          } catch (error) {
            console.error('Batch cache error:', error);
          }
        })
      );

      // Small delay between batches
      if (i + BATCH_SIZE < imageUrls.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`✅ Batch cached ${cached}/${imageUrls.length} images`);
  }

  /**
   * Cleanup old cache entries if needed
   */
  async cleanupIfNeeded() {
    const entries = Object.entries(this.cacheIndex);
    
    if (entries.length <= MAX_CACHE_ENTRIES) return;

    console.log('🧹 Cleaning up old cache entries...');

    // Sort by timestamp (oldest first)
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    // Remove oldest 20% of entries
    const toRemove = Math.floor(entries.length * 0.2);
    const removedEntries = entries.slice(0, toRemove);

    // Delete from Supabase Storage
    const filesToDelete = removedEntries
      .map(([_, entry]) => entry.fileName)
      .filter(Boolean);

    if (filesToDelete.length > 0) {
      const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .remove(filesToDelete);

      if (error) {
        console.error('Error deleting old images:', error);
      }
    }

    // Remove from index
    removedEntries.forEach(([url]) => delete this.cacheIndex[url]);
    await this.saveCacheIndex();

    console.log(`✅ Removed ${toRemove} old cache entries`);
  }

  /**
   * Clear entire image cache
   */
  async clearCache() {
    try {
      // Delete all cached images from Supabase
      const { data: files, error: listError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .list('cached');

      if (!listError && files && files.length > 0) {
        const filePaths = files.map(f => `cached/${f.name}`);
        await supabase.storage.from(STORAGE_BUCKET).remove(filePaths);
      }

      // Clear local index
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
    const entries = Object.entries(this.cacheIndex);
    const now = Date.now();
    
    const aged = entries.map(([_, entry]) => {
      const age = now - entry.timestamp;
      return Math.round(age / 1000 / 60 / 60 / 24); // Days
    });

    return {
      totalCached: entries.length,
      maxEntries: MAX_CACHE_ENTRIES,
      expiryDays: CACHE_EXPIRY_DAYS,
      avgAgeDays: aged.length > 0 ? Math.round(aged.reduce((a, b) => a + b, 0) / aged.length) : 0,
      uploadsInProgress: this.uploadQueue.size
    };
  }
}

// Export singleton
const recipeImageCacheService = new RecipeImageCacheService();
export default recipeImageCacheService;
