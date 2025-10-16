import { Platform } from 'react-native';

const getBaseUrl = () => {
  const fromEnv = process.env.EXPO_PUBLIC_FOOD_API_URL;
  if (fromEnv) return fromEnv;
  if (Platform.OS === 'android') return 'http://10.0.2.2:5001';
  return 'http://127.0.0.1:5001';
};

export async function classifyImageAsync(uri) {
  const form = new FormData();
  form.append('file', { uri, name: 'image.jpg', type: 'image/jpeg' });

  const base = getBaseUrl();
  console.log('Food API URL:', base);
  const res = await fetch(`${base}/recognize`, { method: 'POST', body: form, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Food API error ${res.status}: ${await res.text().catch(() => '')}`);
  return res.json();
}