/**
 * OpenFoodFacts API Service
 * Free and open database of food products from around the world
 * 
 * API Documentation: https://world.openfoodfacts.org/data
 * License: ODbL (Open Database License)
 * 
 * Important: 
 * - This is a free, community-driven database
 * - Must provide proper attribution when displaying data
 * - Can be used commercially with attribution
 */

const OPENFOODFACTS_API = 'https://world.openfoodfacts.org/api/v2';

class OpenFoodFactsService {
  /**
   * Search product by barcode
   * @param {string} barcode - Product barcode (EAN-13, UPC, etc.)
   * @returns {Promise<Object|null>} Product data or null if not found
   */
  async getProductByBarcode(barcode) {
    try {
      console.log('🔍 [OpenFoodFacts] Searching for barcode:', barcode);
      
      const response = await fetch(`${OPENFOODFACTS_API}/product/${barcode}.json`, {
        headers: {
          'User-Agent': 'REcipe - Mobile App - Version 1.0',
        },
      });
      
      if (!response.ok) {
        // 404 is expected when product is not in database
        if (response.status === 404) {
          console.log('ℹ️ [OpenFoodFacts] Product not in database (404)');
        } else {
          console.error('❌ [OpenFoodFacts] API error:', response.status);
        }
        return null;
      }
      
      const data = await response.json();
      
      // Check if product was found (status 1 = found, 0 = not found)
      if (data.status === 0 || !data.product) {
        console.log('❌ [OpenFoodFacts] Product not found');
        return null;
      }
      
      const product = data.product;
      console.log('✅ [OpenFoodFacts] Product found:', product.product_name);
      
      return this.formatProductData(product);
    } catch (error) {
      console.error('❌ [OpenFoodFacts] Error:', error);
      return null;
    }
  }

  /**
   * Search products by name
   * @param {string} query - Search query
   * @param {number} page - Page number (default 1)
   * @returns {Promise<Array>} Array of products
   */
  async searchProducts(query, page = 1) {
    try {
      console.log('🔍 [OpenFoodFacts] Searching for:', query);
      
      const response = await fetch(
        `${OPENFOODFACTS_API}/search?search_terms=${encodeURIComponent(query)}&page=${page}&page_size=20&json=true`,
        {
          headers: {
            'User-Agent': 'REcipe - Mobile App - Version 1.0',
          },
        }
      );
      
      if (!response.ok) {
        console.error('❌ [OpenFoodFacts] Search error:', response.status);
        return [];
      }
      
      const data = await response.json();
      
      if (!data.products || data.products.length === 0) {
        console.log('❌ [OpenFoodFacts] No products found');
        return [];
      }
      
      console.log(`✅ [OpenFoodFacts] Found ${data.products.length} products`);
      
      return data.products.map(product => this.formatProductData(product));
    } catch (error) {
      console.error('❌ [OpenFoodFacts] Search error:', error);
      return [];
    }
  }

  /**
   * Format OpenFoodFacts product data to match our app format
   * @param {Object} product - Raw product data from OpenFoodFacts
   * @returns {Object} Formatted product data
   */
  formatProductData(product) {
    // Extract nutrition data (per 100g by default)
    const nutriments = product.nutriments || {};
    
    return {
      // Basic info
      food_name: product.product_name || product.generic_name || 'Unknown Product',
      brand_name: product.brands || '',
      barcode: product.code || product._id,
      
      // Categories and tags
      categories: product.categories ? product.categories.split(',').map(c => c.trim()) : [],
      
      // Images
      image_url: product.image_url || product.image_front_url || null,
      image_thumb_url: product.image_thumb_url || product.image_front_thumb_url || null,
      
      // Servings info
      servings: {
        serving: {
          serving_description: product.serving_size || '100g',
          metric_serving_amount: '100',
          metric_serving_unit: 'g',
          
          // Nutrition per 100g
          calories: Math.round(nutriments['energy-kcal_100g'] || nutriments.energy_value || 0),
          fat: parseFloat((nutriments.fat_100g || 0).toFixed(2)),
          saturated_fat: parseFloat((nutriments['saturated-fat_100g'] || 0).toFixed(2)),
          carbohydrate: parseFloat((nutriments.carbohydrates_100g || 0).toFixed(2)),
          sugar: parseFloat((nutriments.sugars_100g || 0).toFixed(2)),
          fiber: parseFloat((nutriments.fiber_100g || 0).toFixed(2)),
          protein: parseFloat((nutriments.proteins_100g || 0).toFixed(2)),
          sodium: parseFloat(((nutriments.sodium_100g || 0) * 1000).toFixed(2)), // Convert g to mg
          cholesterol: parseFloat(((nutriments.cholesterol_100g || 0) * 1000).toFixed(2)), // Convert g to mg
          
          // Additional nutrients
          salt: parseFloat((nutriments.salt_100g || 0).toFixed(2)),
          vitamin_a: parseFloat((nutriments['vitamin-a_100g'] || 0).toFixed(2)),
          vitamin_c: parseFloat((nutriments['vitamin-c_100g'] || 0).toFixed(2)),
          calcium: parseFloat((nutriments.calcium_100g || 0).toFixed(2)),
          iron: parseFloat((nutriments.iron_100g || 0).toFixed(2)),
        }
      },
      
      // Additional info (OpenFoodFacts specific)
      ingredients_text: product.ingredients_text || '',
      allergens: product.allergens ? product.allergens.split(',').map(a => a.trim()) : [],
      labels: product.labels ? product.labels.split(',').map(l => l.trim()) : [],
      
      // Quality scores
      nutrition_grade: product.nutrition_grade_fr || product.nutrition_grades || null,
      nova_group: product.nova_group || null,
      ecoscore_grade: product.ecoscore_grade || null,
      
      // Origin info
      countries: product.countries ? product.countries.split(',').map(c => c.trim()) : [],
      manufacturing_places: product.manufacturing_places || '',
      
      // Source attribution (DO NOT REDISTRIBUTE RAW DATA)
      _source: {
        database: 'OpenFoodFacts',
        attribution: 'Data from Open Food Facts',
        license: 'ODbL (Open Database License)',
        url: `https://world.openfoodfacts.org/product/${product.code || product._id}`,
        disclaimer: 'This product information is from the Open Food Facts database, a free and open database.',
      },
      
      // DO NOT include raw data to avoid redistribution issues
      // _raw: product, // REMOVED - do not redistribute raw data
    };
  }

  /**
   * Get nutrition facts formatted for display
   * @param {Object} formattedProduct - Product data formatted by formatProductData
   * @returns {Array} Array of nutrition facts
   */
  getNutritionFacts(formattedProduct) {
    const serving = formattedProduct.servings?.serving || {};
    
    return [
      { 
        label: 'Serving Size', 
        value: serving.serving_description || '100g',
        isHeader: true 
      },
      { 
        label: 'Calories', 
        value: serving.calories || 0, 
        unit: 'kcal',
        bold: true 
      },
      { label: 'Total Fat', value: serving.fat || 0, unit: 'g' },
      { label: 'Saturated Fat', value: serving.saturated_fat || 0, unit: 'g', indent: true },
      { label: 'Cholesterol', value: serving.cholesterol || 0, unit: 'mg' },
      { label: 'Sodium', value: serving.sodium || 0, unit: 'mg' },
      { label: 'Total Carbohydrate', value: serving.carbohydrate || 0, unit: 'g' },
      { label: 'Dietary Fiber', value: serving.fiber || 0, unit: 'g', indent: true },
      { label: 'Sugars', value: serving.sugar || 0, unit: 'g', indent: true },
      { label: 'Protein', value: serving.protein || 0, unit: 'g' },
    ].filter(item => item.isHeader || (item.value && item.value > 0));
  }

  /**
   * Get Nutri-Score color
   * @param {string} grade - Nutri-Score grade (a, b, c, d, e)
   * @returns {string} Hex color code
   */
  getNutriScoreColor(grade) {
    const colors = {
      'a': '#038141',
      'b': '#85BB2F',
      'c': '#FECB02',
      'd': '#EE8100',
      'e': '#E63E11',
    };
    return colors[grade?.toLowerCase()] || '#ccc';
  }
}

export default new OpenFoodFactsService();
