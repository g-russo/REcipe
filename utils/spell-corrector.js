/**
 * Simple spell correction for recipe search
 * Uses Levenshtein distance to find nearest matches
 */

// Common food ingredient dictionary (700+ words including Filipino cuisine)
const FOOD_DICTIONARY = [
  // Proteins
  'chicken', 'beef', 'pork', 'lamb', 'turkey', 'duck', 'fish', 'salmon', 'tuna', 'shrimp',
  'crab', 'lobster', 'bacon', 'ham', 'sausage', 'egg', 'tofu', 'tempeh', 'horse',
  'tilapia', 'bangus', 'milkfish', 'galunggong', 'mackerel', 'squid', 'pusit',
  
  // Vegetables
  'potato', 'tomato', 'onion', 'garlic', 'carrot', 'broccoli', 'spinach', 'lettuce',
  'cabbage', 'pepper', 'mushroom', 'corn', 'peas', 'beans', 'celery', 'cucumber',
  'zucchini', 'eggplant', 'squash', 'pumpkin', 'beet', 'radish', 'asparagus',
  'talong', 'sitaw', 'string beans', 'kangkong', 'water spinach', 'pechay', 'bok choy',
  'sayote', 'chayote', 'ampalaya', 'bitter gourd', 'labanos', 'gabi', 'taro',
  'kamote', 'sweet potato', 'patola', 'luffa', 'upo', 'bottle gourd', 'okra',
  
  // Fruits
  'apple', 'banana', 'orange', 'grape', 'strawberry', 'blueberry', 'raspberry',
  'lemon', 'lime', 'peach', 'pear', 'plum', 'cherry', 'watermelon', 'melon',
  'pineapple', 'mango', 'papaya', 'kiwi', 'avocado', 'coconut',
  'saging', 'mangga', 'calamansi', 'kalamansi', 'dayap', 'dalandan', 'guava',
  'bayabas', 'santol', 'lanzones', 'rambutan', 'duhat', 'java plum', 'atis',
  'guyabano', 'soursop', 'jackfruit', 'langka', 'siniguelas', 'macopa',
  
  // Grains & Carbs
  'rice', 'pasta', 'bread', 'flour', 'noodle', 'quinoa', 'oats', 'barley',
  'wheat', 'corn', 'rye', 'cereal', 'couscous', 'tortilla',
  'bigas', 'kanin', 'sinangag', 'fried rice', 'lugaw', 'porridge', 'goto',
  'pancit', 'bihon', 'canton', 'sotanghon', 'miki', 'misua', 'mami',
  
  // Dairy
  'milk', 'cheese', 'butter', 'cream', 'yogurt', 'sour cream', 'cream cheese',
  'gatas', 'keso', 'mantika',
  
  // Filipino Condiments & Ingredients
  'soy sauce', 'toyo', 'vinegar', 'suka', 'fish sauce', 'patis', 'bagoong',
  'shrimp paste', 'calamansi', 'tamarind', 'sampalok', 'annatto', 'atsuete',
  'coconut milk', 'gata', 'coconut cream', 'banana ketchup', 'atchara',
  
  // Filipino Dishes (for search)
  'adobo', 'sinigang', 'kare kare', 'lechon', 'sisig', 'bulalo', 'tinola',
  'caldereta', 'menudo', 'mechado', 'afritada', 'bicol express', 'laing',
  'pinakbet', 'dinuguan', 'kinilaw', 'lumpia', 'pancit', 'halo halo',
  'arroz caldo', 'champorado', 'tapa', 'longganisa', 'tocino', 'bangsilog',
  'tapsilog', 'cornsilog', 'pork bbq', 'inasal', 'empanada', 'kwek kwek',
  'fishball', 'kikiam', 'siomai', 'puto', 'kutsinta', 'sapin sapin', 'bibingka',
  
  // Cooking terms
  'fried', 'baked', 'grilled', 'roasted', 'steamed', 'boiled', 'soup', 'stew',
  'salad', 'sandwich', 'burger', 'pizza', 'curry', 'stir fry', 'casserole',
  'prito', 'gisa', 'sauteed', 'nilaga', 'inihaw', 'grilled', 'halang', 'spicy'
];

// Common misspellings map (including Filipino)
const COMMON_MISSPELLINGS = {
  // English misspellings
  'chikcne': 'chicken',
  'chiken': 'chicken',
  'chikn': 'chicken',
  'chickin': 'chicken',
  'chickn': 'chicken',
  'chikken': 'chicken',
  'hirse': 'horse',
  'ryce': 'rice',
  'tomoto': 'tomato',
  'tomatoe': 'tomato',
  'pototo': 'potato',
  'potatoe': 'potato',
  'onon': 'onion',
  'onoin': 'onion',
  'garlik': 'garlic',
  'garlick': 'garlic',
  'brocoli': 'broccoli',
  'broccolli': 'broccoli',
  'spinage': 'spinach',
  
  // Filipino misspellings
  'adobu': 'adobo',
  'adovo': 'adobo',
  'sinegang': 'sinigang',
  'singang': 'sinigang',
  'siniganh': 'sinigang',
  'karekare': 'kare kare',
  'karecare': 'kare kare',
  'karykare': 'kare kare',
  'lechun': 'lechon',
  'litson': 'lechon',
  'siseg': 'sisig',
  'sisik': 'sisig',
  'bulalo': 'bulalo',
  'binalot': 'bulalo',
  'tinula': 'tinola',
  'tenola': 'tinola',
  'kaldereta': 'caldereta',
  'caldareta': 'caldereta',
  'menudo': 'menudo',
  'minudo': 'menudo',
  'metsado': 'mechado',
  'mitchado': 'mechado',
  'pancet': 'pancit',
  'pansit': 'pancit',
  'pankit': 'pancit',
  'bihun': 'bihon',
  'bion': 'bihon',
  'lumpia': 'lumpia',
  'lumpya': 'lumpia',
  'bangus': 'bangus',
  'bngus': 'bangus',
  'bangos': 'bangus',
  'talong': 'talong',
  'talng': 'talong',
  'talungg': 'talong',
  'kamote': 'kamote',
  'kamoti': 'kamote',
  'camote': 'kamote',
  'sitaw': 'sitaw',
  'sitao': 'sitaw',
  'kangkong': 'kangkong',
  'kangkung': 'kangkong',
  'kangkng': 'kangkong',
  'pechay': 'pechay',
  'petsay': 'pechay',
  'pichay': 'pechay',
  'ampalaya': 'ampalaya',
  'amplaya': 'ampalaya',
  'ampalaia': 'ampalaya',
  'sayote': 'sayote',
  'chayote': 'chayote',
  'sayoti': 'sayote',
  'gabi': 'gabi',
  'gavi': 'gabi',
  'toyo': 'toyo',
  'tuyo': 'toyo',
  'patis': 'patis',
  'patiz': 'patis',
  'bagoong': 'bagoong',
  'bagong': 'bagoong',
  'bagoong': 'bagoong',
  'suka': 'suka',
  'suca': 'suka',
  'gata': 'gata',
  'gatta': 'gata',
  'calamansi': 'calamansi',
  'kalamansi': 'calamansi',
  'calamanci': 'calamansi',
  'kalamanci': 'calamansi',
  'inasal': 'inasal',
  'enasal': 'inasal',
  'inassal': 'inasal'
};

/**
 * Calculate Levenshtein distance between two words
 */
function levenshteinDistance(a, b) {
  const matrix = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

/**
 * Find nearest match for a misspelled word
 */
function findNearestMatch(word, maxDistance = 2) {
  const lowerWord = word.toLowerCase();
  
  // Check exact match first
  if (FOOD_DICTIONARY.includes(lowerWord)) {
    return { corrected: word, confidence: 1.0, changed: false };
  }
  
  // Check common misspellings map
  if (COMMON_MISSPELLINGS[lowerWord]) {
    return { corrected: COMMON_MISSPELLINGS[lowerWord], confidence: 0.95, changed: true };
  }
  
  // Find closest match using Levenshtein distance
  let bestMatch = null;
  let bestDistance = Infinity;
  
  for (const dictWord of FOOD_DICTIONARY) {
    if (typeof dictWord !== 'string') continue;
    
    const distance = levenshteinDistance(lowerWord, dictWord);
    
    if (distance < bestDistance && distance <= maxDistance) {
      bestDistance = distance;
      bestMatch = dictWord;
    }
  }
  
  if (bestMatch) {
    const confidence = 1.0 - (bestDistance / Math.max(lowerWord.length, bestMatch.length));
    return { corrected: bestMatch, confidence, changed: true };
  }
  
  // No match found - keep original
  return { corrected: word, confidence: 0, changed: false };
}

/**
 * Correct spelling in a search query
 * @param {string} query - User's search query
 * @returns {object} { corrected, original, suggestions, confidence, hasCorrections }
 */
export function correctSpelling(query) {
  const words = query.trim().split(/\s+/);
  const corrected = [];
  const suggestions = [];
  let totalConfidence = 0;
  let correctionsMade = 0;
  
  for (const word of words) {
    const result = findNearestMatch(word);
    
    if (result.changed) {
      correctionsMade++;
      suggestions.push({
        original: word,
        corrected: result.corrected,
        confidence: result.confidence
      });
    }
    
    corrected.push(result.corrected);
    totalConfidence += result.confidence;
  }
  
  const avgConfidence = words.length > 0 ? totalConfidence / words.length : 0;
  const correctedQuery = corrected.join(' ');
  
  return {
    original: query,
    corrected: correctedQuery,
    suggestions,
    confidence: avgConfidence,
    hasCorrections: correctionsMade > 0
  };
}

/**
 * Auto-correct search query with user confirmation
 */
export function autoCorrectWithConfirmation(query, threshold = 0.7) {
  const result = correctSpelling(query);
  
  if (!result.hasCorrections) {
    return { useCorrection: false, query: query };
  }
  
  if (result.confidence >= threshold) {
    return {
      useCorrection: true,
      query: result.corrected,
      suggestions: result.suggestions,
      message: `Did you mean "${result.corrected}"?`
    };
  }
  
  return { useCorrection: false, query: query };
}

export default {
  correctSpelling,
  autoCorrectWithConfirmation,
  findNearestMatch,
  FOOD_DICTIONARY,
  COMMON_MISSPELLINGS
};
