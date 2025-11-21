/**
 * ACCURACY TESTING
 * Tests calculation accuracy, data precision, and algorithm correctness
 */

describe('Accuracy Testing Suite', () => {
  
  // ==================== NUTRITION CALCULATIONS ====================
  
  describe('Nutrition Calculation Accuracy', () => {
    it('should calculate total calories accurately', () => {
      const ingredients = [
        { name: 'Chicken', calories: 165, quantity: 200, unit: 'g' }, // 330 cal
        { name: 'Rice', calories: 130, quantity: 100, unit: 'g' },    // 130 cal
        { name: 'Broccoli', calories: 55, quantity: 100, unit: 'g' }  // 55 cal
      ];
      
      const calculateTotalCalories = (ingredients) => {
        return ingredients.reduce((total, ing) => {
          return total + (ing.calories * ing.quantity / 100);
        }, 0);
      };
      
      const total = calculateTotalCalories(ingredients);
      expect(total).toBeCloseTo(515, 1); // 330 + 130 + 55 = 515
    });

    it('should calculate macronutrients accurately', () => {
      const meal = {
        protein: 50,    // grams
        carbs: 120,     // grams
        fat: 30         // grams
      };
      
      const calculateMacroCalories = (macros) => {
        return {
          proteinCal: macros.protein * 4,   // 4 cal/g
          carbsCal: macros.carbs * 4,       // 4 cal/g
          fatCal: macros.fat * 9,           // 9 cal/g
          total: (macros.protein * 4) + (macros.carbs * 4) + (macros.fat * 9)
        };
      };
      
      const result = calculateMacroCalories(meal);
      expect(result.proteinCal).toBe(200);  // 50 * 4
      expect(result.carbsCal).toBe(480);    // 120 * 4
      expect(result.fatCal).toBe(270);      // 30 * 9
      expect(result.total).toBe(950);       // 200 + 480 + 270
    });

    it('should scale recipe nutrients for servings', () => {
      const recipe = {
        servings: 4,
        calories: 800,
        protein: 60,
        carbs: 100,
        fat: 20
      };
      
      const scaleRecipe = (recipe, newServings) => {
        const factor = newServings / recipe.servings;
        return {
          servings: newServings,
          calories: Math.round(recipe.calories * factor),
          protein: Math.round(recipe.protein * factor),
          carbs: Math.round(recipe.carbs * factor),
          fat: Math.round(recipe.fat * factor)
        };
      };
      
      const scaled = scaleRecipe(recipe, 2); // Half recipe
      expect(scaled.calories).toBe(400);
      expect(scaled.protein).toBe(30);
      expect(scaled.carbs).toBe(50);
      expect(scaled.fat).toBe(10);
    });

    it('should calculate percentage of daily values', () => {
      const dailyValues = {
        calories: 2000,
        protein: 50,
        carbs: 300,
        fat: 65
      };
      
      const meal = {
        calories: 600,
        protein: 25,
        carbs: 90,
        fat: 20
      };
      
      const calculatePercentages = (meal, daily) => ({
        calories: (meal.calories / daily.calories * 100).toFixed(1),
        protein: (meal.protein / daily.protein * 100).toFixed(1),
        carbs: (meal.carbs / daily.carbs * 100).toFixed(1),
        fat: (meal.fat / daily.fat * 100).toFixed(1)
      });
      
      const percentages = calculatePercentages(meal, dailyValues);
      expect(parseFloat(percentages.calories)).toBeCloseTo(30.0, 1);
      expect(parseFloat(percentages.protein)).toBeCloseTo(50.0, 1);
      expect(parseFloat(percentages.carbs)).toBeCloseTo(30.0, 1);
      expect(parseFloat(percentages.fat)).toBeCloseTo(30.8, 1);
    });
  });

  // ==================== EXPIRY DATE CALCULATIONS ====================
  
  describe('Expiry Date Calculation Accuracy', () => {
    it('should calculate days until expiry accurately', () => {
      const today = new Date('2025-01-01');
      const expiryDate = new Date('2025-01-15');
      
      const daysUntilExpiry = (today, expiry) => {
        const diff = expiry.getTime() - today.getTime();
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
      };
      
      expect(daysUntilExpiry(today, expiryDate)).toBe(14);
    });

    it('should calculate expiry from purchase date', () => {
      const purchaseDate = new Date('2025-01-01');
      const shelfLifeDays = 7;
      
      const calculateExpiryDate = (purchase, shelfLife) => {
        const expiry = new Date(purchase);
        expiry.setDate(expiry.getDate() + shelfLife);
        return expiry;
      };
      
      const expiry = calculateExpiryDate(purchaseDate, shelfLifeDays);
      expect(expiry.getDate()).toBe(8);
      expect(expiry.getMonth()).toBe(0); // January (0-indexed)
    });

    it('should categorize expiry status accurately', () => {
      const categorizeExpiry = (daysUntil) => {
        if (daysUntil < 0) return 'expired';
        if (daysUntil === 0) return 'expires_today';
        if (daysUntil <= 3) return 'expires_soon';
        if (daysUntil <= 7) return 'expires_this_week';
        return 'fresh';
      };
      
      expect(categorizeExpiry(-1)).toBe('expired');
      expect(categorizeExpiry(0)).toBe('expires_today');
      expect(categorizeExpiry(2)).toBe('expires_soon');
      expect(categorizeExpiry(5)).toBe('expires_this_week');
      expect(categorizeExpiry(10)).toBe('fresh');
    });
  });

  // ==================== QUANTITY CONVERSIONS ====================
  
  describe('Quantity Conversion Accuracy', () => {
    it('should convert between metric units', () => {
      const convert = {
        gToKg: (g) => g / 1000,
        kgToG: (kg) => kg * 1000,
        mlToL: (ml) => ml / 1000,
        lToMl: (l) => l * 1000
      };
      
      expect(convert.gToKg(1000)).toBe(1);
      expect(convert.kgToG(2.5)).toBe(2500);
      expect(convert.mlToL(500)).toBe(0.5);
      expect(convert.lToMl(1.5)).toBe(1500);
    });

    it('should convert between imperial and metric', () => {
      const convert = {
        lbsToKg: (lbs) => lbs * 0.453592,
        kgToLbs: (kg) => kg / 0.453592,
        ozToG: (oz) => oz * 28.3495,
        gToOz: (g) => g / 28.3495
      };
      
      expect(convert.lbsToKg(10)).toBeCloseTo(4.54, 2);
      expect(convert.kgToLbs(5)).toBeCloseTo(11.02, 2);
      expect(convert.ozToG(8)).toBeCloseTo(226.8, 1);
      expect(convert.gToOz(100)).toBeCloseTo(3.53, 2);
    });

    it('should handle volume to weight conversions', () => {
      // Common cooking conversions
      const densities = {
        water: 1,      // 1ml = 1g
        flour: 0.593,  // 1ml = 0.593g
        sugar: 0.845,  // 1ml = 0.845g
        oil: 0.92      // 1ml = 0.92g
      };
      
      const volumeToWeight = (ml, ingredient) => {
        return ml * densities[ingredient];
      };
      
      expect(volumeToWeight(250, 'water')).toBe(250);
      expect(volumeToWeight(200, 'flour')).toBeCloseTo(118.6, 1);
      expect(volumeToWeight(100, 'sugar')).toBeCloseTo(84.5, 1);
    });
  });

  // ==================== RECIPE MATCHING ACCURACY ====================
  
  describe('Recipe Matching Algorithm Accuracy', () => {
    it('should calculate ingredient match percentage', () => {
      const pantry = ['chicken', 'rice', 'onion', 'garlic', 'tomato'];
      const recipeIngredients = ['chicken', 'rice', 'onion', 'pepper'];
      
      const calculateMatchPercentage = (pantry, recipe) => {
        const matches = recipe.filter(ing => 
          pantry.some(p => p.toLowerCase() === ing.toLowerCase())
        );
        return (matches.length / recipe.length * 100).toFixed(1);
      };
      
      const match = calculateMatchPercentage(pantry, recipeIngredients);
      expect(parseFloat(match)).toBe(75.0); // 3 out of 4 ingredients
    });

    it('should score recipe relevance accurately', () => {
      const recipe = {
        matchedIngredients: 4,
        totalIngredients: 6,
        rating: 4.5,
        cookTime: 30
      };
      
      const calculateRelevanceScore = (recipe) => {
        const ingredientScore = (recipe.matchedIngredients / recipe.totalIngredients) * 50;
        const ratingScore = (recipe.rating / 5) * 30;
        const timeScore = (60 - Math.min(recipe.cookTime, 60)) / 60 * 20;
        return ingredientScore + ratingScore + timeScore;
      };
      
      const score = calculateRelevanceScore(recipe);
      expect(score).toBeCloseTo(70.33, 1); // 33.33 + 27 + 10
    });

    it('should calculate similarity between recipes', () => {
      const recipe1 = ['chicken', 'rice', 'tomato', 'onion'];
      const recipe2 = ['chicken', 'pasta', 'tomato', 'garlic'];
      
      const calculateSimilarity = (r1, r2) => {
        const intersection = r1.filter(ing => r2.includes(ing));
        const union = [...new Set([...r1, ...r2])];
        return (intersection.length / union.length * 100).toFixed(1);
      };
      
      const similarity = calculateSimilarity(recipe1, recipe2);
      // Common: chicken, tomato (2)
      // Union: chicken, rice, tomato, onion, pasta, garlic (6)
      expect(parseFloat(similarity)).toBeCloseTo(33.3, 1);
    });
  });

  // ==================== STATISTICAL CALCULATIONS ====================
  
  describe('Statistical Accuracy', () => {
    it('should calculate average rating accurately', () => {
      const ratings = [5, 4, 5, 3, 4, 5, 4];
      
      const calculateAverage = (ratings) => {
        const sum = ratings.reduce((a, b) => a + b, 0);
        return (sum / ratings.length).toFixed(2);
      };
      
      const avg = calculateAverage(ratings);
      expect(parseFloat(avg)).toBeCloseTo(4.29, 2);
    });

    it('should calculate median accurately', () => {
      const values = [1, 3, 5, 7, 9];
      
      const calculateMedian = (arr) => {
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0
          ? (sorted[mid - 1] + sorted[mid]) / 2
          : sorted[mid];
      };
      
      expect(calculateMedian(values)).toBe(5);
      expect(calculateMedian([1, 2, 3, 4])).toBe(2.5);
    });

    it('should calculate percentage changes accurately', () => {
      const calculateChange = (oldVal, newVal) => {
        return ((newVal - oldVal) / oldVal * 100).toFixed(1);
      };
      
      expect(parseFloat(calculateChange(100, 150))).toBe(50.0);  // +50%
      expect(parseFloat(calculateChange(200, 150))).toBe(-25.0); // -25%
      expect(parseFloat(calculateChange(50, 75))).toBe(50.0);    // +50%
    });
  });

  // ==================== PRICE CALCULATIONS ====================
  
  describe('Price Calculation Accuracy', () => {
    it('should calculate total grocery cost', () => {
      const items = [
        { name: 'Chicken', price: 12.99, quantity: 2 },
        { name: 'Rice', price: 5.49, quantity: 1 },
        { name: 'Vegetables', price: 8.99, quantity: 3 }
      ];
      
      const calculateTotal = (items) => {
        return items.reduce((sum, item) => 
          sum + (item.price * item.quantity), 0
        ).toFixed(2);
      };
      
      const total = calculateTotal(items);
      expect(parseFloat(total)).toBeCloseTo(58.44, 2); // 25.98 + 5.49 + 26.97
    });

    it('should calculate cost per serving', () => {
      const recipe = {
        totalCost: 24.50,
        servings: 6
      };
      
      const costPerServing = (total, servings) => {
        return (total / servings).toFixed(2);
      };
      
      expect(parseFloat(costPerServing(recipe.totalCost, recipe.servings)))
        .toBeCloseTo(4.08, 2);
    });

    it('should apply discounts correctly', () => {
      const applyDiscount = (price, discountPercent) => {
        return (price * (1 - discountPercent / 100)).toFixed(2);
      };
      
      expect(parseFloat(applyDiscount(100, 20))).toBe(80.00);
      expect(parseFloat(applyDiscount(50, 15))).toBe(42.50);
      expect(parseFloat(applyDiscount(75.50, 10))).toBeCloseTo(67.95, 2);
    });
  });

  // ==================== TIME CALCULATIONS ====================
  
  describe('Time Calculation Accuracy', () => {
    it('should calculate total cook time', () => {
      const recipe = {
        prepTime: 15,    // minutes
        cookTime: 45,    // minutes
        restTime: 10     // minutes
      };
      
      const totalTime = recipe.prepTime + recipe.cookTime + recipe.restTime;
      expect(totalTime).toBe(70);
    });

    it('should convert minutes to hours and minutes', () => {
      const formatTime = (minutes) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return hours > 0 
          ? `${hours}h ${mins}m`
          : `${mins}m`;
      };
      
      expect(formatTime(90)).toBe('1h 30m');
      expect(formatTime(45)).toBe('45m');
      expect(formatTime(125)).toBe('2h 5m');
    });

    it('should calculate cooking time per serving', () => {
      const recipe = {
        totalTime: 60,
        servings: 4,
        activeTime: 20
      };
      
      const timePerServing = recipe.activeTime / recipe.servings;
      expect(timePerServing).toBe(5); // 20 / 4 = 5 minutes active per serving
    });
  });

  // ==================== ROUNDING AND PRECISION ====================
  
  describe('Rounding and Precision Accuracy', () => {
    it('should round to specific decimal places', () => {
      const round = (num, decimals) => {
        return Number(Math.round(num + 'e' + decimals) + 'e-' + decimals);
      };
      
      expect(round(3.14159, 2)).toBe(3.14);
      expect(round(2.567, 1)).toBe(2.6);
      expect(round(10.995, 2)).toBe(11.00);
    });

    it('should handle floating point precision', () => {
      // JavaScript floating point issue: 0.1 + 0.2 !== 0.3
      const precisePlus = (a, b) => {
        return Math.round((a + b) * 100) / 100;
      };
      
      expect(precisePlus(0.1, 0.2)).toBe(0.3);
      expect(precisePlus(1.005, 2.003)).toBe(3.01);
    });

    it('should round quantities to practical values', () => {
      const roundToPractical = (qty, unit) => {
        if (unit === 'g' || unit === 'ml') {
          return Math.round(qty / 5) * 5; // Round to nearest 5
        }
        return Math.round(qty * 2) / 2; // Round to nearest 0.5
      };
      
      expect(roundToPractical(247, 'g')).toBe(245);
      expect(roundToPractical(1.3, 'cup')).toBe(1.5);
      expect(roundToPractical(2.7, 'tbsp')).toBe(3.0);
    });
  });

});

// Run with: npm test -- __tests__/accuracy.test.js --coverage
