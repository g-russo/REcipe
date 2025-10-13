import { supabase } from '../lib/supabase';
import { OPENAI_API_KEY } from '@env';

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

      // Step 2: Download the generated image
      const imageBlob = await this.downloadImage(imageUrl);

      // Step 3: Convert to WebP format
      const webpBlob = await this.convertToWebP(imageBlob);

      // Step 4: Upload to Supabase Storage
      const publicUrl = await this.uploadToSupabase(recipeId, recipeName, webpBlob);

      console.log('✅ Image stored successfully:', publicUrl);

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
   * Convert image to WebP format using canvas (for React Native)
   * Note: This is a simplified version. For production, consider using a library like react-native-image-manipulator
   */
  async convertToWebP(imageBlob) {
    try {
      // For React Native, we'll use expo-image-manipulator
      // Install: npm install expo-image-manipulator
      const { manipulateAsync, SaveFormat } = require('expo-image-manipulator');

      // Convert blob to URI
      const reader = new FileReader();
      const dataUrl = await new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(imageBlob);
      });

      // Manipulate and convert to WebP
      const manipResult = await manipulateAsync(
        dataUrl,
        [{ resize: { width: 1024, height: 1024 } }], // Ensure consistent size
        { compress: 0.8, format: SaveFormat.WEBP }
      );

      // Convert URI back to blob
      const webpResponse = await fetch(manipResult.uri);
      return await webpResponse.blob();
    } catch (error) {
      console.warn('WebP conversion failed, using original:', error.message);
      // Fallback: return original blob if conversion fails
      return imageBlob;
    }
  }

  /**
   * Upload image to Supabase Storage
   */
  async uploadToSupabase(recipeId, recipeName, imageBlob) {
    try {
      // Create a clean filename
      const cleanName = recipeName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      
      const timestamp = Date.now();
      const filename = `ai-generated/${cleanName}-${recipeId}-${timestamp}.webp`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('recipe-images')
        .upload(filename, imageBlob, {
          contentType: 'image/webp',
          cacheControl: '31536000', // Cache for 1 year
          upsert: false // Don't overwrite existing files
        });

      if (error) {
        throw new Error(`Upload error: ${error.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('recipe-images')
        .getPublicUrl(filename);

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
