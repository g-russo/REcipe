import { Platform } from 'react-native';

// ✅ Your EC2 public IP
const API_BASE_URL = 'http://54.153.205.43:8000';

export const recognizeFood = async (imageUri) => {
  try {
    console.log('🔍 Sending image to food recognition API...');
    console.log('📍 API URL:', API_BASE_URL);
    
    const formData = new FormData();
    
    // Extract filename from URI
    const filename = imageUri.split('/').pop() || 'photo.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';
    
    formData.append('file', {
      uri: imageUri,
      name: filename,
      type: type,
    });

    console.log('📤 Uploading to:', `${API_BASE_URL}/recognize-food`);

    const response = await fetch(`${API_BASE_URL}/recognize-food`, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json',
      },
      // Don't set Content-Type - let browser/RN set it with boundary
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error Response:', errorText);
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('✅ Food recognition successful:', result);
    return result;
  } catch (error) {
    console.error('❌ Food recognition error:', error);
    throw error;
  }
};

// Health check function
export const checkAPIHealth = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return await response.json();
  } catch (error) {
    console.error('❌ Health check failed:', error);
    return { ok: false, error: error.message };
  }
};