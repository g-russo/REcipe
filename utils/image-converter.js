import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

/**
 * Image Converter Utility
 * Converts any image format (PNG, JPG, JPEG, etc.) to WebP
 * Optimizes images for Supabase storage
 * 
 * Features:
 * - Converts to WebP format (better compression)
 * - Resizes images to maximum dimensions
 * - Maintains aspect ratio
 * - Reduces file size significantly
 * - Returns base64 data URL ready for upload
 */

/**
 * Convert any image to WebP format with optimization
 * 
 * @param {string} imageUri - Local file URI or data URL of the image
 * @param {Object} options - Conversion options
 * @param {number} options.maxWidth - Maximum width (default: 1200)
 * @param {number} options.maxHeight - Maximum height (default: 1200)
 * @param {number} options.quality - WebP quality 0-1 (default: 0.85)
 * @param {boolean} options.compress - Whether to compress (default: true)
 * @returns {Promise<Object>} { uri, base64, width, height, size }
 */
export const convertToWebP = async (imageUri, options = {}) => {
  try {
    console.log('🖼️ Converting image to WebP...');
    console.log('📥 Input URI:', imageUri?.substring(0, 100) + '...');
    
    // Default options
    const {
      maxWidth = 1200,
      maxHeight = 1200,
      quality = 0.85, // 85% quality (good balance)
      compress = true
    } = options;

    // Check if imageUri is valid
    if (!imageUri) {
      throw new Error('Image URI is required');
    }

    // Prepare manipulation actions
    const actions = [];

    // Step 1: Resize if needed (maintains aspect ratio)
    actions.push({
      resize: {
        width: maxWidth,
        height: maxHeight
      }
    });

    // Step 2: Manipulate image (resize + convert to WebP)
    const manipulatedImage = await manipulateAsync(
      imageUri,
      actions,
      {
        compress: quality,
        format: SaveFormat.WEBP, // Convert to WebP
        base64: true // Get base64 string for upload
      }
    );

    // Get file size (approximate from base64)
    const base64Length = manipulatedImage.base64?.length || 0;
    const sizeInBytes = (base64Length * 3) / 4; // Base64 to bytes conversion
    const sizeInKB = (sizeInBytes / 1024).toFixed(2);
    const sizeInMB = (sizeInBytes / 1024 / 1024).toFixed(2);

    console.log('✅ WebP conversion successful!');
    console.log('📐 Dimensions:', `${manipulatedImage.width}x${manipulatedImage.height}`);
    console.log('💾 Size:', sizeInMB > 1 ? `${sizeInMB} MB` : `${sizeInKB} KB`);
    console.log('🎨 Format: WebP');

    return {
      uri: manipulatedImage.uri, // Local file URI (WebP)
      base64: manipulatedImage.base64, // Base64 string (for upload)
      width: manipulatedImage.width,
      height: manipulatedImage.height,
      size: sizeInBytes,
      sizeKB: parseFloat(sizeInKB),
      sizeMB: parseFloat(sizeInMB),
      format: 'webp',
      mimeType: 'image/webp'
    };
  } catch (error) {
    console.error('❌ WebP conversion failed:', error);
    throw new Error(`Image conversion failed: ${error.message}`);
  }
};

/**
 * Convert image from URL (download + convert)
 * 
 * @param {string} imageUrl - Remote image URL
 * @param {Object} options - Conversion options (same as convertToWebP)
 * @returns {Promise<Object>} Converted image data
 */
export const convertUrlToWebP = async (imageUrl, options = {}) => {
  try {
    console.log('🌐 Downloading image from URL...');
    console.log('🔗 URL:', imageUrl);

    // Download image (expo-image-manipulator can handle URLs directly)
    const result = await convertToWebP(imageUrl, options);
    
    return result;
  } catch (error) {
    console.error('❌ URL conversion failed:', error);
    throw new Error(`Failed to convert image from URL: ${error.message}`);
  }
};

/**
 * Convert base64 image to WebP
 * 
 * @param {string} base64String - Base64 image string (with or without data URI prefix)
 * @param {Object} options - Conversion options
 * @returns {Promise<Object>} Converted image data
 */
export const convertBase64ToWebP = async (base64String, options = {}) => {
  try {
    console.log('📄 Converting base64 image to WebP...');
    
    // Ensure base64 has data URI prefix
    let dataUri = base64String;
    if (!base64String.startsWith('data:')) {
      // Detect image type from base64 header (optional)
      dataUri = `data:image/png;base64,${base64String}`;
    }

    const result = await convertToWebP(dataUri, options);
    
    return result;
  } catch (error) {
    console.error('❌ Base64 conversion failed:', error);
    throw new Error(`Failed to convert base64 image: ${error.message}`);
  }
};

/**
 * Get optimized conversion options for different use cases
 */
export const ConversionPresets = {
  // High quality for recipe hero images
  RECIPE_HERO: {
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 0.9,
    compress: true
  },

  // Medium quality for recipe thumbnails
  RECIPE_THUMBNAIL: {
    maxWidth: 600,
    maxHeight: 600,
    quality: 0.85,
    compress: true
  },

  // Small size for profile pictures
  PROFILE_PICTURE: {
    maxWidth: 400,
    maxHeight: 400,
    quality: 0.8,
    compress: true
  },

  // Tiny size for icons/badges
  ICON: {
    maxWidth: 200,
    maxHeight: 200,
    quality: 0.75,
    compress: true
  },

  // AI-generated images (already optimized, just convert)
  AI_GENERATED: {
    maxWidth: 1024,
    maxHeight: 1024,
    quality: 0.85,
    compress: true
  }
};

/**
 * Prepare WebP blob for Supabase upload
 * 
 * @param {Object} convertedImage - Result from convertToWebP
 * @returns {Blob} WebP blob ready for upload
 */
export const prepareWebPBlob = (convertedImage) => {
  try {
    if (!convertedImage.base64) {
      throw new Error('Base64 data is required');
    }

    // Convert base64 to blob
    const base64Data = convertedImage.base64.replace(/^data:image\/\w+;base64,/, '');
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const blob = new Blob([bytes], { type: 'image/webp' });
    
    console.log('✅ WebP blob prepared:', {
      size: `${(blob.size / 1024).toFixed(2)} KB`,
      type: blob.type
    });

    return blob;
  } catch (error) {
    console.error('❌ Blob preparation failed:', error);
    throw new Error(`Failed to prepare WebP blob: ${error.message}`);
  }
};

/**
 * Validate image before conversion
 * 
 * @param {string} imageUri - Image URI to validate
 * @returns {boolean} True if valid
 */
export const validateImage = (imageUri) => {
  if (!imageUri) {
    console.error('❌ Image URI is empty');
    return false;
  }

  // Check if it's a valid URI
  const validPrefixes = ['file://', 'data:', 'http://', 'https://'];
  const isValid = validPrefixes.some(prefix => imageUri.startsWith(prefix));

  if (!isValid) {
    console.error('❌ Invalid image URI format');
    return false;
  }

  return true;
};

/**
 * Get image info without conversion
 * 
 * @param {string} imageUri - Image URI
 * @returns {Promise<Object>} Image metadata
 */
export const getImageInfo = async (imageUri) => {
  try {
    const result = await manipulateAsync(imageUri, [], { format: SaveFormat.PNG });
    return {
      width: result.width,
      height: result.height,
      uri: result.uri
    };
  } catch (error) {
    console.error('❌ Failed to get image info:', error);
    return null;
  }
};

/**
 * Batch convert multiple images to WebP
 * 
 * @param {Array<string>} imageUris - Array of image URIs
 * @param {Object} options - Conversion options
 * @returns {Promise<Array<Object>>} Array of converted images
 */
export const batchConvertToWebP = async (imageUris, options = {}) => {
  try {
    console.log(`🖼️ Batch converting ${imageUris.length} images...`);
    
    const results = await Promise.all(
      imageUris.map(uri => convertToWebP(uri, options))
    );

    console.log(`✅ Batch conversion complete: ${results.length} images`);
    return results;
  } catch (error) {
    console.error('❌ Batch conversion failed:', error);
    throw new Error(`Batch conversion failed: ${error.message}`);
  }
};

export default {
  convertToWebP,
  convertUrlToWebP,
  convertBase64ToWebP,
  prepareWebPBlob,
  validateImage,
  getImageInfo,
  batchConvertToWebP,
  ConversionPresets
};
