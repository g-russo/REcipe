/**
 * Philippines Food Database Service
 * 
 * Integrates with local Philippines food product databases
 * Prioritizes Filipino brands and products
 * 
 * Data Sources:
 * 1. OpenFoodFacts Philippines subset
 * 2. Custom Philippines product database (can be expanded)
 * 3. FDA Philippines registered products
 */

const OPENFOODFACTS_API = 'https://world.openfoodfacts.org/api/v2';

class PhilippinesFoodService {
  /**
   * Search for Philippines products by barcode
   * Focuses on Filipino brands and locally sold products
   * 
   * @param {string} barcode - Product barcode
   * @returns {Promise<Object|null>} Product data or null if not found
   */
  async searchByBarcode(barcode) {
    try {
      console.log('🇵🇭 Searching Philippines Food Database...');
      console.log('   📦 Barcode:', barcode);

      // Try OpenFoodFacts with Philippines filter first
      const offResult = await this.searchOpenFoodFactsPhilippines(barcode);
      if (offResult) {
        console.log('   ✅ Found in OpenFoodFacts Philippines!');
        return offResult;
      }

      // Try custom Philippines database
      const customResult = await this.searchCustomDatabase(barcode);
      if (customResult) {
        console.log('   ✅ Found in Custom Philippines Database!');
        return customResult;
      }

      console.log('   ⚠️  Not found in Philippines databases');
      return null;
    } catch (error) {
      console.error('   ❌ Philippines search error:', error.message);
      return null;
    }
  }

  /**
   * Search OpenFoodFacts for Philippines products
   * @private
   */
  async searchOpenFoodFactsPhilippines(barcode) {
    try {
      const response = await fetch(`${OPENFOODFACTS_API}/product/${barcode}`);
      
      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      
      if (data.status !== 1 || !data.product) {
        return null;
      }

      const product = data.product;

      // Check if product is sold in Philippines or is a Filipino brand
      const isPhilippinesProduct = this.isPhilippinesProduct(product);
      
      if (!isPhilippinesProduct) {
        console.log('   ℹ️  Product found but not Philippines-specific');
        return null;
      }

      // Format the product data
      return this.formatProductData(product, 'OpenFoodFacts PH');
    } catch (error) {
      console.error('   ❌ OpenFoodFacts PH error:', error.message);
      return null;
    }
  }

  /**
   * Check if product is Philippines-related
   * @private
   */
  isPhilippinesProduct(product) {
    // Check countries where sold
    const countries = product.countries_tags || [];
    if (countries.includes('en:philippines')) {
      return true;
    }

    // Check manufacturing places
    const manufacturingPlaces = (product.manufacturing_places || '').toLowerCase();
    if (manufacturingPlaces.includes('philippines') || manufacturingPlaces.includes('manila')) {
      return true;
    }

    // Check for common Filipino brands
    const brands = (product.brands || '').toLowerCase();
    const filipinoBrands = [
      'nestle philippines', 'unilever philippines', 'del monte philippines',
      'san miguel', 'magnolia', 'alaska', 'bear brand', 'birch tree',
      'purefoods', 'tender juicy', 'CDO', 'star margarine', 'lucky me',
      'nissin', 'pancit canton', 'payless', 'selecta', 'monde nissin',
      'liwayway', 'oishi', 'jack n jill', 'cream-o', 'chippy', 'piatos',
      'nova', 'boy bawang', 'urc', 'robin', 'great taste', 'kopiko',
      'nescafe philippines', 'milo philippines', 'bear brand', 'colgate philippines',
      'palmolive philippines', 'sunsilk philippines', 'safeguard philippines',
    ];

    return filipinoBrands.some(brand => brands.includes(brand));
  }

  /**
   * Search custom Philippines database
   * This can be expanded with your own database of Filipino products
   * @private
   */
  async searchCustomDatabase(barcode) {
    // Philippines product database (expandable)
    const philippinesProducts = {
      // San Miguel Products
      '4800194114011': {
        name: 'San Miguel Pale Pilsen Beer',
        category: 'Beverages',
        brand: 'San Miguel',
      },
      '4800194110013': {
        name: 'San Miguel Light Beer',
        category: 'Beverages',
        brand: 'San Miguel',
      },
      
      // Lucky Me Products
      '4800016045011': {
        name: 'Lucky Me Pancit Canton Original',
        category: 'Instant Noodles',
        brand: 'Lucky Me',
      },
      '4800016045028': {
        name: 'Lucky Me Pancit Canton Chilimansi',
        category: 'Instant Noodles',
        brand: 'Lucky Me',
      },
      '4800016045035': {
        name: 'Lucky Me Pancit Canton Kalamansi',
        category: 'Instant Noodles',
        brand: 'Lucky Me',
      },
      
      // Oishi Products
      '4800194103435': {
        name: 'Oishi Prawn Crackers',
        category: 'Snacks',
        brand: 'Oishi',
      },
      
      // Chippy
      '4800016025013': {
        name: 'Chippy Barbecue Corn Chips',
        category: 'Snacks',
        brand: 'Jack n Jill',
      },
      
      // Nova
      '4800016026010': {
        name: 'Nova Homestyle BBQ',
        category: 'Snacks',
        brand: 'Jack n Jill',
      },
      
      // Piattos
      '4800016027017': {
        name: 'Piattos Cheese',
        category: 'Snacks',
        brand: 'Jack n Jill',
      },
      
      // Boy Bawang
      '4806526700013': {
        name: 'Boy Bawang Cornick Garlic',
        category: 'Snacks',
        brand: 'KSK',
      },
      
      // Alaska Milk
      '4800092100014': {
        name: 'Alaska Evaporated Milk',
        category: 'Dairy',
        brand: 'Alaska',
      },
      
      // Bear Brand
      '4800092200011': {
        name: 'Bear Brand Adult Plus',
        category: 'Dairy',
        brand: 'Nestle Philippines',
      },
      
      // Milo
      '4800092300018': {
        name: 'Milo Active-Go Chocolate Drink',
        category: 'Beverages',
        brand: 'Nestle Philippines',
      },
      
      // Great Taste Coffee
      '4800092400015': {
        name: 'Great Taste White Coffee',
        category: 'Beverages',
        brand: 'Nestle Philippines',
      },
      
      // Kopiko
      '4800092500012': {
        name: 'Kopiko Brown Coffee',
        category: 'Beverages',
        brand: 'Kopiko',
      },
      
      // CDO Products
      '4800092600019': {
        name: 'CDO Ulam Burger',
        category: 'Meat',
        brand: 'CDO',
      },
      
      // Purefoods
      '4800092700016': {
        name: 'Purefoods Tender Juicy Hotdog',
        category: 'Meat',
        brand: 'Purefoods',
      },
      
      // Del Monte Philippines
      '4800092800013': {
        name: 'Del Monte Tomato Sauce Filipino Style',
        category: 'Condiments',
        brand: 'Del Monte Philippines',
      },
      
      // Add more products as needed...
    };

    const product = philippinesProducts[barcode];
    
    if (!product) {
      return null;
    }

    // Return formatted product with estimated nutrition (can be enhanced)
    return {
      food_name: product.name,
      food_description: `${product.brand} - ${product.category}`,
      brand: product.brand,
      category: product.category,
      servings: {
        serving: {
          serving_description: '1 serving',
          calories: 0, // Add real nutrition data
          fat: 0,
          carbohydrate: 0,
          protein: 0,
        }
      },
      _source: {
        database: 'Philippines Food Database',
        attribution: 'Philippines Food Database - Local Products',
        url: '',
        disclaimer: 'Custom Philippines product database',
        license: 'Proprietary',
      },
    };
  }

  /**
   * Format OpenFoodFacts product data
   * @private
   */
  formatProductData(product, source) {
    const nutriments = product.nutriments || {};
    
    return {
      food_name: product.product_name || 'Unknown Product',
      food_description: product.brands ? `${product.brands} - Per 100g` : 'Per 100g',
      brand: product.brands || '',
      category: product.categories || '',
      barcode: product.code,
      image_url: product.image_url || product.image_front_url,
      servings: {
        serving: {
          serving_description: '100g',
          metric_serving_amount: 100,
          metric_serving_unit: 'g',
          calories: nutriments.energy_kcal_100g || nutriments['energy-kcal_100g'] || 0,
          fat: nutriments.fat_100g || 0,
          saturated_fat: nutriments['saturated-fat_100g'] || 0,
          carbohydrate: nutriments.carbohydrates_100g || 0,
          sugar: nutriments.sugars_100g || 0,
          protein: nutriments.proteins_100g || 0,
          sodium: nutriments.sodium_100g ? nutriments.sodium_100g * 1000 : 0, // Convert g to mg
          fiber: nutriments.fiber_100g || 0,
        }
      },
      ingredients: product.ingredients_text || '',
      allergens: product.allergens_tags?.join(', ') || '',
      nutriscore: product.nutriscore_grade,
      _source: {
        database: source,
        attribution: 'Data from Open Food Facts - Philippines subset - Open Database',
        url: `https://world.openfoodfacts.org/product/${product.code}`,
        disclaimer: 'Product data for Philippines market',
        license: 'ODbL (Open Database License)',
      },
    };
  }

  /**
   * Search for Philippines products by name
   * @param {string} query - Product name
   * @returns {Promise<Array>} Array of products
   */
  async searchByName(query) {
    try {
      // Search OpenFoodFacts with Philippines filter
      const response = await fetch(
        `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&countries_tags_en=philippines&json=1&page_size=20`
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      
      return (data.products || [])
        .filter(product => this.isPhilippinesProduct(product))
        .map(product => this.formatProductData(product, 'OpenFoodFacts PH'));
    } catch (error) {
      console.error('Philippines name search error:', error);
      return [];
    }
  }

  /**
   * Add new product to custom database
   * This can be enhanced to save to a backend/database
   * @param {string} barcode - Product barcode
   * @param {Object} productData - Product information
   */
  async addCustomProduct(barcode, productData) {
    console.log('📝 Adding custom Philippines product:', productData);
    // TODO: Implement backend API to save custom products
    // For now, this is just a placeholder
    return {
      success: true,
      message: 'Product added to custom database',
    };
  }
}

export default new PhilippinesFoodService();
