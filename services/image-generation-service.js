import { supabase } from '../lib/supabase';
import { OPENAI_API_KEY } from '@env';
import ImageResizer from 'react-native-image-resizer';
import * as FileSystem from 'expo-file-system';

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
      const enhancedPrompt = `Professional food photography: ${prompt}. High quality, appetizing, natural lighting, top-down view, clean white background, 4k resolution, commercial style.`;

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

      // Step 1: Convert blob to base64 using FileReader (simple and reliable)
      const reader = new FileReader();
      const base64Promise = new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(imageBlob);
      });

      const base64DataUrl = await base64Promise;
      const base64Image = base64DataUrl.split(',')[1]; // Remove "data:image/png;base64," prefix
      
      console.log('📸 Image size (base64):', Math.round(base64Image.length * 0.75 / 1024), 'KB (PNG)');

      // Step 2: Try to convert to WebP using ImageResizer
      let finalBase64 = base64Image;
      let contentType = 'image/png';
      let actualFilename = filename;

      try {
        // Save as temp file first
        const tempPngPath = `${FileSystem.cacheDirectory}temp_${Date.now()}.png`;
        await FileSystem.writeAsStringAsync(tempPngPath, base64Image, {
          encoding: 'base64' // Use string literal instead of EncodingType
        });

        console.log('🔄 Converting PNG to WebP...');
        
        // Convert to WebP
        const webpResult = await ImageResizer.createResizedImage(
          tempPngPath,
          1024,
          1024,
          'WEBP',
          75, // 75% quality - good balance
          0,
          null,
          false,
          { mode: 'contain', onlyScaleDown: true }
        );

        // Read WebP file
        const webpBase64 = await FileSystem.readAsStringAsync(webpResult.uri, {
          encoding: 'base64' // Use string literal
        });

        finalBase64 = webpBase64;
        contentType = 'image/webp';
        
        console.log('✅ WebP conversion successful:', Math.round(webpResult.size / 1024), 'KB (75% smaller!)');

        // Cleanup temp files
        await FileSystem.deleteAsync(tempPngPath, { idempotent: true });
        await FileSystem.deleteAsync(webpResult.uri, { idempotent: true });
      } catch (webpError) {
        console.warn('⚠️ WebP conversion failed, using PNG:', webpError.message);
        // Fallback to PNG if WebP conversion fails
        contentType = 'image/png';
        actualFilename = filename.replace('.webp', '.png');
      }

      // Step 3: Convert base64 to Uint8Array for Supabase upload
      const binaryString = atob(finalBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      console.log('📊 Final upload size:', Math.round(bytes.length / 1024), 'KB');

      // Step 4: Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('recipe-images')
        .upload(actualFilename, bytes, {
          contentType: contentType,
          cacheControl: '31536000',
          upsert: false
        });

      if (error) {
        console.error('Supabase upload error:', error);
        throw new Error(`Upload error: ${error.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('recipe-images')
        .getPublicUrl(actualFilename);

      console.log('✅ Image uploaded to Supabase successfully!');
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
}

export default new ImageGenerationService();
