import { supabase } from '../lib/supabase';

/**
 * Ingredient Substitution Service
 * Handles smart ingredient substitutions using pantry data and AI suggestions
 * 
 * ✅ KEY BEHAVIORS:
 * 1. ALWAYS honor the user's pantry unit of measurement (g, kg, pcs, lb, etc.)
 * 2. NEVER convert to "pcs" automatically - use the exact unit from inventory
 * 3. ALWAYS ask user how much they want to use (requiresUserInput: true)
 * 4. Better ingredient subtraction: User specifies exact amounts used
 * 
 * Example: If pantry has "500g pork tenderloin", substitution shows "500g" not "1 pcs"
 */

class IngredientSubstitutionService {
  /**
   * Conversion map for whole items to their component parts
   * Example: 1 whole garlic ≈ 10-12 cloves
   */
  wholeToPartConversions = {
    // Garlic conversions
    'garlic': { part: 'clove', ratio: 10 }, // 1 whole garlic ≈ 10 cloves
    'whole garlic': { part: 'clove', ratio: 10 },
    'garlic bulb': { part: 'clove', ratio: 10 },
    'garlic head': { part: 'clove', ratio: 10 },
    
    // Herb conversions (whole plant to sprigs/leaves)
    'rosemary': { part: 'sprig', ratio: 6 }, // 1 whole rosemary ≈ 6 sprigs
    'whole rosemary': { part: 'sprig', ratio: 6 },
    'rosemary bunch': { part: 'sprig', ratio: 6 },
    
    'thyme': { part: 'sprig', ratio: 8 }, // 1 whole thyme ≈ 8 sprigs
    'whole thyme': { part: 'sprig', ratio: 8 },
    'thyme bunch': { part: 'sprig', ratio: 8 },
    
    'basil': { part: 'leaf', ratio: 20 }, // 1 whole basil ≈ 20 leaves
    'whole basil': { part: 'leaf', ratio: 20 },
    'basil bunch': { part: 'leaf', ratio: 20 },
    
    'cilantro': { part: 'sprig', ratio: 10 }, // 1 whole cilantro ≈ 10 sprigs
    'whole cilantro': { part: 'sprig', ratio: 10 },
    'cilantro bunch': { part: 'sprig', ratio: 10 },
    'coriander': { part: 'sprig', ratio: 10 },
    
    'parsley': { part: 'sprig', ratio: 10 }, // 1 whole parsley ≈ 10 sprigs
    'whole parsley': { part: 'sprig', ratio: 10 },
    'parsley bunch': { part: 'sprig', ratio: 10 },
    
    // Onion family
    'ginger': { part: 'inch', ratio: 4 }, // 1 whole ginger ≈ 4 inches
    'whole ginger': { part: 'inch', ratio: 4 },
    'ginger root': { part: 'inch', ratio: 4 },
    
    'lemongrass': { part: 'stalk', ratio: 3 }, // 1 whole lemongrass ≈ 3 stalks
    'whole lemongrass': { part: 'stalk', ratio: 3 },
  };

  /**
   * Get user's pantry items
   * @param {number} userID - User's ID
   * @returns {Promise<Array>} Array of pantry items
   */
  async getUserPantryItems(userID) {
    try {
      const { data: inventories, error: invError } = await supabase
        .from('tbl_inventories')
        .select('"inventoryID"')
        .eq('"userID"', userID);

      if (invError) throw invError;
      if (!inventories || inventories.length === 0) return [];

      const inventoryIDs = inventories.map(inv => inv.inventoryID);

      const today = new Date().toISOString().split('T')[0];

      const { data: items, error } = await supabase
        .from('tbl_items')
        .select('*')
        .in('"inventoryID"', inventoryIDs)
        .gt('quantity', 0) // Only items with quantity > 0
        .or(`itemExpiration.is.null,itemExpiration.gte.${today}`); // Exclude expired items

      if (error) throw error;
      
      console.log(`📦 Fetched ${items?.length || 0} valid pantry items (expired items excluded)`);
      return items || [];
    } catch (error) {
      console.error('Error fetching pantry items:', error);
      return [];
    }
  }

  /**
   * Check which ingredients are missing from pantry
   * @param {Array} recipeIngredients - Recipe ingredients list
   * @param {Array} pantryItems - User's pantry items
   * @returns {Object} { available, missing, insufficient }
   */
  checkIngredientAvailability(recipeIngredients, pantryItems) {
    const available = [];
    const missing = [];
    const insufficient = []; // Not used anymore - user specifies quantity manually

    recipeIngredients.forEach(ingredient => {
      const ingredientText = ingredient.text || ingredient;
      const ingredientName = this.normalizeIngredientName(ingredientText);
      
      // Find matching pantry item
      const pantryItem = pantryItems.find(item => 
        this.fuzzyMatch(this.normalizeIngredientName(item.itemName), ingredientName)
      );

      if (pantryItem) {
        // ✅ Item exists in pantry
        // User will be asked how much they want to use (respecting pantry's unit)
        // No automatic quantity checking or unit conversion
        available.push(ingredient);
      } else {
        missing.push(ingredient);
      }
    });

    return { available, missing, insufficient };
  }

  /**
   * Parse quantity from ingredient text with smart defaults
   * @param {string} text - Ingredient text (e.g., "2 cups flour", "2 chicken", "salt")
   * @param {Array} pantryItems - Optional array of pantry items to check units from
   * @returns {Object|null} { value, unit, descriptors } or null
   */
  parseQuantityFromText(text, pantryItems = []) {
    if (!text) return null;
    
    let lowerText = text.toLowerCase().trim();
    
    // Extract and remove non-standard descriptors (skin-on, boneless, seedless, etc.)
    const nonStandardDescriptors = [
      'skin-on', 'skinless', 'skin on', 'boneless', 'bone-in', 'bone in',
      'seedless', 'seeded', 'pitted', 'unpitted', 'shelled', 'unshelled',
      'peeled', 'unpeeled', 'trimmed', 'untrimmed', 'halved', 'quartered',
      'cubed', 'diced', 'sliced', 'chopped', 'minced', 'ground', 'shredded',
      'fresh', 'frozen', 'canned', 'dried', 'raw', 'cooked', 'roasted',
      'organic', 'free-range', 'wild-caught', 'farm-raised'
    ];
    
    const foundDescriptors = [];
    nonStandardDescriptors.forEach(descriptor => {
      const pattern = new RegExp(`\\b${descriptor.replace('-', '[- ]')}\\b`, 'gi');
      if (pattern.test(lowerText)) {
        foundDescriptors.push(descriptor);
        lowerText = lowerText.replace(pattern, '').trim();
      }
    });
    
    if (foundDescriptors.length > 0) {
      console.log(`📋 Found descriptors in "${text}": [${foundDescriptors.join(', ')}]`);
      console.log(`📋 Cleaned text: "${lowerText}"`);
    }
    
    // 🔥 PRIORITY #1: Check if ingredient exists in pantry and use PANTRY's unit
    // This overrides ANY unit from the recipe (cups, tbsp, etc.)
    if (pantryItems && pantryItems.length > 0) {
      const normalizedIngredient = this.normalizeIngredientName(text);
      
      // Try multiple matching strategies
      let matchingPantryItem = pantryItems.find(item => {
        const normalizedPantryName = this.normalizeIngredientName(item.itemName);
        // Strategy 1: Substring match (both ways)
        if (normalizedIngredient.includes(normalizedPantryName) || 
            normalizedPantryName.includes(normalizedIngredient)) {
          return true;
        }
        // Strategy 2: Word overlap (e.g., "fryer" matches "chicken" via category)
        return false;
      });
      
      // Strategy 3: Check common food synonyms
      if (!matchingPantryItem) {
        const foodSynonyms = {
          'fryer': ['chicken'],
          'broiler': ['chicken'],
          'hen': ['chicken'],
          'roaster': ['chicken'],
          'stewing chicken': ['chicken'],
          'scallion': ['green onion', 'spring onion'],
          'coriander': ['cilantro'],
          'ground meat': ['beef', 'pork', 'chicken'],
        };
        
        for (const [synonym, matches] of Object.entries(foodSynonyms)) {
          if (normalizedIngredient.includes(synonym)) {
            matchingPantryItem = pantryItems.find(item => {
              const normalizedPantryName = this.normalizeIngredientName(item.itemName);
              return matches.some(match => normalizedPantryName.includes(match));
            });
            if (matchingPantryItem) break;
          }
        }
      }
      
      if (matchingPantryItem) {
        // Extract just the quantity from recipe text
        const quantityMatch = lowerText.match(/^(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?)/);
        let value = 1;
        
        if (quantityMatch) {
          const qtyStr = quantityMatch[1].trim();
          // Handle mixed fractions like "3 1/2"
          const parts = qtyStr.split(/\s+/);
          if (parts.length === 2 && parts[1].includes('/')) {
            const whole = parseFloat(parts[0]);
            const [num, denom] = parts[1].split('/');
            value = whole + (parseFloat(num) / parseFloat(denom));
          } else {
            value = parseFloat(qtyStr);
          }
        }
        
        console.log(`📊 Parsed quantity from "${text}": ${value} ${matchingPantryItem.unit} (🔥 USING PANTRY'S UNIT from "${matchingPantryItem.itemName}", ignoring recipe unit) [descriptors: ${foundDescriptors.join(', ') || 'none'}]`);
        return { 
          value, 
          unit: matchingPantryItem.unit, 
          descriptors: foundDescriptors,
          fromPantry: true 
        };
      }
    }
    
    // Special handling: If no quantity specified for certain ingredients, assume 1/2 tbsp
    const defaultHalfTbspIngredients = [
      'salt', 'pepper', 'black pepper', 'white pepper', 'ground pepper',
      'freshly ground pepper', 'freshly ground black pepper',
      'butter', 'oil', 'olive oil', 'vegetable oil', 'canola oil',
      'coconut oil', 'sesame oil', 'avocado oil', 'cooking oil'
    ];
    
    // Check if this ingredient should default to 1/2 tbsp
    const needsDefaultQuantity = defaultHalfTbspIngredients.some(ingredient => 
      lowerText.includes(ingredient) && !/^\d/.test(lowerText) // No number at start
    );
    
    if (needsDefaultQuantity) {
      console.log(`📊 No quantity for "${text}", defaulting to 0.5 tbsp`);
      return { value: 0.5, unit: 'tbsp', descriptors: foundDescriptors };
    }
    
    // PRIORITY 1: Check for WEIGHT/VOLUME measurements in parentheses or anywhere in text
    // Examples: "1 whole chicken (3 1/2 to 4 pounds)" → prefer 3.75 lb (midpoint)
    //           "2 chicken breasts (1lb total)" → use 1 lb
    //           "2 pounds chicken thighs" → use 2 lb
    
    // Pattern 1: Weight in parentheses with ranges: "(3 1/2 to 4 pounds)", "(1-2 kg)"
    const rangeParenPattern = /\((\d+(?:\s+\d+\/\d+)?)\s*(?:to|-)\s*(\d+(?:\s+\d+\/\d+)?)\s*(pound|pounds|lb|lbs|kg|g|oz|ounce|ounces|cup|cups|ml|l)\)/i;
    const rangeParenMatch = lowerText.match(rangeParenPattern);
    
    if (rangeParenMatch) {
      // Convert fractions like "3 1/2" to decimal
      const parseValue = (str) => {
        const parts = str.trim().split(/\s+/);
        if (parts.length === 2 && parts[1].includes('/')) {
          const whole = parseFloat(parts[0]);
          const [num, denom] = parts[1].split('/');
          return whole + (parseFloat(num) / parseFloat(denom));
        } else if (str.includes('/')) {
          const [num, denom] = str.split('/');
          return parseFloat(num) / parseFloat(denom);
        }
        return parseFloat(str);
      };
      
      const min = parseValue(rangeParenMatch[1]);
      const max = parseValue(rangeParenMatch[2]);
      const value = (min + max) / 2; // Use midpoint
      let unit = rangeParenMatch[3].toLowerCase();
      
      // Normalize units
      if (unit === 'pound' || unit === 'pounds' || unit === 'lbs') unit = 'lb';
      if (unit === 'ounce' || unit === 'ounces') unit = 'oz';
      
      console.log(`📊 Parsed quantity from "${text}": ${value} ${unit} (range in parentheses: ${min}-${max}) [descriptors: ${foundDescriptors.join(', ') || 'none'}]`);
      return { value, unit, descriptors: foundDescriptors };
    }
    
    // Pattern 2: Weight in parentheses: "(1lb total)", "(400g)", "(2 pounds)"
    const parenWeightPattern = /\((\d+(?:\s+\d+\/\d+)?(?:\.\d+)?)\s*(pound|pounds|lb|lbs|kg|g|oz|ounce|ounces|ml|l|cup|cups)(?:\s+total)?\)/i;
    const parenWeightMatch = lowerText.match(parenWeightPattern);
    
    if (parenWeightMatch) {
      const parseValue = (str) => {
        const parts = str.trim().split(/\s+/);
        if (parts.length === 2 && parts[1].includes('/')) {
          const whole = parseFloat(parts[0]);
          const [num, denom] = parts[1].split('/');
          return whole + (parseFloat(num) / parseFloat(denom));
        } else if (str.includes('/')) {
          const [num, denom] = str.split('/');
          return parseFloat(num) / parseFloat(denom);
        }
        return parseFloat(str);
      };
      
      const value = parseValue(parenWeightMatch[1]);
      let unit = parenWeightMatch[2].toLowerCase();
      
      if (unit === 'pound' || unit === 'pounds' || unit === 'lbs') unit = 'lb';
      if (unit === 'ounce' || unit === 'ounces') unit = 'oz';
      if (unit === 'liter' || unit === 'liters') unit = 'l';
      
      console.log(`📊 Parsed quantity from "${text}": ${value} ${unit} (weight in parentheses) [descriptors: ${foundDescriptors.join(', ') || 'none'}]`);
      return { value, unit, descriptors: foundDescriptors };
    }
    
    // Pattern 3: Mixed fractions at start: "3 1/2 pounds", "1 1/2 cups"
    const mixedFractionPattern = /^(\d+)\s+(\d+)\/(\d+)\s*(pound|pounds|lb|lbs|kg|g|oz|ounce|ounces|cup|cups|ml|l|liter|liters|tbsp|tsp|tablespoon|tablespoons|teaspoon|teaspoons)\b/i;
    const mixedFractionMatch = lowerText.match(mixedFractionPattern);
    
    if (mixedFractionMatch) {
      const whole = parseFloat(mixedFractionMatch[1]);
      const numerator = parseFloat(mixedFractionMatch[2]);
      const denominator = parseFloat(mixedFractionMatch[3]);
      const value = whole + (numerator / denominator);
      let unit = mixedFractionMatch[4].toLowerCase();
      
      if (unit === 'pound' || unit === 'pounds' || unit === 'lbs') unit = 'lb';
      if (unit === 'ounce' || unit === 'ounces') unit = 'oz';
      if (unit === 'liter' || unit === 'liters') unit = 'l';
      if (unit === 'tablespoon' || unit === 'tablespoons') unit = 'tbsp';
      if (unit === 'teaspoon' || unit === 'teaspoons') unit = 'tsp';
      
      console.log(`📊 Parsed quantity from "${text}": ${value} ${unit} (mixed fraction) [descriptors: ${foundDescriptors.join(', ') || 'none'}]`);
      return { value, unit, descriptors: foundDescriptors };
    }
    
    // Pattern 4: Simple weight at beginning or anywhere: "2 pounds chicken", "400g"
    const weightPattern = /(\d+(?:\.\d+)?)\s*(pound|pounds|lb|lbs|kg|g|oz|ounce|ounces)\b/i;
    const weightMatch = lowerText.match(weightPattern);
    
    if (weightMatch) {
      const value = parseFloat(weightMatch[1]);
      let unit = weightMatch[2].toLowerCase();
      
      if (unit === 'pound' || unit === 'pounds' || unit === 'lbs') unit = 'lb';
      if (unit === 'ounce' || unit === 'ounces') unit = 'oz';
      
      console.log(`📊 Parsed quantity from "${text}": ${value} ${unit} (weight measurement) [descriptors: ${foundDescriptors.join(', ') || 'none'}]`);
      return { value, unit, descriptors: foundDescriptors };
    }
    
    // Pattern 5: Volume measurements
    const volumePattern = /(\d+(?:\.\d+)?)\s*(cup|cups|ml|l|liter|liters|tbsp|tsp|tablespoon|tablespoons|teaspoon|teaspoons)\b/i;
    const volumeMatch = lowerText.match(volumePattern);
    
    if (volumeMatch) {
      const value = parseFloat(volumeMatch[1]);
      let unit = volumeMatch[2].toLowerCase();
      
      if (unit === 'liter' || unit === 'liters') unit = 'l';
      if (unit === 'tablespoon' || unit === 'tablespoons') unit = 'tbsp';
      if (unit === 'teaspoon' || unit === 'teaspoons') unit = 'tsp';
      
      console.log(`📊 Parsed quantity from "${text}": ${value} ${unit} (volume measurement) [descriptors: ${foundDescriptors.join(', ') || 'none'}]`);
      return { value, unit, descriptors: foundDescriptors };
    }
    
    // Pattern 6: Ranges NOT in parentheses (anywhere in text): "3-4 cups", "2 to 3 kg"
    const rangePattern = /(\d+(?:\.\d+)?)\s*(?:to|-)\s*(\d+(?:\.\d+)?)\s*(pound|pounds|lb|lbs|kg|g|oz|ounce|ounces|cup|cups|ml|l|liter|liters|tbsp|tsp|tablespoon|tablespoons|teaspoon|teaspoons)\b/i;
    const rangeMatch = lowerText.match(rangePattern);
    
    if (rangeMatch) {
      const min = parseFloat(rangeMatch[1]);
      const max = parseFloat(rangeMatch[2]);
      const value = (min + max) / 2; // Use midpoint as default
      let unit = rangeMatch[3].toLowerCase();
      
      if (unit === 'pound' || unit === 'pounds' || unit === 'lbs') unit = 'lb';
      if (unit === 'ounce' || unit === 'ounces') unit = 'oz';
      if (unit === 'liter' || unit === 'liters') unit = 'l';
      if (unit === 'tablespoon' || unit === 'tablespoons') unit = 'tbsp';
      if (unit === 'teaspoon' || unit === 'teaspoons') unit = 'tsp';
      
      console.log(`📊 Parsed quantity from "${text}": ${value} ${unit} (range: ${min}-${max}, using midpoint) [descriptors: ${foundDescriptors.join(', ') || 'none'}]`);
      return { 
        value, 
        unit, 
        descriptors: foundDescriptors,
        isRange: true,
        rangeMin: min,
        rangeMax: max
      };
    }
    
    // PRIORITY 2: Standard pattern for quantity at the beginning (as fallback)
    // Examples: "2 cups flour", "1/2 tsp salt", "2 chicken", "3 pieces"
    const pattern = /^(\d+(?:\/\d+)?(?:\.\d+)?)\s*([a-zA-Z]+)?/;
    const match = lowerText.match(pattern);
    
    if (match) {
      let value = match[1];
      // Convert fractions to decimal
      if (value.includes('/')) {
        const [num, denom] = value.split('/');
        value = parseFloat(num) / parseFloat(denom);
      } else {
        value = parseFloat(value);
      }
      
      let unit = match[2] || ''; // Empty string if no unit (e.g., "2 chicken")
      
      // Define all recognized units (measurement + counting)
      const measurementUnits = ['g', 'kg', 'lb', 'lbs', 'pound', 'pounds', 'oz', 'ounce', 'ounces',
                                'ml', 'l', 'liter', 'liters', 'cup', 'cups',
                                'tbsp', 'tsp', 'tablespoon', 'tablespoons', 'teaspoon', 'teaspoons',
                                'fl', 'floz', 'gallon', 'quart', 'pint'];
      
      const countingUnits = ['pcs', 'pieces', 'piece', 'pc', 'each', 'whole', 'item', 'items',
                             'sprig', 'sprigs', 'clove', 'cloves', 'stalk', 'stalks',
                             'leaf', 'leaves', 'pod', 'pods', 'bulb', 'bulbs', 'head', 'heads',
                             'breast', 'breasts', 'fillet', 'fillets', 'thigh', 'thighs',
                             'drumstick', 'drumsticks', 'wing', 'wings', 'egg', 'eggs',
                             'slice', 'slices', 'sheet', 'sheets', 'strip', 'strips',
                             'can', 'cans', 'jar', 'jars', 'bottle', 'bottles', 'pack', 'packs',
                             'bag', 'bags', 'box', 'boxes', 'container', 'containers'];
      
      // Vague/imprecise units that require user specification
      const vagueUnits = ['handful', 'handfuls', 'pinch', 'pinches', 'dash', 'dashes',
                          'splash', 'splashes', 'drizzle', 'bunch', 'bunches',
                          'some', 'few', 'several', 'small', 'medium', 'large'];
      
      const allRecognizedUnits = [...measurementUnits, ...countingUnits, ...vagueUnits];
      
      // Check if the captured "unit" is actually a recognized unit
      // If not (e.g., "chicken", "tomato"), check pantry first, then check if it's a countable food item
      if (unit === '' || !allRecognizedUnits.includes(unit.toLowerCase())) {
        
        // PRIORITY: Check if we have this ingredient in pantry and use PANTRY's unit
        if (pantryItems && pantryItems.length > 0) {
          const normalizedIngredient = this.normalizeIngredientName(text);
          
          const matchingPantryItem = pantryItems.find(item => {
            const normalizedPantryName = this.normalizeIngredientName(item.itemName);
            return normalizedIngredient.includes(normalizedPantryName) || 
                   normalizedPantryName.includes(normalizedIngredient);
          });
          
          if (matchingPantryItem) {
            console.log(`📊 Parsed quantity from "${text}": ${value} ${matchingPantryItem.unit} (using pantry's unit from "${matchingPantryItem.itemName}") [descriptors: ${foundDescriptors.join(', ') || 'none'}]`);
            return { 
              value, 
              unit: matchingPantryItem.unit, 
              descriptors: foundDescriptors,
              fromPantry: true 
            };
          }
        }
        
        // Check if this is a common countable food item
        const countableFoods = ['chicken', 'egg', 'eggs', 'tomato', 'tomatoes', 'potato', 'potatoes',
                                'onion', 'onions', 'carrot', 'carrots', 'apple', 'apples',
                                'banana', 'bananas', 'lemon', 'lemons', 'lime', 'limes',
                                'orange', 'oranges', 'avocado', 'avocados', 'mango', 'mangoes',
                                'peach', 'peaches', 'pear', 'pears', 'plum', 'plums'];
        
        const isCountableFood = countableFoods.some(food => lowerText.includes(food));
        
        // This means we have a number but no explicit/recognized unit (e.g., "2 chicken", "3 eggs")
        // Treat this as pieces/count (LAST RESORT)
        if (unit !== '' || isCountableFood) {
          if (unit !== '') {
            console.log(`📊 Parsed quantity from "${text}": ${value} pcs (food item "${unit}", treating as count) [descriptors: ${foundDescriptors.join(', ') || 'none'}]`);
          } else {
            console.log(`📊 Parsed quantity from "${text}": ${value} pcs (countable food item) [descriptors: ${foundDescriptors.join(', ') || 'none'}]`);
          }
        } else {
          console.log(`📊 Parsed quantity from "${text}": ${value} pcs (implied count) [descriptors: ${foundDescriptors.join(', ') || 'none'}]`);
        }
        unit = 'pcs';
      } else if (vagueUnits.includes(unit.toLowerCase())) {
        // Vague unit - keep it and mark for user input
        console.log(`📊 Parsed quantity from "${text}": ${value} ${unit} (vague unit - user must specify) [descriptors: ${foundDescriptors.join(', ') || 'none'}]`);
        return { value, unit: unit.toLowerCase(), descriptors: foundDescriptors, isVague: true };
      } else if (countingUnits.includes(unit.toLowerCase())) {
        // Normalize all counting units to 'pcs'
        console.log(`📊 Parsed quantity from "${text}": ${value} pcs (normalized from ${match[2]}) [descriptors: ${foundDescriptors.join(', ') || 'none'}]`);
        unit = 'pcs';
      } else {
        // It's a recognized measurement unit, normalize variations to standard forms
        const unitLower = unit.toLowerCase();
        if (unitLower === 'pound' || unitLower === 'pounds') unit = 'lb';
        else if (unitLower === 'ounce' || unitLower === 'ounces') unit = 'oz';
        else if (unitLower === 'liter' || unitLower === 'liters') unit = 'l';
        else if (unitLower === 'tablespoon' || unitLower === 'tablespoons') unit = 'tbsp';
        else if (unitLower === 'teaspoon' || unitLower === 'teaspoons') unit = 'tsp';
        else unit = unitLower; // Keep other recognized units in lowercase
        
        console.log(`📊 Parsed quantity from "${text}": ${value} ${unit} [descriptors: ${foundDescriptors.join(', ') || 'none'}]`);
      }
      
      return { value, unit, descriptors: foundDescriptors };
    }
    
    // If no quantity found, default to 1 pcs
    console.log(`⚠️ No quantity found in "${text}", defaulting to 1 pcs (count)`);
    return { value: 1, unit: 'pcs', descriptors: foundDescriptors };
  }

  /**
   * Normalize ingredient name for comparison
   * @param {string} name - Ingredient name
   * @returns {string} Normalized name
   */
  normalizeIngredientName(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z\s]/g, '') // Remove non-alphabetic characters (numbers, punctuation)
      .replace(/\b(to|or|and|about|approximately|approx)\b/g, '') // Remove quantity connectors
      .replace(/\b(fresh|dried|chopped|minced|sliced|diced|ground|whole|organic|frozen|raw|cooked)\b/g, '') // Remove descriptors
      .replace(/\b(g|kg|lb|lbs|oz|ounce|ounces|ml|l|liter|liters|cup|cups|tbsp|tsp|tablespoon|tablespoons|teaspoon|teaspoons|pcs|pieces|piece|pc)\b/g, '') // Remove measurement units
      .replace(/\b(handful|handfuls|pinch|pinches|dash|dashes|splash|splashes|drizzle|bunch|bunches)\b/g, '') // Remove vague units
      .replace(/\b(pound|pounds|gram|grams|kilogram|kilograms|ounce|ounces|liter|liters|milliliter|milliliters)\b/g, '') // Remove spelled-out units
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .trim();
  }

  /**
   * Convert whole items to their component parts or vice versa
   * @param {number} quantity - Quantity to convert
   * @param {string} fromItem - Source item name (e.g., "whole garlic")
   * @param {string} toItem - Target item name (e.g., "garlic clove")
   * @returns {number|null} Converted quantity or null if no conversion available
   */
  convertWholeToComponent(quantity, fromItem, toItem) {
    const normalizedFrom = this.normalizeIngredientName(fromItem);
    const normalizedTo = this.normalizeIngredientName(toItem);
    
    console.log(`🔄 Checking whole→component conversion:`);
    console.log(`   From: "${normalizedFrom}" (${quantity})`);
    console.log(`   To: "${normalizedTo}"`);
    
    // Check if converting FROM whole TO component (e.g., whole garlic → cloves)
    for (const [wholeName, conversion] of Object.entries(this.wholeToPartConversions)) {
      const matchesWhole = normalizedFrom.includes(wholeName) || wholeName.includes(normalizedFrom);
      const matchesPart = normalizedTo.includes(conversion.part) || conversion.part.includes(normalizedTo);
      
      if (matchesWhole && matchesPart) {
        const converted = quantity * conversion.ratio;
        console.log(`   ✅ Found conversion: 1 ${wholeName} = ${conversion.ratio} ${conversion.part}`);
        console.log(`   ✅ Result: ${quantity} whole → ${converted} ${conversion.part}`);
        return converted;
      }
    }
    
    // Check if converting FROM component TO whole (e.g., cloves → whole garlic)
    for (const [wholeName, conversion] of Object.entries(this.wholeToPartConversions)) {
      const matchesPart = normalizedFrom.includes(conversion.part) || conversion.part.includes(normalizedFrom);
      const matchesWhole = normalizedTo.includes(wholeName) || wholeName.includes(normalizedTo);
      
      if (matchesPart && matchesWhole) {
        const converted = quantity / conversion.ratio;
        console.log(`   ✅ Found conversion: ${conversion.ratio} ${conversion.part} = 1 ${wholeName}`);
        console.log(`   ✅ Result: ${quantity} ${conversion.part} → ${converted} whole`);
        return converted;
      }
    }
    
    console.log(`   ⚠️ No whole↔component conversion found`);
    return null;
  }

  /**
   * Fuzzy match two ingredient names
   * @param {string} a - First ingredient
   * @param {string} b - Second ingredient
   * @returns {boolean} True if match
   */
  fuzzyMatch(a, b) {
    // Direct match
    if (a.includes(b) || b.includes(a)) return true;

    // Check for plural/singular variants
    const singularA = a.replace(/s$/, '');
    const singularB = b.replace(/s$/, '');
    if (singularA === singularB) return true;

    return false;
  }

  /**
   * Get AI-powered substitutions for a missing ingredient
   * Uses OpenAI GPT-4o-mini (SousChef) to suggest intelligent substitutes from pantry
   * @param {string} missingIngredient - The ingredient to substitute
   * @param {Array} pantryItems - User's pantry items
   * @param {string} recipeName - Name of the recipe (for context)
   * @param {string} cookingMethod - Cooking method (e.g., "baking", "frying", "boiling")
   * @param {string} originalIngredientText - Original ingredient text for unit detection
   * @returns {Promise<Array>} Array of suggested substitutes with reasoning
   */
  async getAISubstitutions(missingIngredient, pantryItems, recipeName = '', cookingMethod = '', originalIngredientText = '') {
    try {
      console.log('🤖 SousChef AI: Getting substitutions for:', missingIngredient);
      console.log('📦 Available pantry items:', pantryItems.length);

      if (pantryItems.length === 0) {
        console.log('❌ No pantry items available for substitution');
        return [];
      }

      // Format pantry items for AI with clear structure
      const pantryList = pantryItems.map((item, index) => 
        `${index + 1}. ${item.itemName} - ${item.quantity} ${item.unit || 'pcs'}`
      ).join('\n');

      const prompt = `You are SousChef, a professional culinary AI assistant specializing in ingredient substitutions.

RECIPE CONTEXT:
- Recipe: "${recipeName || 'General cooking'}"
- Missing ingredient: "${missingIngredient}"
- Cooking method: ${cookingMethod || 'not specified'}

AVAILABLE PANTRY ITEMS:
${pantryList}

TASK:
Analyze the available pantry items and suggest the BEST substitutes for "${missingIngredient}". 

IMPORTANT RULES:
1. ONLY suggest items from the pantry list above
2. Use the EXACT item names as written in the pantry list
3. Consider flavor profile, texture, cooking method, and nutritional value
4. Prioritize items with compatible measurement units (weight for weight, volume for volume)
5. Provide practical substitution ratios (e.g., "1:1", "2:1 by weight")
6. Include culturally appropriate suggestions (Filipino and international cuisine knowledge)

RESPONSE FORMAT (valid JSON):
{
  "substitutes": [
    {
      "pantryItemName": "exact name from pantry list",
      "reason": "brief explanation why this substitute works",
      "ratio": "substitution ratio",
      "confidence": 0.95
    }
  ]
}

If no suitable substitutes exist, return: {"substitutes": []}`;

      // Get API key (try EXPO_PUBLIC first, fallback to regular)
      const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
      
      if (!apiKey) {
        console.error('❌ OpenAI API key not found in environment variables');
        throw new Error('OpenAI API key not configured');
      }

      console.log('⏱️ SousChef AI: Analyzing pantry items...');
      const startTime = Date.now();

      // Retry mechanism with exponential backoff
      const maxRetries = 2;
      let response;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`   Attempt ${attempt}/${maxRetries}...`);
          
          // Create abort controller for timeout
          const controller = new AbortController();
          const timeoutDuration = 30000 + (attempt - 1) * 10000; // 30s, 40s, 50s
          const timeoutId = setTimeout(() => {
            console.log(`   ⏱️ Timeout reached (${timeoutDuration/1000}s), aborting...`);
            controller.abort();
          }, timeoutDuration);

          response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            signal: controller.signal,
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                {
                  role: 'system',
                  content: 'You are SousChef, an expert culinary AI assistant specializing in ingredient substitutions. You understand Filipino, Asian, and international cuisines. Always respond in valid JSON format with exact pantry item names.'
                },
                {
                  role: 'user',
                  content: prompt
                }
              ],
              temperature: 0.2, // Lower for more consistent responses
              max_tokens: 800,
              response_format: { type: 'json_object' }
            })
          });

          clearTimeout(timeoutId);
          
          // Success - break retry loop
          if (response.ok) {
            const endTime = Date.now();
            console.log(`✅ SousChef AI responded in ${endTime - startTime}ms (attempt ${attempt})`);
            break;
          }
          
          // HTTP error - check if we should retry
          const errorText = await response.text();
          console.error(`   ❌ HTTP ${response.status}: ${errorText}`);
          
          if (attempt < maxRetries && (response.status === 429 || response.status >= 500)) {
            // Rate limit or server error - wait and retry
            const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s
            console.log(`   ⏳ Waiting ${waitTime/1000}s before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
          
          throw new Error(`OpenAI API error: ${response.status}`);
          
        } catch (fetchError) {
          if (attempt < maxRetries && (fetchError.name === 'AbortError' || fetchError.message?.includes('network'))) {
            console.error(`   ⚠️ Attempt ${attempt} failed: ${fetchError.message}`);
            const waitTime = Math.pow(2, attempt) * 1000;
            console.log(`   ⏳ Waiting ${waitTime/1000}s before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
          throw fetchError;
        }
      }

      if (!response || !response.ok) {
        throw new Error(`SousChef AI request failed after ${maxRetries} attempts`);
      }

      const data = await response.json();
      const result = JSON.parse(data.choices[0].message.content);

      console.log('✅ SousChef suggested', result.substitutes?.length || 0, 'substitutes');

      // Match AI suggestions with actual pantry items
      const matchedSubstitutes = [];
      for (const suggestion of result.substitutes || []) {
        const suggestionName = suggestion.pantryItemName || suggestion.name;
        console.log(`\n🔍 Matching: "${suggestionName}"`);
        
        // Method 1: Direct name match (case-insensitive)
        let pantryItem = pantryItems.find(item => 
          item.itemName.toLowerCase().trim() === suggestionName.toLowerCase().trim()
        );

        // Method 2: Normalized match
        if (!pantryItem) {
          const normalizedSuggestion = this.normalizeIngredientName(suggestionName);
          pantryItem = pantryItems.find(item => {
            const normalizedPantry = this.normalizeIngredientName(item.itemName);
            return normalizedPantry === normalizedSuggestion;
          });
        }

        // Method 3: Fuzzy match (substring)
        if (!pantryItem) {
          const normalizedSuggestion = this.normalizeIngredientName(suggestionName);
          pantryItem = pantryItems.find(item => {
            const normalizedPantry = this.normalizeIngredientName(item.itemName);
            return this.fuzzyMatch(normalizedPantry, normalizedSuggestion);
          });
        }

        if (pantryItem) {
          console.log(`   ✅ Matched to: "${pantryItem.itemName}" (${pantryItem.quantity} ${pantryItem.unit})`);
          matchedSubstitutes.push({
            name: pantryItem.itemName,
            quantity: pantryItem.quantity,
            unit: pantryItem.unit || 'pcs',
            category: pantryItem.itemCategory || 'general',
            reason: suggestion.reason || 'Good substitute based on flavor and texture',
            ratio: suggestion.ratio || '1:1',
            confidence: suggestion.confidence || 0.8,
            itemID: pantryItem.itemID,
            // Store original pantry info for accurate subtraction
            originalQuantityInPantry: pantryItem.quantity,
            originalUnitInPantry: pantryItem.unit,
            requiresUserInput: true
          });
        } else {
          console.log(`   ❌ Not found in pantry: "${suggestionName}"`);
        }
      }

      console.log(`\n📊 SousChef AI: ${matchedSubstitutes.length}/${result.substitutes?.length || 0} substitutes matched`);
      
      if (matchedSubstitutes.length > 0) {
        return matchedSubstitutes;
      }
      
      // If AI gave suggestions but none matched, fall back to rule-based
      console.log('⚠️ AI suggestions did not match pantry items, using rule-based fallback');
      return this.findSubstitutes(missingIngredient, pantryItems, originalIngredientText);
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error('⏱️ SousChef AI timeout - using fallback');
      } else if (error.message?.includes('Network request failed')) {
        console.error('❌ Network error - using fallback:', error.message);
      } else if (error.message?.includes('API key')) {
        console.error('❌ OpenAI API key issue - using fallback');
      } else {
        console.error('❌ SousChef AI error:', error.message);
      }
      
      // ALWAYS provide a fallback - never return empty
      console.log('⚠️ SousChef AI unavailable, using rule-based substitution engine');
      return this.findSubstitutes(missingIngredient, pantryItems, originalIngredientText);
    }
  }

  /**
   * Get smart substitutions for missing ingredients using pantry
   * @param {Array} missingIngredients - Missing ingredients
   * @param {Array} pantryItems - User's pantry items
   * @returns {Promise<Object>} Substitution suggestions
   */
  async getSmartSubstitutions(missingIngredients, pantryItems) {
    const substitutions = {};

    for (const ingredient of missingIngredients) {
      const ingredientName = this.normalizeIngredientName(ingredient.text || ingredient);
      const suggestions = this.findSubstitutes(ingredientName, pantryItems);
      
      if (suggestions.length > 0) {
        substitutions[ingredient.text || ingredient] = suggestions;
      }
    }

    return substitutions;
  }

  /**
   * Find substitute ingredients from pantry (PREFERS measured over counted items)
   * @param {string} ingredientName - Ingredient to substitute
   * @param {Array} pantryItems - User's pantry items
   * @param {string} originalIngredientText - Original ingredient text to detect measurement system
   * @returns {Array} Suggested substitutes (sorted by preference, with proper unit conversion)
   */
  findSubstitutes(ingredientName, pantryItems, originalIngredientText = '') {
    const substitutionRules = this.getSubstitutionRules();
    const suggestions = [];

    // Parse the original ingredient to check if it uses a vague unit and detect required unit type
    let preferredSystem = 'none';
    let hasVagueUnit = false;
    let recipeRequiresWeight = false;
    let recipeRequiresVolume = false;
    let recipeRequiresCount = false;
    
    if (originalIngredientText) {
      const parsedOriginal = this.parseQuantityFromText(originalIngredientText, pantryItems);
      
      if (parsedOriginal) {
        hasVagueUnit = parsedOriginal.isVague || false;
        
        if (parsedOriginal.unit && !hasVagueUnit) {
          preferredSystem = this.detectMeasurementSystem(parsedOriginal.unit);
          console.log(`🌍 Recipe prefers "${preferredSystem}" system (from "${originalIngredientText}")`);
          
          // Determine what type of measurement the recipe requires
          const weightUnits = ['kg', 'g', 'gram', 'grams', 'kilogram', 'kilograms', 'lb', 'lbs', 'pound', 'pounds', 'oz', 'ounce', 'ounces'];
          const volumeUnits = ['l', 'liter', 'liters', 'ml', 'milliliter', 'milliliters', 'cup', 'cups', 'tbsp', 'tsp', 'tablespoon', 'tablespoons', 'teaspoon', 'teaspoons'];
          const countUnits = ['pcs', 'pc', 'piece', 'pieces', 'whole', 'each', 'count'];
          
          const unitLower = parsedOriginal.unit.toLowerCase();
          recipeRequiresWeight = weightUnits.includes(unitLower);
          recipeRequiresVolume = volumeUnits.includes(unitLower);
          recipeRequiresCount = countUnits.includes(unitLower);
          
          console.log(`📊 Recipe unit type: weight=${recipeRequiresWeight}, volume=${recipeRequiresVolume}, count=${recipeRequiresCount}`);
        }
      }
    }

    // Check predefined substitution rules
    for (const [category, items] of Object.entries(substitutionRules)) {
      if (items.some(item => ingredientName.includes(item.toLowerCase()))) {
        console.log(`\n🔍 Recipe ingredient "${ingredientName}" matches category "${category}"`);
        console.log(`   Checking ${pantryItems.length} pantry items...`);
        
        // Find pantry items in the same category
        const categorySubstitutes = pantryItems.filter(pantryItem => {
          const normalizedPantryName = this.normalizeIngredientName(pantryItem.itemName);
          const matchesCategory = items.some(item => 
            normalizedPantryName.includes(item.toLowerCase())
          );
          
          if (!matchesCategory) {
            console.log(`   ⏭️  "${pantryItem.itemName}" - not in category`);
            return false;
          }
          
          console.log(`   🎯 "${pantryItem.itemName}" matches category! Checking unit compatibility...`);
          
          // ✅ KEY FIX: Check unit compatibility - don't suggest kg chicken when recipe needs pcs chicken
          // ONLY filter if the recipe has a specific unit requirement
          if (recipeRequiresWeight || recipeRequiresVolume || recipeRequiresCount) {
            const pantryUnit = pantryItem.unit?.toLowerCase() || 'pcs';
            const weightUnits = ['kg', 'g', 'gram', 'grams', 'kilogram', 'kilograms', 'lb', 'lbs', 'pound', 'pounds', 'oz', 'ounce', 'ounces'];
            const volumeUnits = ['l', 'liter', 'liters', 'ml', 'milliliter', 'milliliters', 'cup', 'cups', 'tbsp', 'tsp', 'tablespoon', 'tablespoons', 'teaspoon', 'teaspoons'];
            const countUnits = ['pcs', 'pc', 'piece', 'pieces', 'whole', 'each', 'count', ''];
            
            const pantryHasWeight = weightUnits.includes(pantryUnit);
            const pantryHasVolume = volumeUnits.includes(pantryUnit);
            const pantryHasCount = countUnits.includes(pantryUnit);
            
            console.log(`      Recipe requires: weight=${recipeRequiresWeight}, volume=${recipeRequiresVolume}, count=${recipeRequiresCount}`);
            console.log(`      Pantry has: "${pantryUnit}" (weight=${pantryHasWeight}, volume=${pantryHasVolume}, count=${pantryHasCount})`);
            
            // Only allow substitution if unit types match
            if (recipeRequiresWeight && !pantryHasWeight) {
              console.log(`      ❌ REJECTED: recipe needs weight, pantry has ${pantryHasVolume ? 'volume' : 'count'}`);
              return false;
            }
            if (recipeRequiresVolume && !pantryHasVolume) {
              console.log(`      ❌ REJECTED: recipe needs volume, pantry has ${pantryHasWeight ? 'weight' : 'count'}`);
              return false;
            }
            if (recipeRequiresCount && !pantryHasCount) {
              console.log(`      ❌ REJECTED: recipe needs count, pantry has ${pantryHasWeight ? 'weight' : 'volume'}`);
              return false;
            }
            
            console.log(`      ✅ ACCEPTED: unit types are compatible!`);
          } else {
            console.log(`      ℹ️  No specific unit requirement, accepting all units`);
          }
          
          return true;
        });

        suggestions.push(...categorySubstitutes.map(item => {
          // ✅ ALWAYS honor pantry's original unit of measurement
          // Don't convert or use "pcs" - use exactly what's in the user's inventory
          console.log(`   ✅ Using pantry's unit "${item.unit}" for "${item.itemName}" (unit type matches recipe requirement)`);
          
          return {
            name: item.itemName,
            category: category,
            quantity: item.quantity, // Show available quantity in pantry's original unit
            unit: item.unit, // Always use pantry's original unit (g, kg, pcs, etc.)
            originalQuantityInPantry: item.quantity,
            originalUnitInPantry: item.unit,
            confidence: 'high',
            hasMeasurement: this.hasMeasurementUnit(item.unit),
            conversionApplied: false,
            requiresUserInput: true, // ✅ ALWAYS ask user how much they want to use
            vagueMeasurement: originalIngredientText
          };
        }));
      }
    }

    // If no substitutes found, suggest similar items from pantry
    if (suggestions.length === 0) {
      const similar = pantryItems
        .filter(item => {
          const itemName = this.normalizeIngredientName(item.itemName);
          const matchesSimilar = itemName.length > 3 && ingredientName.includes(itemName.substring(0, 3));
          
          if (!matchesSimilar) return false;
          
          // ✅ Apply same unit compatibility check for similar items
          if (recipeRequiresWeight || recipeRequiresVolume || recipeRequiresCount) {
            const pantryUnit = item.unit?.toLowerCase() || 'pcs';
            const weightUnits = ['kg', 'g', 'gram', 'grams', 'kilogram', 'kilograms', 'lb', 'lbs', 'pound', 'pounds', 'oz', 'ounce', 'ounces'];
            const volumeUnits = ['l', 'liter', 'liters', 'ml', 'milliliter', 'milliliters', 'cup', 'cups', 'tbsp', 'tsp', 'tablespoon', 'tablespoons', 'teaspoon', 'teaspoons'];
            const countUnits = ['pcs', 'pc', 'piece', 'pieces', 'whole', 'each', 'count', ''];
            
            const pantryHasWeight = weightUnits.includes(pantryUnit);
            const pantryHasVolume = volumeUnits.includes(pantryUnit);
            const pantryHasCount = countUnits.includes(pantryUnit);
            
            if ((recipeRequiresWeight && !pantryHasWeight) ||
                (recipeRequiresVolume && !pantryHasVolume) ||
                (recipeRequiresCount && !pantryHasCount)) {
              console.log(`   ❌ Skipping similar item "${item.itemName}" (${pantryUnit}): unit type incompatible`);
              return false;
            }
          }
          
          return true;
        })
        .map(item => {
          // ✅ ALWAYS honor pantry's original unit for similar items too
          console.log(`   ✅ Using pantry's unit "${item.unit}" for similar item "${item.itemName}" (unit type matches)`);
          
          return {
            name: item.itemName,
            category: 'similar',
            quantity: item.quantity, // Use pantry's original quantity
            unit: item.unit, // Always use pantry's original unit (g, kg, pcs, etc.)
            originalQuantityInPantry: item.quantity,
            originalUnitInPantry: item.unit,
            confidence: 'medium',
            hasMeasurement: this.hasMeasurementUnit(item.unit),
            conversionApplied: false,
            requiresUserInput: true, // ✅ ALWAYS ask user how much they want to use
            vagueMeasurement: originalIngredientText
          };
        });

      suggestions.push(...similar);
    }

    // PRIORITY SORT: Prefer measured items (kg, g, lb, oz) over counted items (pcs, pieces)
    suggestions.sort((a, b) => {
      // First priority: items with measurements
      if (a.hasMeasurement && !b.hasMeasurement) return -1;
      if (!a.hasMeasurement && b.hasMeasurement) return 1;
      
      // Second priority: confidence level
      const confidenceOrder = { high: 0, medium: 1, low: 2 };
      return confidenceOrder[a.confidence] - confidenceOrder[b.confidence];
    });

    console.log(`🔄 Substitutes for "${ingredientName}":`, suggestions.map(s => 
      `${s.name} (${s.quantity} ${s.unit || 'count'}) ${s.hasMeasurement ? '✅ measured' : '⚠️ counted'}`
    ));

    return suggestions.slice(0, 10); // Limit to 10 suggestions
  }

  /**
   * Check if a unit represents a measurement (weight/volume) rather than counting
   * @param {string} unit - Unit to check
   * @returns {boolean} True if measurement unit
   */
  hasMeasurementUnit(unit) {
    if (!unit || unit.trim() === '') return false;
    
    const measurementUnits = [
      // Weight
      'kg', 'g', 'gram', 'grams', 'kilogram', 'kilograms',
      'lb', 'lbs', 'pound', 'pounds', 'oz', 'ounce', 'ounces',
      // Volume
      'l', 'liter', 'liters', 'ml', 'milliliter', 'milliliters',
      'cup', 'cups', 'tbsp', 'tablespoon', 'tablespoons',
      'tsp', 'teaspoon', 'teaspoons', 'fl oz', 'gallon', 'quart', 'pint'
    ];
    
    const lowerUnit = unit.toLowerCase().trim();
    return measurementUnits.includes(lowerUnit);
  }

  /**
   * Detect if a unit is metric or imperial
   * @param {string} unit - Unit to check
   * @returns {string} 'metric', 'imperial', or 'none'
   */
  detectMeasurementSystem(unit) {
    if (!unit || unit.trim() === '') return 'none';
    
    const lowerUnit = unit.toLowerCase().trim();
    
    // Counting units (pcs, etc.) are not metric or imperial
    if (lowerUnit === 'pcs') return 'none';
    
    const metricUnits = ['kg', 'g', 'gram', 'grams', 'kilogram', 'kilograms', 
                          'l', 'liter', 'liters', 'ml', 'milliliter', 'milliliters'];
    
    const imperialUnits = ['lb', 'lbs', 'pound', 'pounds', 'oz', 'ounce', 'ounces',
                           'cup', 'cups', 'tbsp', 'tablespoon', 'tablespoons',
                           'tsp', 'teaspoon', 'teaspoons', 'fl oz', 'gallon', 'quart', 'pint'];
    
    if (metricUnits.includes(lowerUnit)) return 'metric';
    if (imperialUnits.includes(lowerUnit)) return 'imperial';
    return 'none';
  }

  /**
   * Get a suitable target unit in the recipe's preferred system
   * @param {string} pantryUnit - Unit from pantry
   * @param {string} preferredSystem - 'metric' or 'imperial'
   * @returns {string} Target unit to convert to
   */
  getTargetUnitInSystem(pantryUnit, preferredSystem) {
    if (!pantryUnit || pantryUnit.trim() === '') return '';
    
    const lowerUnit = pantryUnit.toLowerCase().trim();
    
    // If pantry already uses preferred system, keep it
    const pantrySystem = this.detectMeasurementSystem(pantryUnit);
    if (pantrySystem === preferredSystem) return pantryUnit;
    
    // Weight conversions
    const weightUnits = ['kg', 'g', 'gram', 'grams', 'kilogram', 'kilograms', 
                         'lb', 'lbs', 'pound', 'pounds', 'oz', 'ounce', 'ounces'];
    
    // Volume conversions  
    const volumeUnits = ['l', 'liter', 'liters', 'ml', 'milliliter', 'milliliters',
                         'cup', 'cups', 'tbsp', 'tablespoon', 'tablespoons',
                         'tsp', 'teaspoon', 'teaspoons', 'fl oz', 'gallon', 'quart', 'pint'];
    
    const isWeight = weightUnits.includes(lowerUnit);
    const isVolume = volumeUnits.includes(lowerUnit);
    
    if (preferredSystem === 'metric') {
      if (isWeight) return 'g'; // Convert imperial weight to grams
      if (isVolume) return 'ml'; // Convert imperial volume to ml
    } else if (preferredSystem === 'imperial') {
      if (isWeight) return 'oz'; // Convert metric weight to oz
      if (isVolume) return 'cup'; // Convert metric volume to cups
    }
    
    return pantryUnit; // Fallback to original unit
  }

  /**
   * Get substitution rules (category-based)
   * @returns {Object} Substitution rules
   */
  getSubstitutionRules() {
    return {
      'Protein': [
        'chicken', 'beef', 'pork', 'tofu', 'tempeh', 'turkey', 'lamb',
        'fish', 'salmon', 'tuna', 'shrimp', 'prawns', 'seafood', 'crab', 'lobster',
        'eggs', 'chickpeas', 'lentils', 'black beans', 'mushrooms', 'seitan'
      ],
      'Dairy': [
        'milk', 'cream', 'butter', 'cheese', 'yogurt', 'sour cream',
        'coconut milk', 'almond milk', 'oat milk'
      ],
      'Seasoning': [
        'salt', 'soy sauce', 'fish sauce', 'worcestershire sauce',
        'vinegar', 'lemon juice', 'lime juice'
      ],
      'Oil': [
        'olive oil', 'vegetable oil', 'coconut oil', 'butter',
        'canola oil', 'avocado oil', 'sesame oil'
      ],
      'Sweetener': [
        'sugar', 'honey', 'maple syrup', 'agave', 'brown sugar',
        'coconut sugar', 'stevia'
      ],
      'Grain': [
        'rice', 'pasta', 'noodles', 'quinoa', 'couscous',
        'bread', 'tortilla', 'wraps'
      ],
      'Vegetable': [
        'onion', 'garlic', 'tomato', 'pepper', 'carrot', 'celery',
        'lettuce', 'spinach', 'kale', 'cabbage', 'broccoli'
      ]
    };
  }

  /**
   * Use SousChef AI to categorize ingredients for smart subtraction
   * AI determines: auto-subtract (solid weight items) vs needs confirmation (condiments/liquids)
   * @param {Array} usedIngredients - Ingredients used in cooking
   * @param {Array} pantryItems - User's pantry items
   * @returns {Promise<Object>} Categorization result
   */
  async categorizeIngredientsForSubtraction(usedIngredients, pantryItems) {
    try {
      console.log('🤖 SousChef AI: Categorizing ingredients for subtraction...');
      
      // Format ingredients for AI
      const ingredientsList = usedIngredients.map((ing, index) => 
        `${index + 1}. ${ing.name || ing.text} - ${ing.quantity || 1} ${ing.unit || 'pcs'}`
      ).join('\n');

      const prompt = `You are SousChef, an AI assistant managing kitchen pantry subtraction.

USED INGREDIENTS:
${ingredientsList}

TASK: Categorize each ingredient into two groups:

1. AUTO-SUBTRACT: Solid food items measured by WEIGHT (kg, g, lb, oz)
   - Examples: chicken, beef, pork, vegetables, fruits, rice, pasta
   - These can be accurately tracked by weight

2. NEEDS CONFIRMATION: Condiments, liquids, seasonings, oils
   - Examples: salt, pepper, soy sauce, vinegar, oil, butter, milk, sugar, spices
   - User should confirm if fully consumed or still has some left

RULES:
- Only weight-based solid foods (kg, g, lb, oz) go to AUTO-SUBTRACT
- ALL condiments, liquids, seasonings, oils go to NEEDS CONFIRMATION
- Small measurement items (tbsp, tsp, cup, ml, pinch) always need confirmation
- When in doubt, prefer NEEDS CONFIRMATION for user control

RESPONSE FORMAT (valid JSON):
{
  "autoSubtract": [
    {"ingredientIndex": 0, "reason": "solid food with weight measurement"}
  ],
  "needsConfirmation": [
    {"ingredientIndex": 1, "reason": "condiment/seasoning"}
  ]
}`;

      const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
      
      if (!apiKey) {
        console.warn('⚠️ OpenAI API key not found, using fallback categorization');
        return this.fallbackCategorization(usedIngredients);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are SousChef, an expert culinary AI assistant specializing in kitchen pantry management. Always respond in valid JSON format.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.2,
          max_tokens: 500,
          response_format: { type: 'json_object' }
        })
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`SousChef AI error: ${response.status}`);
      }

      const data = await response.json();
      const result = JSON.parse(data.choices[0].message.content);

      console.log('✅ SousChef categorization complete');
      console.log(`   Auto-subtract: ${result.autoSubtract?.length || 0} items`);
      console.log(`   Needs confirmation: ${result.needsConfirmation?.length || 0} items`);

      // Map indices back to actual ingredients
      const needsConfirmation = (result.needsConfirmation || []).map(item => {
        const ing = usedIngredients[item.ingredientIndex];
        return {
          name: ing.name || ing.text,
          quantity: ing.quantity || 1,
          unit: ing.unit || 'pcs',
          reason: item.reason
        };
      });

      return {
        autoSubtractIndices: (result.autoSubtract || []).map(item => item.ingredientIndex),
        needsConfirmation
      };

    } catch (error) {
      console.error('❌ SousChef categorization error:', error.message);
      console.log('⚠️ Using fallback categorization');
      return this.fallbackCategorization(usedIngredients);
    }
  }

  /**
   * Fallback categorization when AI is unavailable
   * @param {Array} usedIngredients - Ingredients used
   * @returns {Object} Categorization result
   */
  fallbackCategorization(usedIngredients) {
    const weightUnits = ['kg', 'g', 'gram', 'grams', 'kilogram', 'kilograms', 
                         'lb', 'lbs', 'pound', 'pounds', 'oz', 'ounce', 'ounces'];
    
    const condimentKeywords = ['salt', 'pepper', 'oil', 'sauce', 'vinegar', 'butter', 
                                'milk', 'cream', 'sugar', 'honey', 'syrup', 'spice',
                                'seasoning', 'condiment', 'mayo', 'ketchup', 'mustard'];

    const autoSubtractIndices = [];
    const needsConfirmation = [];

    usedIngredients.forEach((ing, index) => {
      const unit = (ing.unit || '').toLowerCase().trim();
      const name = (ing.name || ing.text || '').toLowerCase();
      
      const isWeightBased = weightUnits.includes(unit);
      const isCondiment = condimentKeywords.some(keyword => name.includes(keyword));

      if (isWeightBased && !isCondiment) {
        autoSubtractIndices.push(index);
      } else {
        needsConfirmation.push({
          name: ing.name || ing.text,
          quantity: ing.quantity || 1,
          unit: ing.unit || 'pcs',
          reason: isCondiment ? 'condiment/seasoning' : 'non-weight measurement'
        });
      }
    });

    console.log(`📊 Fallback categorization: ${autoSubtractIndices.length} auto-subtract, ${needsConfirmation.length} needs confirmation`);

    return { autoSubtractIndices, needsConfirmation };
  }

  /**
   * Subtract used ingredients from pantry using SousChef AI
   * AI determines which items should be auto-subtracted (weight-based) vs need confirmation (condiments)
   * @param {number} userID - User's ID
   * @param {Array} usedIngredients - Ingredients used (with quantities and units)
   * @returns {Promise<Object>} Update result with items needing confirmation
   */
  async subtractIngredientsFromPantry(userID, usedIngredients) {
    try {
      console.log('🔄 Starting SousChef AI pantry subtraction...');
      console.log('📦 Ingredients to subtract:', usedIngredients.map(i => ({
        name: i.name,
        quantity: i.quantity,
        unit: i.unit
      })));
      
      const pantryItems = await this.getUserPantryItems(userID);
      console.log(`📋 Found ${pantryItems.length} pantry items`);
      
      // Use SousChef AI to categorize ingredients for smart subtraction
      const categorization = await this.categorizeIngredientsForSubtraction(usedIngredients, pantryItems);
      
      const updates = [];
      const needsConfirmation = categorization.needsConfirmation || [];

      for (let index = 0; index < usedIngredients.length; index++) {
        const ingredient = usedIngredients[index];
        const ingredientName = this.normalizeIngredientName(ingredient.text || ingredient.name);
        console.log(`\n🔍 Processing ingredient ${index + 1}: "${ingredient.text || ingredient.name}"`);
        console.log(`   Normalized name: "${ingredientName}"`);
        console.log(`   Quantity: ${ingredient.quantity || 1}, Unit: "${ingredient.unit || 'none'}"`);
        
        // Find matching pantry item
        const pantryItem = pantryItems.find(item => 
          this.fuzzyMatch(this.normalizeIngredientName(item.itemName), ingredientName)
        );
        
        // Check if SousChef AI marked this for auto-subtraction
        const shouldAutoSubtract = categorization.autoSubtractIndices.includes(index);
        console.log(`   SousChef decision: ${shouldAutoSubtract ? '✅ Auto-subtract' : '⚠️ Needs confirmation'}`);

        if (pantryItem) {
          console.log(`   ✓ Found in pantry: "${pantryItem.itemName}"`);
          console.log(`   Pantry quantity: ${pantryItem.quantity}, Unit: "${pantryItem.unit || 'none'}"`);
          
          // If AI says needs confirmation, skip auto-subtraction
          if (!shouldAutoSubtract) {
            console.log(`   ⚠️ SousChef AI: Item needs user confirmation before removal`);
            // Already added to needsConfirmation by AI
            continue;
          }
          
          let quantityToSubtract = ingredient.quantity || 1;
          let conversionApplied = false;
          
          // If units are provided and different, convert back to pantry units
          if (ingredient.unit && pantryItem.unit && ingredient.unit.trim() !== '' && pantryItem.unit.trim() !== '') {
            const pantryUnit = ingredient.originalUnitInPantry || pantryItem.unit;
            const usedUnit = ingredient.unit;
            
            console.log(`   Units check: pantry="${pantryUnit}", used="${usedUnit}"`);
            
            if (pantryUnit.toLowerCase() !== usedUnit.toLowerCase()) {
              console.log(`   🔄 Converting ${quantityToSubtract} ${usedUnit} to ${pantryUnit}...`);
              // Convert used quantity back to pantry units
              const converted = this.convertUnit(
                quantityToSubtract,
                usedUnit,
                pantryUnit
              );
              
              // Only use converted value if conversion was successful (not same as input)
              if (converted !== quantityToSubtract || usedUnit.toLowerCase() === pantryUnit.toLowerCase()) {
                console.log(`   ✓ Converted: ${quantityToSubtract} → ${converted}`);
                quantityToSubtract = converted;
                conversionApplied = true;
              } else {
                console.log(`   ⚠️ Conversion not available, using original value`);
              }
            } else {
              console.log(`   ✓ Units match, no conversion needed`);
            }
          } else {
            console.log(`   ℹ️ No unit conversion (ingredient unit: "${ingredient.unit || 'none'}", pantry unit: "${pantryItem.unit || 'none'}")`);
          }
          
          // If no standard unit conversion worked, try whole↔component conversion
          // Example: Recipe needs "3 cloves garlic", pantry has "1 whole garlic"
          // This applies to counting units (pcs) or items without measurement units
          if (!conversionApplied && (ingredient.unit === 'pcs' || pantryItem.unit === 'pcs' || 
                                      !this.hasMeasurementUnit(ingredient.unit) || 
                                      !this.hasMeasurementUnit(pantryItem.unit))) {
            const usedItemName = ingredient.name || ingredient.text || '';
            const pantryItemName = pantryItem.itemName || '';
            
            console.log(`   🔍 Checking whole↔component conversion...`);
            const wholeToPartQty = this.convertWholeToComponent(
              pantryItem.quantity,
              pantryItemName,
              usedItemName
            );
            
            if (wholeToPartQty !== null) {
              // Pantry has whole, recipe needs parts (e.g., 1 whole garlic → 10 cloves)
              // Check if we have enough
              if (wholeToPartQty >= quantityToSubtract) {
                // Calculate how many "whole" items to subtract
                const conversion = Object.entries(this.wholeToPartConversions).find(([wholeName, conv]) => {
                  const normalizedPantry = this.normalizeIngredientName(pantryItemName);
                  return normalizedPantry.includes(wholeName) || wholeName.includes(normalizedPantry);
                });
                
                if (conversion) {
                  const [wholeName, convData] = conversion;
                  // How many whole items do we need to use?
                  quantityToSubtract = quantityToSubtract / convData.ratio;
                  console.log(`   ✅ Whole→Component: Subtracting ${quantityToSubtract} whole (equivalent to ${ingredient.quantity} ${convData.part})`);
                  conversionApplied = true;
                }
              } else {
                console.log(`   ⚠️ Not enough: Pantry has ${wholeToPartQty} parts, need ${quantityToSubtract}`);
              }
            } else {
              // Try the reverse: Recipe needs whole, pantry has parts
              const partToWholeQty = this.convertWholeToComponent(
                quantityToSubtract,
                usedItemName,
                pantryItemName
              );
              
              if (partToWholeQty !== null) {
                // Recipe needs whole, pantry has parts (e.g., recipe needs 1 whole garlic, pantry has 10 cloves)
                quantityToSubtract = partToWholeQty;
                console.log(`   ✅ Component→Whole: Subtracting ${quantityToSubtract} parts from pantry`);
                conversionApplied = true;
              }
            }
          }
          
          // Calculate new quantity (don't go below 0)
          const newQuantity = Math.max(0, pantryItem.quantity - quantityToSubtract);
          console.log(`   ➖ Subtraction: ${pantryItem.quantity} - ${quantityToSubtract} = ${newQuantity}`);
          
          updates.push({
            itemID: pantryItem.itemID,
            itemName: pantryItem.itemName,
            oldQuantity: pantryItem.quantity,
            subtracted: quantityToSubtract,
            newQuantity: newQuantity,
            hadUnit: !!(ingredient.unit && ingredient.unit.trim()),
            conversionType: conversionApplied ? 'whole-component' : 'standard'
          });
        } else {
          console.log(`   ❌ Not found in pantry`);
          console.log(`⚠️ Pantry item not found for: ${ingredient.name || ingredient.text}`);
        }
      }

      // Execute updates
      for (const update of updates) {
        const { error } = await supabase
          .from('tbl_items')
          .update({ quantity: update.newQuantity })
          .eq('"itemID"', update.itemID);

        if (error) {
          console.error('Error updating pantry item:', error);
        } else {
          console.log(`✓ Updated ${update.itemName}: ${update.oldQuantity} → ${update.newQuantity} (subtracted ${update.subtracted})`);
        }
      }

      console.log(`\n📊 Subtraction summary:`);
      console.log(`   ✅ Auto-subtracted: ${updates.length} items (weight-based)`);
      console.log(`   ⚠️ Needs confirmation: ${needsConfirmation.length} items (condiments/liquids)`);
      
      return {
        success: true,
        updatedCount: updates.length,
        updates: updates,
        needsConfirmation: needsConfirmation // Items requiring user to confirm if consumed
      };
    } catch (error) {
      console.error('Error subtracting ingredients:', error);
      return {
        success: false,
        error: error.message,
        needsConfirmation: []
      };
    }
  }

  /**
   * Convert units (same as in substitute-selector)
   * @param {number} value - Quantity to convert
   * @param {string} fromUnit - Source unit
   * @param {string} toUnit - Target unit
   * @returns {number} Converted value
   */
  convertUnit(value, fromUnit, toUnit) {
    // Normalize units - handle plural forms and common abbreviations
    const normalizeUnit = (unit) => {
      if (!unit) return '';
      let normalized = unit.toLowerCase().trim();
      
      // Remove trailing 's' for plural forms
      if (normalized.endsWith('s') && normalized.length > 2) {
        // Don't remove 's' from 'oz' or 'lbs'
        if (!['oz', 'lbs'].includes(normalized)) {
          normalized = normalized.slice(0, -1);
        }
      }
      
      // Map common variations to standard units
      const unitMap = {
        // Weight units
        'gram': 'g', 'grams': 'g', 'gr': 'g',
        'kilogram': 'kg', 'kilograms': 'kg', 'kilo': 'kg',
        'ounce': 'oz', 'ounces': 'oz',
        'pound': 'lb', 'pounds': 'lb', 'lbs': 'lb',
        
        // Volume units
        'milliliter': 'ml', 'milliliters': 'ml', 'millilitre': 'ml', 'millilitres': 'ml',
        'liter': 'l', 'liters': 'l', 'litre': 'l', 'litres': 'l',
        'tablespoon': 'tbsp', 'tablespoons': 'tbsp', 'tbs': 'tbsp', 'tb': 'tbsp', 'T': 'tbsp',
        'teaspoon': 'tsp', 'teaspoons': 'tsp', 't': 'tsp',
        'cups': 'cup', 'c': 'cup',
        'fluid ounce': 'fl oz', 'fluid ounces': 'fl oz', 'floz': 'fl oz',
        
        // Counting units
        'piece': 'pcs', 'pieces': 'pcs', 'pc': 'pcs', 'pcs': 'pcs', 'piece': 'pcs',
        'whole': 'pcs', 'each': 'pcs', 'count': 'pcs',
        
        // Filipino units
        'salop': 'salop', 'ganta': 'ganta', 'chupa': 'chupa',
      };
      
      return unitMap[normalized] || normalized;
    };

    const from = normalizeUnit(fromUnit);
    const to = normalizeUnit(toUnit);

    console.log(`🔄 Unit conversion: ${value} ${from} → ${to}`);

    if (from === to) return value;

    // Counting units (all equivalent) - treat as 1:1
    const countingUnits = ['pcs', 'pc', 'piece', 'each', 'whole', 'count', ''];
    if (countingUnits.includes(from) && countingUnits.includes(to)) {
      console.log(`✓ Counting unit conversion: ${value} ${from} = ${value} ${to} (1:1)`);
      return value;
    }

    // Weight conversions (comprehensive)
    const weightConversions = {
      'g': { 'kg': 0.001, 'oz': 0.035274, 'lb': 0.00220462, 'g': 1 },
      'kg': { 'g': 1000, 'oz': 35.274, 'lb': 2.20462, 'kg': 1 },
      'oz': { 'g': 28.3495, 'kg': 0.0283495, 'lb': 0.0625, 'oz': 1 },
      'lb': { 'g': 453.592, 'kg': 0.453592, 'oz': 16, 'lb': 1, 'pound': 1 },
    };

    // Volume conversions (comprehensive)
    const volumeConversions = {
      'ml': { 
        'l': 0.001, 
        'liter': 0.001,
        'cup': 0.00422675, 
        'tbsp': 0.067628, 
        'tsp': 0.202884, 
        'fl oz': 0.033814, 
        'ml': 1 
      },
      'l': { 
        'ml': 1000, 
        'liter': 1,
        'cup': 4.22675, 
        'tbsp': 67.628, 
        'tsp': 202.884, 
        'fl oz': 33.814, 
        'l': 1 
      },
      'liter': {
        'ml': 1000,
        'l': 1,
        'liter': 1,
        'cup': 4.22675,
        'tbsp': 67.628,
        'tsp': 202.884,
        'fl oz': 33.814,
      },
      'cup': { 
        'ml': 236.588, 
        'l': 0.236588, 
        'liter': 0.236588,
        'tbsp': 16, 
        'tsp': 48, 
        'fl oz': 8, 
        'cup': 1 
      },
      'tbsp': { 
        'ml': 14.7868, 
        'l': 0.0147868, 
        'liter': 0.0147868,
        'cup': 0.0625, 
        'tsp': 3, 
        'fl oz': 0.5, 
        'tbsp': 1 
      },
      'tsp': { 
        'ml': 4.92892, 
        'l': 0.00492892, 
        'liter': 0.00492892,
        'cup': 0.0208333, 
        'tbsp': 0.333333, 
        'fl oz': 0.166667, 
        'tsp': 1 
      },
      'fl oz': { 
        'ml': 29.5735, 
        'l': 0.0295735, 
        'liter': 0.0295735,
        'cup': 0.125, 
        'tbsp': 2, 
        'tsp': 6, 
        'fl oz': 1 
      },
    };

    // Try weight conversion
    if (weightConversions[from]?.[to]) {
      const result = parseFloat((value * weightConversions[from][to]).toFixed(3));
      console.log(`✓ Weight conversion: ${value} ${from} = ${result} ${to}`);
      return result;
    }

    // Try volume conversion
    if (volumeConversions[from]?.[to]) {
      const result = parseFloat((value * volumeConversions[from][to]).toFixed(3));
      console.log(`✓ Volume conversion: ${value} ${from} = ${result} ${to}`);
      return result;
    }

    // No conversion available, return original value
    console.log(`⚠️ No conversion available from ${from} to ${to}`);
    return value;
  }

  /**
   * Create a modified recipe with substitutions (local only)
   * @param {Object} recipe - Original recipe
   * @param {Object} substitutions - { originalIngredient: newIngredient }
   * @returns {Object} Modified recipe
   */
  createSubstitutedRecipe(recipe, substitutions) {
    // Clone the recipe to avoid mutating original
    const modifiedRecipe = { ...recipe };
    
    // Support both ingredientLines (Edamam) and ingredients (AI recipes)
    const ingredientKey = recipe.ingredientLines ? 'ingredientLines' : 'ingredients';
    const recipeIngredients = recipe[ingredientKey];
    
    if (!recipeIngredients) {
      console.warn('No ingredients found in recipe');
      return modifiedRecipe;
    }
    
    // Update ingredients
    modifiedRecipe[ingredientKey] = recipeIngredients.map(ingredient => {
      const ingredientText = typeof ingredient === 'string' ? ingredient : (ingredient.text || ingredient);
      
      if (substitutions[ingredientText]) {
        const substitute = substitutions[ingredientText];
        
        // Build the display text with quantity and unit
        let displayText = substitute.name;
        if (substitute.quantity && substitute.unit) {
          displayText = `${substitute.quantity} ${substitute.unit} ${substitute.name}`;
        } else if (substitute.quantity) {
          displayText = `${substitute.quantity} ${substitute.name}`;
        }
        
        // For string ingredients, return an object
        if (typeof ingredient === 'string') {
          return {
            text: displayText,
            originalText: ingredientText,
            isSubstituted: true,
            substitutionReason: substitute.category,
            quantity: substitute.quantity,
            unit: substitute.unit,
            // Store original pantry info for subtraction
            originalQuantityInPantry: substitute.originalQuantityInPantry,
            originalUnitInPantry: substitute.originalUnitInPantry
          };
        }
        // For object ingredients, merge properties
        return {
          ...ingredient,
          text: displayText,
          originalText: ingredientText,
          isSubstituted: true,
          substitutionReason: substitute.category,
          quantity: substitute.quantity,
          unit: substitute.unit,
          // Store original pantry info for subtraction
          originalQuantityInPantry: substitute.originalQuantityInPantry,
          originalUnitInPantry: substitute.originalUnitInPantry
        };
      }
      
      return ingredient;
    });

    // Update instructions if needed (replace ingredient names)
    if (recipe.instructions) {
      modifiedRecipe.instructions = recipe.instructions.map(step => {
        let modifiedStep = typeof step === 'string' ? step : step.instruction;
        
        Object.entries(substitutions).forEach(([original, substitute]) => {
          // Get the base ingredient names
          const normalizedOriginal = this.normalizeIngredientName(original);
          const substituteName = substitute.name;
          
          // Remove quantities and common descriptors to get base ingredient
          const quantityPattern = /^\d+\.?\d*\s*(\d+\/\d+)?\s*(cups?|tbsps?|tsps?|tablespoons?|teaspoons?|oz|ounces?|g|grams?|kg|kilograms?|lbs?|pounds?|ml|l|liters?|pcs?|pieces?|each|whole)?\s*/i;
          const baseOriginal = normalizedOriginal.replace(quantityPattern, '').trim();
          
          // Common descriptors that might appear before ingredient
          const descriptors = '(fresh|frozen|raw|cooked|diced|chopped|sliced|minced|ground|whole|canned|dried|smoked|peeled|cored|quartered|halved|large|small|medium)';
          
          if (baseOriginal) {
            console.log(`🔄 Replacing "${baseOriginal}" with "${substituteName}" in instructions`);
            
            // Pattern 1: Match with descriptors (e.g., "fresh tarragon" → "basil")
            const descriptorRegex = new RegExp(`\\b${descriptors}\\s+${baseOriginal}\\b`, 'gi');
            modifiedStep = modifiedStep.replace(descriptorRegex, (match) => {
              const descriptor = match.split(/\s+/)[0]; // Get the descriptor word
              return `${descriptor} ${substituteName}`;
            });
            
            // Pattern 2: Match bare ingredient (e.g., "tarragon" → "basil")
            const bareRegex = new RegExp(`\\b${baseOriginal}\\b`, 'gi');
            modifiedStep = modifiedStep.replace(bareRegex, substituteName);
            
            // Pattern 3: Match full original text for exact matches
            const fullRegex = new RegExp(original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            modifiedStep = modifiedStep.replace(fullRegex, substituteName);
          }
        });
        
        return typeof step === 'string' ? modifiedStep : { ...step, instruction: modifiedStep };
      });
    }

    modifiedRecipe.hasSubstitutions = true;
    modifiedRecipe.substitutionMap = substitutions;

    return modifiedRecipe;
  }
}

export default new IngredientSubstitutionService();
