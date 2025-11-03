import { Platform } from 'react-native';

const API_BASE_URL = process.env.EXPO_PUBLIC_FOOD_API_URL || 'http://127.0.0.1:5001';

export async function recognizeFood(imageUri) {
  const formData = new FormData();
  formData.append('file', {
    uri: imageUri,
    type: 'image/jpeg',
    name: 'food.jpg',
  });

  const response = await fetch(`${API_BASE_URL}/recognize`, {
    method: 'POST',
    body: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  if (!response.ok) {
    throw new Error(`Recognition failed: ${response.status}`);
  }

  return response.json();
}