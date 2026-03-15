import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { LogAIResult } from '../utils/logger-utils';

// ✅ Add detailed logging

// TEMPORARY: For Local Testing (uncomment and use your ip when testing locally)
// const API_BASE_URL = 'http://YOUR_IP_ADDRESS:8000';

// ✅ PRODUCTION: Use AWS EC2 Server (comment out when testing locally)
const API_BASE_URL = Constants.expoConfig?.extra?.foodApiUrl || process.env.EXPO_PUBLIC_FOOD_API_URL || 'http://52.65.143.136:8000';

console.log('🔧 ===== API CONFIGURATION =====');
console.log('📍 API_BASE_URL:', API_BASE_URL);
console.log('📱 Platform:', Platform.OS);
console.log('🌐 Constants.expoConfig?.extra?.foodApiUrl:', Constants.expoConfig?.extra?.foodApiUrl);
console.log('🌐 process.env.EXPO_PUBLIC_FOOD_API_URL:', process.env.EXPO_PUBLIC_FOOD_API_URL);
console.log('================================');

/**
 * Manual timeout implementation for fetch
 */
const fetchWithTimeout = (url, options = {}, timeout = 30000) => {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeout)
    )
  ]);
};

/**
 * Test network connectivity
 */
export const testConnection = async () => {
  try {
    console.log('🧪 Testing connection to:', `${API_BASE_URL}/health`);

    const response = await fetchWithTimeout(`${API_BASE_URL}/health`, {}, 10000);

    console.log('✅ Connection test response status:', response.status);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Connection test successful:', data);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Connection test failed:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Recognize food from image
 */
export const recognizeFood = async (imageUri) => {
  try {
    console.log('🔍 ===== FOOD RECOGNITION REQUEST =====');
    console.log('📤 API URL:', `${API_BASE_URL}/recognize-food`);
    console.log('📱 Platform:', Platform.OS);
    console.log('🖼️ Image URI:', imageUri);

    // ✅ FIX: Validate imageUri
    if (!imageUri) {
      throw new Error('No image URI provided');
    }

    // Test connection first
    const connectionTest = await testConnection();
    if (!connectionTest.success) {
      throw new Error(`Server unreachable: ${connectionTest.error}`);
    }

    // ✅ FIX: Determine file extension
    const fileExtension = imageUri.split('.').pop().toLowerCase();
    const mimeType = fileExtension === 'jpg' || fileExtension === 'jpeg'
      ? 'image/jpeg'
      : `image/${fileExtension}`;

    const formData = new FormData();
    formData.append('file', {
      uri: imageUri,
      type: mimeType,
      name: `photo.${fileExtension}`,
    });

    console.log('📦 Sending FormData with:', {
      uri: imageUri,
      type: mimeType,
      name: `photo.${fileExtension}`
    });

    const response = await fetchWithTimeout(
      `${API_BASE_URL}/recognize-food`,
      {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
          // ✅ DO NOT set Content-Type - let fetch handle it
        },
      },
      30000
    );

    console.log('📥 Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error Response:', errorText);
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ API Response:', data);
    return data;
  } catch (error) {
    console.error('❌ Food recognition error:', error);

    if (error.message === 'Request timeout') {
      throw new Error('Server is taking too long to respond. Please try again.');
    } else if (error.message.includes('Network request failed')) {
      throw new Error(`Cannot connect to ${API_BASE_URL}. Please check:\n1. Server is running\n2. You are connected to the internet\n3. Firewall/VPN is not blocking the connection`);
    }

    throw error;
  }
};

/**
 * ✅ NEW: Recognize food from image with combined endpoint (includes ingredients)
 */
export const recognizeFoodCombined = async (imageUri) => {
  try {
    console.log('🔍 ===== COMBINED FOOD RECOGNITION REQUEST =====');
    console.log('📤 API URL:', `${API_BASE_URL}/recognize-food-combined`);
    console.log('📱 Platform:', Platform.OS);
    console.log('🖼️ Image URI:', imageUri);

    if (!imageUri) {
      throw new Error('No image URI provided');
    }

    // Test connection first
    const connectionTest = await testConnection();
    if (!connectionTest.success) {
      throw new Error(`Server unreachable: ${connectionTest.error}`);
    }

    const fileExtension = imageUri.split('.').pop().toLowerCase();
    const mimeType = fileExtension === 'jpg' || fileExtension === 'jpeg'
      ? 'image/jpeg'
      : `image/${fileExtension}`;

    const formData = new FormData();
    formData.append('file', {
      uri: imageUri,
      type: mimeType,
      name: `photo.${fileExtension}`,
    });

    console.log('📦 Sending FormData for Backend Analysis...');

    const response = await fetchWithTimeout(
      `${API_BASE_URL}/recognize-food-combined`,
      {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
      },
      30000
    );

    console.log('📥 Combined Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Combined API Error Response:', errorText);
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    LogAIResult(data, "Combined API Response");
    return data;
  } catch (error) {
    console.error('❌ Combined food recognition error:', error);

    if (error.message === 'Request timeout') {
      throw new Error('Server is taking too long to respond. Please try again.');
    } else if (error.message.includes('Network request failed')) {
      throw new Error(`Cannot connect to ${API_BASE_URL}. Please check:\n1. Server is running\n2. You are connected to the internet\n3. Firewall/VPN is not blocking the connection`);
    }

    throw error;
  }
};

/**
 * Extract text from image using OCR (Tesseract)
 */
export const extractText = async (imageUri) => {
  try {
    console.log('🔍 ===== OCR EXTRACTION REQUEST =====');
    console.log('📤 API URL:', `${API_BASE_URL}/ocr/extract`);
    console.log('📱 Platform:', Platform.OS);
    console.log('🖼️ Image URI:', imageUri);

    // Test connection first
    const connectionTest = await testConnection();
    if (!connectionTest.success) {
      throw new Error(`Server unreachable: ${connectionTest.error}`);
    }

    const formData = new FormData();

    const filename = imageUri.split('/').pop();
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';

    formData.append('file', {
      uri: Platform.OS === 'ios' ? imageUri.replace('file://', '') : imageUri,
      name: filename,
      type: type,
    });

    console.log('📦 Sending FormData for OCR...');
    const response = await fetch(`${API_BASE_URL}/ocr/extract`, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    console.log('📥 OCR Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OCR API Error Response:', errorText);
      throw new Error(`OCR API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ OCR successful:', data);
    return data;
  } catch (error) {
    console.error('❌ OCR extraction error:', error);
    console.error('📋 Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });

    if (error.message === 'Request timeout') {
      throw new Error('OCR is taking too long. Please try again.');
    } else if (error.message.includes('Network request failed')) {
      throw new Error(`Cannot connect to ${API_BASE_URL}. Please check:\n1. Server is running\n2. You are connected to the internet\n3. Firewall/VPN is not blocking the connection`);
    }

    throw error;
  }
};

/**
 * Health check function
 */
export const checkAPIHealth = async () => {
  return testConnection();
};