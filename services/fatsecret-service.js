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

const getBaseUrl = () => {
  let fromEnv = process.env.EXPO_PUBLIC_FOOD_API_URL;
  fromEnv = normalizeHostForAndroid(fromEnv);
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  if (Platform.OS === 'android') return 'http://10.0.2.2:5001';
  return 'http://127.0.0.1:5001';
};

/**
 * Search for foods by text query
 * @param {string} query - Search term
 * @param {number} page - Page number (0-based)
 * @param {number} maxResults - Max results per page (1-50)
 * @returns {Promise<Object>} FatSecret foods.search response
 */
export async function searchFoods(query, page = 0, maxResults = 20) {
  const base = getBaseUrl();
  const url = `${base}/fatsecret/foods/search?q=${encodeURIComponent(query)}&page=${page}&max_results=${maxResults}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`FatSecret search error ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

/**
 * Get detailed food information by food_id
 * @param {number} foodId - FatSecret food ID
 * @returns {Promise<Object>} FatSecret food.get.v2 response
 */
export async function getFood(foodId) {
  const base = getBaseUrl();
  const url = `${base}/fatsecret/food?id=${encodeURIComponent(foodId)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`FatSecret food.get error ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

/**
 * Lookup food by barcode
 * @param {string} barcode - Barcode value
 * @returns {Promise<Object>} FatSecret food.find_id_for_barcode.v2 response (contains food_id if found)
 */
export async function lookupBarcode(barcode) {
  const base = getBaseUrl();
  const url = `${base}/fatsecret/barcode?barcode=${encodeURIComponent(barcode)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`FatSecret barcode lookup error ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

/**
 * Lookup food by QR code
 * @param {string} qrCode - QR code data
 * @returns {Promise<Object>} FatSecret response (contains food_id if found)
 */
export async function lookupQRCode(qrCode) {
  const base = getBaseUrl();
  const url = `${base}/fatsecret/qr?code=${encodeURIComponent(qrCode)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`FatSecret QR lookup error ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}
