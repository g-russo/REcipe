import { supabase } from '../lib/supabase';
import { OPENAI_API_KEY } from '@env';
import ImageResizer from 'react-native-image-resizer';
import * as FileSystem from 'expo-file-system';
import ImageConverter from '../utils/image-converter';

const OPENAI_IMAGE_API = 'https://api.openai.com/v1/images/generations';

class ImageGenerationService {
  /**
   * Generate recipe image using DALL-E 3 and save to Supabase Storage as WebP
   * @param {string} recipeId - Unique recipe identifier
   * @param {string} prompt - Image generation prompt
   * @param {string} recipeName - Recipe name for filename
   * @returns {Promise<string>} - Public URL of the uploaded image
   */
  async generateAndStoreRecipeImage(recipeId, prompt, recipeName) {
    try {
      console.log('🎨 Generating image for:', recipeName);

      // Step 1: Generate image with DALL-E
      const imageUrl = await this.generateImageWithDALLE(prompt);

      // Step 2: Download the image as blob
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error('Failed to download DALL-E image');
      }
      const imageBlob = await response.blob();

      // Step 3: Upload blob to Supabase Storage
      const publicUrl = await this.uploadToSupabase(recipeId, recipeName, imageBlob);

      console.log('✅ Image generated and stored');

      return publicUrl;
    } catch (error) {
      console.error('❌ Image generation/storage failed:', error.message);
      // Return fallback image
      return this.getFallbackImage();
    }
  }

  /**
   * Generate image using DALL-E 3
   */
  async generateImageWithDALLE(prompt) {
    try {
      const enhancedPrompt = `Professional food photography of ${prompt} on a plate. High quality, appetizing, natural lighting, top-down view, clean background, commercial style. Focus on the food only, no text or labels.`;

      const response = await fetch(OPENAI_IMAGE_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'dall-e-3', // or 'dall-e-2' for cheaper option
          prompt: enhancedPrompt,
          size: '1024x1024', // DALL-E 3 supports: 1024x1024, 1024x1792, 1792x1024
          quality: 'standard', // 'standard' or 'hd' (hd is 2x the cost)
          n: 1,
          response_format: 'url' // Get URL instead of base64
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`DALL-E API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return data.data[0].url;
    } catch (error) {
      console.error('DALL-E generation error:', error);
      throw error;
    }
  }

  /**
   * Download image from URL
   */
  async downloadImage(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to download image');
      }
      return await response.blob();
    } catch (error) {
      console.error('Image download error:', error);
      throw error;
    }
  }

  /**
   * Convert image to WebP format - SIMPLIFIED for React Native
   * Just returns the original image URL since Supabase can handle the upload directly
   */
  async convertToWebP(imageUrl) {
    try {
      // In React Native, we can't easily convert to WebP without native modules
      // Instead, we'll just return the original URL and let Supabase handle it
      // The image from DALL-E is already optimized
      return imageUrl;
    } catch (error) {
      console.warn('WebP conversion skipped:', error.message);
      return imageUrl;
    }
  }

  /**
   * SIMPLIFIED: Convert DALL-E image URL directly to WebP and upload
   * No complex blob/file handling - just download, convert, upload!
   */
  async uploadToSupabase(recipeId, recipeName, imageBlob) {
    try {
      const cleanName = recipeName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      
      const timestamp = Date.now();
      const filename = `ai-generated/${cleanName}-${recipeId}-${timestamp}.webp`;

      console.log('📤 Converting to WebP and uploading:', filename);

      // Step 1: Convert blob to base64 data URL
      const reader = new FileReader();
      const base64Promise = new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(imageBlob);
      });

      const base64DataUrl = await base64Promise;
      console.log('📸 Original image size:', Math.round(base64DataUrl.length * 0.75 / 1024), 'KB (PNG)');

      // Step 2: Convert to WebP using our image converter utility
      let finalBase64;
      let contentType = 'image/webp'; // Always WebP now
      
      try {
        console.log('🔄 Converting to WebP with image-converter...');
        
        // Convert to WebP (optimized for AI-generated images)
        const webpResult = await ImageConverter.convertBase64ToWebP(
          base64DataUrl,
          ImageConverter.ConversionPresets.AI_GENERATED
        );

        finalBase64 = webpResult.base64;
        contentType = 'image/webp';
        
        console.log('✅ WebP conversion successful!');
        console.log(`📐 Dimensions: ${webpResult.width}x${webpResult.height}`);
        console.log(`💾 Size: ${webpResult.sizeKB} KB (${Math.round((1 - webpResult.size / (base64DataUrl.length * 0.75)) * 100)}% smaller!)`);
      } catch (webpError) {
        console.error('❌ WebP conversion failed:', webpError);
        throw new Error(`WebP conversion failed: ${webpError.message}`);
      }

      // Step 3: Convert base64 to Uint8Array for Supabase upload
      const binaryString = atob(finalBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      console.log('📊 Final upload size:', Math.round(bytes.length / 1024), 'KB');

      // Step 4: Upload to Supabase Storage as WebP
      const { data, error } = await supabase.storage
        .from('recipe-images')
        .upload(filename, bytes, {
          contentType: 'image/webp', // Always WebP
          cacheControl: '31536000',
          upsert: false
        });

      if (error) {
        console.error('Supabase upload error:', error);
        throw new Error(`Upload error: ${error.message}`);
      }

      // Get public URL (use filename, not actualFilename)
      const { data: urlData } = supabase.storage
        .from('recipe-images')
        .getPublicUrl(filename);

      console.log('✅ Image uploaded to Supabase successfully as WebP!');
      console.log('🔗 Public URL:', urlData.publicUrl);
      return urlData.publicUrl;
    } catch (error) {
      console.error('Supabase upload error:', error);
      throw error;
    }
  }

  /**
   * Get fallback image (Unsplash stock photo)
   */
  getFallbackImage() {
    const fallbackImages = [
      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=1024&h=1024&fit=crop&auto=format&q=80',
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1024&h=1024&fit=crop&auto=format&q=80',
      'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=1024&h=1024&fit=crop&auto=format&q=80',
      'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=1024&h=1024&fit=crop&auto=format&q=80',
      'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=1024&h=1024&fit=crop&auto=format&q=80'
    ];

    // Return random fallback image
    return fallbackImages[Math.floor(Math.random() * fallbackImages.length)];
  }

  /**
   * Batch generate images for multiple recipes
   */
  async generateImagesForRecipes(recipes) {
    const recipesWithImages = [];

    for (const recipe of recipes) {
      try {
        const imageUrl = await this.generateAndStoreRecipeImage(
          recipe.recipeID || `temp-${Date.now()}`,
          recipe.imagePrompt || recipe.recipeName,
          recipe.recipeName
        );

        recipesWithImages.push({
          ...recipe,
          recipeImage: imageUrl
        });

        // Add small delay to avoid rate limits (OpenAI has rate limits)
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.warn(`Failed to generate image for ${recipe.recipeName}:`, error.message);
        recipesWithImages.push({
          ...recipe,
          recipeImage: this.getFallbackImage()
        });
      }
    }

    return recipesWithImages;
  }

  /**
   * Delete recipe image from storage
   */
  async deleteRecipeImage(imageUrl) {
    try {
      if (!imageUrl || !imageUrl.includes('recipe-images')) {
        return; // Not a Supabase storage image
      }

      // Extract filename from URL
      const urlParts = imageUrl.split('recipe-images/');
      if (urlParts.length < 2) return;

      const filename = urlParts[1];

      const { error } = await supabase.storage
        .from('recipe-images')
        .remove([filename]);

      if (error) {
        console.error('Failed to delete image:', error);
      } else {
        console.log('✅ Image deleted:', filename);
      }
    } catch (error) {
      console.error('Error deleting image:', error);
    }
  }

  /**
   * Download Edamam image and store permanently in Supabase Storage
   * This solves the expired AWS token problem by creating a permanent copy
   */
  async downloadAndStoreEdamamImage(imageUrl, recipeUri) {
    try {
      if (!imageUrl || !recipeUri) {
        console.warn('⚠️ Missing imageUrl or recipeUri for download');
        return null;
      }

      // Generate filename from URI
      const uriHash = recipeUri.split('#')[1] || recipeUri.split('/').pop() || `edamam-${Date.now()}`;
      const filename = `edamam/${uriHash}.webp`;

      // Check if image already exists in Supabase Storage
      const { data: existingFiles, error: listError } = await supabase.storage
        .from('recipe-images')
        .list('edamam', {
          limit: 1,
          search: uriHash
        });

      if (existingFiles && existingFiles.length > 0) {
        // Image already exists, return the existing URL
        const { data: urlData } = supabase.storage
          .from('recipe-images')
          .getPublicUrl(filename);
        
        console.log('✅ Image already exists in storage, using cached version');
        console.log('🔗 Cached URL:', urlData.publicUrl);
        return urlData.publicUrl;
      }

      console.log('📥 Downloading Edamam image:', imageUrl.substring(0, 100) + '...');

      // Step 1: Download the image
      const response = await fetch(imageUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
      }

      // Step 2: Get image as blob
      const blob = await response.blob();
      console.log('✅ Image downloaded, size:', Math.round(blob.size / 1024), 'KB');

      // Step 3: Convert blob to base64 for WebP conversion
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      // Step 4: Convert to WebP for efficiency
      let finalBase64;
      let contentType = 'image/webp';

      try {
        const webpResult = await this.convertImageToWebP(
          `data:${blob.type};base64,${base64}`,
          { quality: 0.85, maxWidth: 1024, maxHeight: 1024 }
        );

        finalBase64 = webpResult.base64;
        console.log('✅ Converted to WebP:', webpResult.sizeKB, 'KB');
      } catch (webpError) {
        console.warn('⚠️ WebP conversion failed, using original:', webpError.message);
        finalBase64 = base64;
        contentType = blob.type;
      }

      // Step 5: Convert to Uint8Array
      const binaryString = atob(finalBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Step 6: Upload to Supabase Storage (filename already generated above)
      console.log('📤 Uploading to Supabase Storage:', filename);

      // Step 7: Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('recipe-images')
        .upload(filename, bytes, {
          contentType: 'image/webp',
          cacheControl: '31536000', // Cache for 1 year
          upsert: true // Overwrite if exists
        });

      if (error) {
        // If file already exists, that's fine - just get the URL
        if (error.message.includes('already exists')) {
          console.log('ℹ️ Image already exists in storage');
        } else {
          throw new Error(`Upload error: ${error.message}`);
        }
      }

      // Step 8: Get public URL
      const { data: urlData } = supabase.storage
        .from('recipe-images')
        .getPublicUrl(filename);

      console.log('✅ Edamam image stored permanently!');
      console.log('🔗 New permanent URL:', urlData.publicUrl);
      
      return urlData.publicUrl;
    } catch (error) {
      console.error('❌ Error downloading/storing Edamam image:', error);
      // Return original URL as fallback (even if expired)
      return imageUrl;
    }
  }
}

export default new ImageGenerationService();
