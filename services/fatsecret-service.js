import { Platform } from 'react-native';

const normalizeHostForAndroid = (url) => {
  if (Platform.OS !== 'android' || !url) return url;
  try {
    const u = new URL(url);
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
      u.hostname = '10.0.2.2';
      return u.toString();
    }
  } catch {}
  return url;
};

const BASE = process.env.EXPO_PUBLIC_FOOD_API_URL;
const baseUrl = BASE?.replace(/\/+$/, '') || '';

/**
 * Search for foods by text query
 * @param {string} query - Search term
 * @param {number} page - Page number (0-based)
 * @param {number} maxResults - Max results per page (1-50)
 * @returns {Promise<Object>} FatSecret foods.search response
 */
export async function searchFoods(query, page = 0, maxResults = 20) {
  const url = `${baseUrl}/fatsecret/foods/search?q=${encodeURIComponent(query)}&page=${page}&max_results=${maxResults}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FatSecret search error ${res.status}`);
  return res.json();
}

/**
 * Get detailed food information by food_id
 * @param {number} foodId - FatSecret food ID
 * @returns {Promise<Object>} FatSecret food.get.v2 response
 */
export async function getFood(foodId) {
  const url = `${baseUrl}/fatsecret/food?food_id=${foodId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FatSecret food detail error ${res.status}`);
  return res.json();
}

/**
 * Lookup food by barcode
 * @param {string} barcode - Barcode value
 * @returns {Promise<Object>} FatSecret food.find_id_for_barcode.v2 response (contains food_id if found)
 */
export async function lookupBarcode(barcode) {
  const url = `${baseUrl}/fatsecret/barcode?barcode=${encodeURIComponent(barcode)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Barcode lookup failed: ${errorText}`);
  }
  return res.json();
}

/**
 * Lookup food by QR code
 * @param {string} qrCode - QR code data
 * @returns {Promise<Object>} FatSecret response (contains food_id if found)
 */
export async function lookupQRCode(qrCode) {
  const url = `${baseUrl}/fatsecret/qr?qr_code=${encodeURIComponent(qrCode)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`QR lookup error ${res.status}`);
  return res.json();
}

/**
 * Get base URL for the current platform
 */
function getBaseUrl() {
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  if (Platform.OS === 'android') return 'http://10.0.2.2:5001';
  return 'http://127.0.0.1:5001';
}
