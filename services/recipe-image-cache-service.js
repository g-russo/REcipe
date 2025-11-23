/**
 * Recipe Image Cache Service - Database + Supabase Storage Implementation
 * 
 * Stores recipe images in Supabase Storage with database tracking
 * Benefits:
 * - Images available across all devices
 * - CDN-backed for fast delivery
 * - Database tracking (no AsyncStorage bloat)
 * - Automatic deduplication
 * - Recipe associations for easy cleanup
 */

import { supabase } from '../lib/supabase';

const STORAGE_BUCKET = 'recipe-images';
const CACHE_EXPIRY_DAYS = 30; // Images valid for 30 days
const CACHE_TABLE = 'cache_recipe_images';

class RecipeImageCacheService {
  constructor() {
    this.uploadQueue = new Set(); // Track ongoing uploads
    this.initializeService();
  }

  /**
   * Initialize service and ensure bucket exists
   */
  async initializeService() {
    try {
      await this.ensureBucketExists();
      console.log('📸 Recipe Image Cache Service initialized (database-backed)');
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
   * Generate deterministic cache key from original image URL
   * Same URL = Same cache key (prevents duplicates)
   */
  generateCacheKey(originalUrl) {
    if (!originalUrl) return null;

    // Create a deterministic hash from URL (no timestamp!)
    const cleanUrl = originalUrl.split('?')[0]; // Remove query params

    // Simple but effective hash function
    let hash = 0;
    for (let i = 0; i < cleanUrl.length; i++) {
      const char = cleanUrl.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    // Convert to positive hex string
    const hashStr = Math.abs(hash).toString(16).padStart(8, '0');

    return hashStr; // Return just the hash for flexibility
  }

  /**
   * Sanitize recipe ID for use in filename
   */
  sanitizeRecipeId(recipeId) {
    if (!recipeId) return '';

    // For Edamam URIs, extract just the ID part
    if (recipeId.includes('recipe_')) {
      const match = recipeId.match(/recipe_([a-zA-Z0-9]+)/);
      if (match) return match[1].substring(0, 12);
    }

    // For numeric IDs or other formats
    return String(recipeId)
      .replace(/[^a-zA-Z0-9]/g, '_')
      .substring(0, 20);
  }

  /**
   * Sanitize recipe name for use in filename
   */
  sanitizeFileName(name) {
    if (!name) return '';

    return name
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_') // Replace multiple underscores with single
      .substring(0, 30);
  }

  /**
   * Get cached image URL or cache it if not exists
   * @param {string} originalUrl - Original recipe image URL
   * @param {string} recipeId - Recipe ID (recipeID for AI, uri for Edamam) to tie image to recipe
   * @param {string} recipeName - Recipe name for better filename organization
   * @returns {Promise<string>} Supabase storage URL or original URL as fallback
   */
  async getCachedImageUrl(originalUrl, recipeId = null, recipeName = null) {
    if (!originalUrl) return null;

    try {
      // Check database cache
      const { data: cached, error } = await supabase
        .from(CACHE_TABLE)
        .select('cached_url, expires_at, id')
        .eq('original_url', originalUrl)
        .single();

      if (!error && cached) {
        const isExpired = new Date(cached.expires_at) < new Date();

        if (!isExpired) {
          // Cache hit - increment access count and return cached URL
          await supabase.rpc('increment_image_access', { p_original_url: originalUrl });
          return cached.cached_url;
        } else {
          // Cache expired - delete and re-cache
          await this.deleteCachedImage(cached.id);
        }
      }

      // Cache miss - upload to Supabase with recipe association
      return await this.cacheImage(originalUrl, recipeId, recipeName);
    } catch (error) {
      console.error('❌ Error getting cached image:', error);
      return originalUrl; // Fallback to original URL
    }
  }

  /**
   * Cache image to Supabase Storage with recipe association
   * @param {string} originalUrl - Original image URL
   * @param {string} recipeId - Recipe ID (recipeID for AI, uri for Edamam)
   * @param {string} recipeName - Recipe name for better organization
   * @returns {Promise<string>} Supabase storage URL
   */
  async cacheImage(originalUrl, recipeId = null, recipeName = null) {
    // Prevent duplicate uploads
    if (this.uploadQueue.has(originalUrl)) {
      console.log('⏳ Upload already in progress for:', originalUrl.substring(0, 50));
      return originalUrl; // Return original while uploading
    }

    this.uploadQueue.add(originalUrl);

    try {
      // Always save as WebP (per bucket RLS policy)
      const fileExt = 'webp';

      // Generate filename with recipe association
      const baseKey = this.generateCacheKey(originalUrl);
      const recipePrefix = recipeId ? `recipe-${this.sanitizeRecipeId(recipeId)}_` : '';
      const namePrefix = recipeName ? `${this.sanitizeFileName(recipeName)}_` : '';
      const fileName = `${recipePrefix}${namePrefix}${baseKey}.${fileExt}`;
      const filePath = `cached/${fileName}`;

      // ✅ CHECK IF FILE ALREADY EXISTS IN DATABASE (prevents duplicates)
      const { data: existingCache } = await supabase
        .from(CACHE_TABLE)
        .select('cached_url')
        .eq('original_url', originalUrl)
        .single();

      if (existingCache) {
        console.log('♻️ Image already cached in database');
        await supabase.rpc('increment_image_access', { p_original_url: originalUrl });
        return existingCache.cached_url;
      }

      // Download image with better error handling
      const response = await fetch(originalUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (!response.ok) {
        if (response.status === 403) {
          console.warn('⚠️ Image protected (403), skipping cache:', originalUrl.substring(0, 50));
          // Store in database with original URL (so we don't keep trying)
          await supabase.from(CACHE_TABLE).insert({
            original_url: originalUrl,
            cached_url: originalUrl,
            recipe_id: recipeId,
            recipe_name: recipeName,
            file_path: 'skipped',
            source: 'skipped-403',
            expires_at: new Date(Date.now() + CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString()
          });
          return originalUrl;
        }
        throw new Error(`Failed to fetch image: ${response.status}`);
      }

      // React Native: Convert arrayBuffer to Uint8Array (Supabase supports this)
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Upload to Supabase Storage using Uint8Array
      // Force contentType to image/webp to bypass bucket restrictions if needed
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, uint8Array, {
          contentType: 'image/webp', // Force WebP to bypass bucket MIME restrictions
          cacheControl: '2592000', // 30 days
          upsert: true
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

      // Determine source
      const source = originalUrl.includes('edamam') ? 'edamam' :
        originalUrl.includes('supabase') ? 'ai-generated' : 'external';

      // Store in database cache with recipe association
      const { error: insertError } = await supabase
        .from(CACHE_TABLE)
        .insert({
          original_url: originalUrl,
          cached_url: supabaseUrl,
          recipe_id: recipeId,
          recipe_name: recipeName,
          file_path: filePath,
          source: source,
          file_size: uint8Array.length,
          expires_at: new Date(Date.now() + CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString()
        });

      if (insertError) {
        console.error('❌ Failed to save cache entry to database:', insertError);
      }

      console.log('✅ Image cached to Supabase:', fileName, recipeId ? `(Recipe: ${recipeId})` : '');
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
   * Batch cache multiple images in background with recipe associations
   * @param {Array<Object|string>} items - Array of {url, recipeId, recipeName} or just URLs
   */
  async batchCacheImages(items) {
    if (!items || items.length === 0) return;

    console.log(`🔄 Batch caching ${items.length} images...`);

    // Process in batches to avoid overwhelming the system
    const BATCH_SIZE = 3;
    let cached = 0;

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);

      await Promise.allSettled(
        batch.map(async item => {
          try {
            // Support both string URLs and objects with metadata
            const url = typeof item === 'string' ? item : item.url;
            const recipeId = typeof item === 'object' ? item.recipeId : null;
            const recipeName = typeof item === 'object' ? item.recipeName : null;

            await this.getCachedImageUrl(url, recipeId, recipeName);
            cached++;
          } catch (error) {
            console.error('Batch cache error:', error);
          }
        })
      );

      // Small delay between batches
      if (i + BATCH_SIZE < items.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`✅ Batch cached ${cached}/${items.length} images`);
  }

  /**
   * Delete a cached image by ID
   */
  async deleteCachedImage(cacheId) {
    try {
      const { data: cacheEntry } = await supabase
        .from(CACHE_TABLE)
        .select('file_path')
        .eq('id', cacheId)
        .single();

      if (cacheEntry && cacheEntry.file_path !== 'skipped') {
        // Delete from storage
        await supabase.storage
          .from(STORAGE_BUCKET)
          .remove([cacheEntry.file_path]);
      }

      // Delete from database
      await supabase
        .from(CACHE_TABLE)
        .delete()
        .eq('id', cacheId);

      console.log('🗑️ Deleted cached image:', cacheId);
    } catch (error) {
      console.error('Error deleting cached image:', error);
    }
  }

  /**
   * Clear entire image cache
   */
  async clearCache() {
    try {
      // Get all cached images from database
      const { data: allCached } = await supabase
        .from(CACHE_TABLE)
        .select('file_path');

      if (allCached && allCached.length > 0) {
        // Delete from storage
        const filePaths = allCached
          .filter(c => c.file_path !== 'skipped')
          .map(c => c.file_path);

        if (filePaths.length > 0) {
          await supabase.storage.from(STORAGE_BUCKET).remove(filePaths);
        }
      }

      // Clear database cache
      await supabase
        .from(CACHE_TABLE)
        .delete()
        .neq('id', 0); // Delete all rows

      console.log('🗑️ Image cache cleared');
    } catch (error) {
      console.error('❌ Failed to clear cache:', error);
    }
  }

  /**
   * Get cached images for a specific recipe
   * @param {string} recipeId - Recipe ID to lookup
   * @returns {Promise<Array<Object>>} Array of cached image entries for this recipe
   */
  async getImagesByRecipe(recipeId) {
    if (!recipeId) return [];

    try {
      const { data, error } = await supabase.rpc('get_recipe_images', {
        p_recipe_id: recipeId
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting images by recipe:', error);
      return [];
    }
  }

  /**
   * Delete images associated with a recipe
   * @param {string} recipeId - Recipe ID to delete images for
   */
  async deleteRecipeImages(recipeId) {
    if (!recipeId) return;

    try {
      // Get all images for this recipe
      const { data: recipeImages } = await supabase
        .from(CACHE_TABLE)
        .select('file_path, id')
        .eq('recipe_id', recipeId);

      if (!recipeImages || recipeImages.length === 0) {
        console.log('ℹ️ No cached images found for recipe:', recipeId);
        return;
      }

      // Delete from Supabase Storage
      const filesToDelete = recipeImages
        .filter(img => img.file_path !== 'skipped')
        .map(img => img.file_path);

      if (filesToDelete.length > 0) {
        const { error } = await supabase.storage
          .from(STORAGE_BUCKET)
          .remove(filesToDelete);

        if (error) {
          console.error('Error deleting recipe images from storage:', error);
        }
      }

      // Delete from database
      await supabase
        .from(CACHE_TABLE)
        .delete()
        .eq('recipe_id', recipeId);

      console.log(`🗑️ Deleted ${recipeImages.length} images for recipe: ${recipeId}`);
    } catch (error) {
      console.error('Error deleting recipe images:', error);
    }
  }

  /**
   * Get cache statistics from database
   */
  async getStats() {
    try {
      const { data, error } = await supabase
        .from('cache_images_stats')
        .select('*')
        .single();

      if (error) throw error;

      return {
        ...data,
        expiryDays: CACHE_EXPIRY_DAYS,
        uploadsInProgress: this.uploadQueue.size
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return {
        totalCached: 0,
        withRecipeAssociation: 0,
        orphanedImages: 0,
        expiryDays: CACHE_EXPIRY_DAYS,
        uploadsInProgress: this.uploadQueue.size
      };
    }
  }
}

// Export singleton
const recipeImageCacheService = new RecipeImageCacheService();
export default recipeImageCacheService;
