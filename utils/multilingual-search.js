/**
 * Multilingual Search Utility
 * Maps food terms across different languages (English, Filipino/Tagalog, Spanish)
 * to improve search intelligence and accuracy
 */

// Core food translation map (English as base, with Filipino/Tagalog translations)
const FOOD_TRANSLATIONS = {
  // Proteins - Meats
  'chicken': ['manok', 'pollo'],
  'beef': ['baka', 'carne', 'res'],
  'pork': ['baboy', 'cerdo'],
  'fish': ['isda', 'pescado'],
  'shrimp': ['hipon', 'camaron'],
  'crab': ['alimango', 'cangrejo'],
  'squid': ['pusit', 'calamar'],
  'horse': ['kabayo', 'horse meat'],
  'goat': ['kambing', 'cabra'],
  'lamb': ['kordero', 'cordero'],
  'duck': ['pato', 'pato'],
  
  // Proteins - Seafood
  'milkfish': ['bangus'],
  'tilapia': ['tilapia'],
  'tuna': ['tulingan', 'tuna', 'atun'],
  'mackerel': ['galunggong', 'hasa-hasa'],
  'anchovies': ['dilis', 'tunsoy'],
  
  // Vegetables
  'eggplant': ['talong', 'berenjena'],
  'string beans': ['sitaw', 'habichuelas'],
  'water spinach': ['kangkong', 'kangkung'],
  'cabbage': ['repolyo', 'pechay', 'col'],
  'squash': ['kalabasa', 'calabaza'],
  'bitter melon': ['ampalaya', 'bitter gourd'],
  'okra': ['okra', 'lady finger'],
  'eggplant': ['talong', 'berenjena'],
  'chayote': ['sayote', 'chayote'],
  'taro': ['gabi', 'taro root'],
  'sweet potato': ['kamote', 'batata'],
  'radish': ['labanos', 'rabano'],
  'tomato': ['kamatis', 'tomate'],
  'onion': ['sibuyas', 'cebolla'],
  'garlic': ['bawang', 'ajo'],
  'ginger': ['luya', 'jengibre'],
  'chili': ['sili', 'chile'],
  'pepper': ['paminta', 'pimienta'],
  
  // Fruits
  'banana': ['saging', 'platano'],
  'mango': ['mangga', 'mango'],
  'papaya': ['papaya'],
  'pineapple': ['pinya', 'pina'],
  'coconut': ['niyog', 'coco'],
  'lime': ['calamansi', 'kalamansi', 'lima'],
  'guava': ['bayabas', 'guayaba'],
  'jackfruit': ['langka', 'nangka'],
  'star fruit': ['balimbing'],
  'tamarind': ['sampalok', 'tamarindo'],
  
  // Grains & Staples
  'rice': ['kanin', 'bigas', 'arroz'],
  'noodles': ['pancit', 'pansit', 'fideos'],
  'vermicelli': ['bihon', 'sotanghon'],
  'rice noodles': ['bihon'],
  'glass noodles': ['sotanghon'],
  'bread': ['tinapay', 'pan'],
  
  // Condiments & Sauces
  'soy sauce': ['toyo', 'salsa de soya'],
  'vinegar': ['suka', 'vinagre'],
  'fish sauce': ['patis'],
  'shrimp paste': ['bagoong', 'alamang'],
  'coconut milk': ['gata', 'leche de coco'],
  'annatto': ['atsuete', 'achiote'],
  'salt': ['asin', 'sal'],
  'sugar': ['asukal', 'azucar'],
  
  // Popular Dishes (bidirectional search)
  'adobo': ['adobo', 'chicken adobo', 'pork adobo'],
  'sinigang': ['sinigang', 'sour soup'],
  'kare kare': ['kare kare', 'peanut stew'],
  'lechon': ['lechon', 'roasted pig'],
  'sisig': ['sisig', 'sizzling pork'],
  'bulalo': ['bulalo', 'beef marrow soup'],
  'tinola': ['tinola', 'chicken ginger soup'],
  'caldereta': ['kaldereta', 'caldereta', 'beef stew'],
  'menudo': ['menudo', 'pork stew'],
  'mechado': ['mechado', 'beef stew'],
  'afritada': ['afritada', 'chicken stew'],
  'pochero': ['pochero', 'pork and vegetable stew'],
  'arroz caldo': ['arroz caldo', 'lugaw', 'rice porridge'],
  'pancit': ['pancit', 'pansit', 'fried noodles'],
  
  // Cooking Methods
  'fried': ['prito', 'frito'],
  'boiled': ['nilaga', 'hervido'],
  'grilled': ['inihaw', 'asado'],
  'roasted': ['ihaw', 'inihaw'],
  'steamed': ['singaw', 'vapor'],
  'sauteed': ['ginisa', 'salteado'],
  'sour': ['maasim', 'asim'],
  'spicy': ['maanghang', 'anghang', 'picante'],
  'sweet': ['matamis', 'dulce'],
  'salty': ['maalat', 'salado']
};

/**
 * Normalize a search term by converting to lowercase and removing extra spaces
 */
function normalizeText(text) {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Get all equivalent terms for a given word across all languages
 * @param {string} word - Input word to find translations for
 * @returns {string[]} - Array of equivalent terms (including original)
 */
export function getEquivalentTerms(word) {
  const normalized = normalizeText(word);
  const equivalents = new Set([normalized]);
  
  // Check if word is a key (English base)
  if (FOOD_TRANSLATIONS[normalized]) {
    FOOD_TRANSLATIONS[normalized].forEach(term => equivalents.add(term));
  }
  
  // Check if word is in any translation array (Filipino/Spanish)
  Object.entries(FOOD_TRANSLATIONS).forEach(([english, translations]) => {
    if (translations.some(t => t === normalized)) {
      equivalents.add(english);
      translations.forEach(t => equivalents.add(t));
    }
  });
  
  return Array.from(equivalents);
}

/**
 * Expand a search query to include all language variations
 * @param {string} query - Original search query
 * @returns {Object} - { original, expanded, keywords }
 */
export function expandSearchQuery(query) {
  const normalized = normalizeText(query);
  const words = normalized.split(' ');
  const expandedTerms = new Set();
  const translatedWords = [];
  
  // Process each word
  words.forEach(word => {
    const equivalents = getEquivalentTerms(word);
    translatedWords.push(equivalents);
    equivalents.forEach(term => expandedTerms.add(term));
  });
  
  // Generate expanded search strings
  const expandedQueries = [];
  
  // Original query
  expandedQueries.push(normalized);
  
  // All single-word translations
  expandedTerms.forEach(term => {
    if (term !== normalized && !expandedQueries.includes(term)) {
      expandedQueries.push(term);
    }
  });
  
  // Multi-word combinations (if original query has 2+ words)
  if (words.length > 1) {
    // Try all combinations of first word + second word
    const firstWordVariants = translatedWords[0] || [words[0]];
    const secondWordVariants = translatedWords[1] || [words[1]];
    
    firstWordVariants.forEach(w1 => {
      secondWordVariants.forEach(w2 => {
        const combo = `${w1} ${w2}`;
        if (!expandedQueries.includes(combo)) {
          expandedQueries.push(combo);
        }
      });
    });
  }
  
  return {
    original: query,
    normalized: normalized,
    expanded: expandedQueries,
    keywords: Array.from(expandedTerms),
    hasTranslations: expandedQueries.length > 1
  };
}

/**
 * Get suggested translations for display to user
 * @param {string} query - Search query
 * @returns {Object[]} - Array of { language, term, confidence }
 */
export function getSuggestedTranslations(query) {
  const normalized = normalizeText(query);
  const words = normalized.split(' ');
  const suggestions = [];
  
  words.forEach(word => {
    const equivalents = getEquivalentTerms(word);
    
    // If we found translations
    if (equivalents.length > 1) {
      equivalents.forEach(term => {
        if (term !== word) {
          // Determine language
          let language = 'English';
          if (Object.keys(FOOD_TRANSLATIONS).includes(term)) {
            language = 'English';
          } else {
            // Check if it's Filipino or Spanish based on common patterns
            language = term.includes('ng') || term.includes('ay') ? 'Filipino' : 'Spanish';
          }
          
          suggestions.push({
            original: word,
            translated: term,
            language: language,
            confidence: 0.95
          });
        }
      });
    }
  });
  
  return suggestions;
}

/**
 * Smart search with automatic translation awareness
 * @param {string} query - User's search query
 * @returns {Object} - Enhanced search context with translations
 */
export function enhanceSearchQuery(query) {
  const expansion = expandSearchQuery(query);
  const suggestions = getSuggestedTranslations(query);
  
  console.log('🌐 Multilingual Search Enhancement:');
  console.log('  Original:', expansion.original);
  console.log('  Expanded queries:', expansion.expanded);
  console.log('  Keywords:', expansion.keywords);
  console.log('  Suggestions:', suggestions);
  
  return {
    ...expansion,
    suggestions,
    searchQueries: expansion.expanded, // Use all expanded queries for search
    displayMessage: suggestions.length > 0 
      ? `Searching for "${query}" and related terms in multiple languages...`
      : null
  };
}

// Export the translation map for external use if needed
export const TRANSLATIONS = FOOD_TRANSLATIONS;

export default {
  getEquivalentTerms,
  expandSearchQuery,
  getSuggestedTranslations,
  enhanceSearchQuery,
  TRANSLATIONS
};
