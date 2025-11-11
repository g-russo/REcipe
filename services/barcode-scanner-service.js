/**
 * Barcode Scanner Service with API Fallback Chain
 * 
 * Search Priority:
 * 1. FatSecret API (via EC2 backend) - Commercial database with nutritional info
 * 2. Philippines Food Database - Local Filipino products and brands
 * 3. OpenFoodFacts API - Free, community-driven database
 * 
 * Ensures proper attribution and compliance with both APIs' terms of service
 */

import OpenFoodFactsService from './openfoodfacts-service';
import PhilippinesFoodService from './philippines-food-service';

// Your EC2 backend URL
const EC2_BACKEND_URL = 'http://54.153.205.43:8000';

class BarcodeScannerService {
  /**
   * Search for food by barcode with automatic fallback
   * Priority: FatSecret → OpenFoodFacts
   * 
   * @param {string} barcode - Product barcode (UPC, EAN, etc.)
   * @returns {Promise<Object|null>} Product data with source attribution
   */
  async searchByBarcode(barcode) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 BARCODE SEARCH STARTED');
    console.log('📦 Barcode:', barcode);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
      // ═══════════════════════════════════════════════════════════
      // STEP 1: Try FatSecret API (via EC2 backend)
      // ═══════════════════════════════════════════════════════════
      console.log('');
      console.log('1️⃣  Trying FatSecret API...');
      console.log('   → Endpoint:', `${EC2_BACKEND_URL}/fatsecret/barcode`);
      
      const fatSecretResult = await this.searchFatSecret(barcode);
      
      if (fatSecretResult) {
        console.log('');
        console.log('✅ SUCCESS: Found in FatSecret!');
        console.log('📊 Product:', fatSecretResult.food_name);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        return {
          ...fatSecretResult,
          _source: {
            database: 'FatSecret',
            attribution: 'Nutritional data provided by FatSecret Platform API',
            url: 'https://platform.fatsecret.com',
            disclaimer: 'FatSecret Platform API - Commercial nutritional database',
          },
        };
      }
      
      console.log('   ⚠️  Not found in FatSecret');
      
      // ═══════════════════════════════════════════════════════════
      // STEP 2: Try Philippines Food Database
      // ═══════════════════════════════════════════════════════════
      console.log('');
      console.log('2️⃣  Trying Philippines Food Database...');
      console.log('   → Searching Filipino brands and local products');
      
      const philippinesResult = await PhilippinesFoodService.searchByBarcode(barcode);
      
      if (philippinesResult) {
        console.log('');
        console.log('✅ SUCCESS: Found in Philippines Database!');
        console.log('📊 Product:', philippinesResult.food_name);
        console.log('🇵🇭 Filipino Product');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        return philippinesResult; // Already has _source attribution
      }
      
      console.log('   ⚠️  Not found in Philippines Database');
      
      // ═══════════════════════════════════════════════════════════
      // STEP 3: Fallback to OpenFoodFacts
      // ═══════════════════════════════════════════════════════════
      console.log('');
      console.log('3️⃣  Trying OpenFoodFacts API...');
      console.log('   → Endpoint: https://world.openfoodfacts.org');
      
      const openFoodFactsResult = await OpenFoodFactsService.getProductByBarcode(barcode);
      
      if (openFoodFactsResult) {
        console.log('');
        console.log('✅ SUCCESS: Found in OpenFoodFacts!');
        console.log('📊 Product:', openFoodFactsResult.food_name);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        return openFoodFactsResult; // Already has _source attribution
      }
      
      console.log('   ⚠️  Not found in OpenFoodFacts');
      
      // ═══════════════════════════════════════════════════════════
      // NO RESULTS FOUND
      // ═══════════════════════════════════════════════════════════
      console.log('');
      console.log('❌ SEARCH FAILED: Product not found in any database');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      return null;
      
    } catch (error) {
      console.error('');
      console.error('💥 BARCODE SEARCH ERROR:', error);
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      throw error;
    }
  }

  /**
   * Search for food by QR code with automatic fallback
   * Priority: FatSecret → OpenFoodFacts
   * 
   * @param {string} qrCode - QR code data
   * @returns {Promise<Object|null>} Product data with source attribution
   */
  async searchByQRCode(qrCode) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 QR CODE SEARCH STARTED');
    console.log('📦 QR Code:', qrCode);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
      // ═══════════════════════════════════════════════════════════
      // STEP 1: Try FatSecret API
      // ═══════════════════════════════════════════════════════════
      console.log('');
      console.log('1️⃣  Trying FatSecret API...');
      
      const fatSecretResult = await this.searchFatSecretQR(qrCode);
      
      if (fatSecretResult) {
        console.log('');
        console.log('✅ SUCCESS: Found in FatSecret!');
        console.log('📊 Product:', fatSecretResult.food_name);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        return {
          ...fatSecretResult,
          _source: {
            database: 'FatSecret',
            attribution: 'Nutritional data provided by FatSecret Platform API',
            url: 'https://platform.fatsecret.com',
            disclaimer: 'FatSecret Platform API - Commercial nutritional database',
          },
        };
      }
      
      console.log('   ⚠️  Not found in FatSecret');
      
      // ═══════════════════════════════════════════════════════════
      // STEP 2: Try Philippines Food Database
      // ═══════════════════════════════════════════════════════════
      console.log('');
      console.log('2️⃣  Trying Philippines Food Database (QR as barcode)...');
      
      const philippinesResult = await PhilippinesFoodService.searchByBarcode(qrCode);
      
      if (philippinesResult) {
        console.log('');
        console.log('✅ SUCCESS: Found in Philippines Database!');
        console.log('📊 Product:', philippinesResult.food_name);
        console.log('🇵🇭 Filipino Product');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        return philippinesResult;
      }
      
      console.log('   ⚠️  Not found in Philippines Database');
      
      // ═══════════════════════════════════════════════════════════
      // STEP 3: Try treating QR code as barcode for OpenFoodFacts
      // ═══════════════════════════════════════════════════════════
      console.log('');
      console.log('3️⃣  Trying OpenFoodFacts (QR as barcode)...');
      
      const openFoodFactsResult = await OpenFoodFactsService.getProductByBarcode(qrCode);
      
      if (openFoodFactsResult) {
        console.log('');
        console.log('✅ SUCCESS: Found in OpenFoodFacts!');
        console.log('📊 Product:', openFoodFactsResult.food_name);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        return openFoodFactsResult;
      }
      
      console.log('   ⚠️  Not found in OpenFoodFacts');
      console.log('');
      console.log('❌ SEARCH FAILED: QR code not found in any database');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      return null;
      
    } catch (error) {
      console.error('');
      console.error('💥 QR CODE SEARCH ERROR:', error);
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      throw error;
    }
  }

  /**
   * Search FatSecret API via EC2 backend (barcode)
   * @private
   */
  async searchFatSecret(barcode) {
    try {
      const response = await fetch(
        `${EC2_BACKEND_URL}/fatsecret/barcode?barcode=${encodeURIComponent(barcode)}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        console.log(`   ⚠️  FatSecret API returned ${response.status}`);
        return null;
      }
      
      const data = await response.json();
      
      // Check if food was found
      if (data.error || !data.food) {
        console.log('   ⚠️  FatSecret returned no results');
        return null;
      }
      
      return data.food;
      
    } catch (error) {
      console.error('   ❌ FatSecret API error:', error.message);
      return null;
    }
  }

  /**
   * Search FatSecret API via EC2 backend (QR code)
   * @private
   */
  async searchFatSecretQR(qrCode) {
    try {
      const response = await fetch(
        `${EC2_BACKEND_URL}/fatsecret/qr?qr_code=${encodeURIComponent(qrCode)}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        console.log(`   ⚠️  FatSecret API returned ${response.status}`);
        return null;
      }
      
      const data = await response.json();
      
      // Check if food was found
      if (data.error || !data.food) {
        console.log('   ⚠️  FatSecret returned no results');
        return null;
      }
      
      return data.food;
      
    } catch (error) {
      console.error('   ❌ FatSecret QR API error:', error.message);
      return null;
    }
  }

  /**
   * Format nutrition data for display
   * Works with both FatSecret and OpenFoodFacts formats
   * 
   * @param {Object} product - Product data from either source
   * @returns {Array} Formatted nutrition facts
   */
  getNutritionFacts(product) {
    // Handle both FatSecret and OpenFoodFacts formats
    const serving = product.servings?.serving || {};
    
    // If it's an array (FatSecret sometimes returns array), get first item
    const servingData = Array.isArray(serving) ? serving[0] : serving;
    
    const facts = [
      {
        label: 'Serving Size',
        value: servingData.serving_description || servingData.metric_serving_amount + servingData.metric_serving_unit || '100g',
        isHeader: true,
      },
      {
        label: 'Calories',
        value: servingData.calories || 0,
        unit: 'kcal',
        bold: true,
      },
      {
        label: 'Total Fat',
        value: servingData.fat || 0,
        unit: 'g',
      },
      {
        label: 'Saturated Fat',
        value: servingData.saturated_fat || 0,
        unit: 'g',
        indent: true,
      },
      {
        label: 'Cholesterol',
        value: servingData.cholesterol || 0,
        unit: 'mg',
      },
      {
        label: 'Sodium',
        value: servingData.sodium || 0,
        unit: 'mg',
      },
      {
        label: 'Total Carbohydrate',
        value: servingData.carbohydrate || 0,
        unit: 'g',
      },
      {
        label: 'Dietary Fiber',
        value: servingData.fiber || 0,
        unit: 'g',
        indent: true,
      },
      {
        label: 'Sugars',
        value: servingData.sugar || 0,
        unit: 'g',
        indent: true,
      },
      {
        label: 'Protein',
        value: servingData.protein || 0,
        unit: 'g',
      },
    ];
    
    // Filter out zero values (except header)
    return facts.filter(fact => fact.isHeader || (fact.value && parseFloat(fact.value) > 0));
  }

  /**
   * Get source attribution info for display
   * @param {Object} product - Product data
   * @returns {Object} Attribution info
   */
  getSourceAttribution(product) {
    const source = product._source || {};
    
    // Determine icon based on database
    let iconName = 'nutrition';
    let iconColor = '#FF6B6B';
    
    if (source.database === 'FatSecret') {
      iconName = 'nutrition';
      iconColor = '#FF6B6B';
    } else if (source.database === 'Philippines Food Database' || source.database?.includes('Philippines')) {
      iconName = 'flag'; // 🇵🇭 Philippines flag icon
      iconColor = '#0038A8'; // Blue from Philippines flag
    } else if (source.database?.includes('OpenFoodFacts')) {
      iconName = 'leaf';
      iconColor = '#51CF66';
    }
    
    return {
      database: source.database || 'Unknown',
      attribution: source.attribution || 'Nutritional data from third-party source',
      url: source.url || '',
      disclaimer: source.disclaimer || '',
      license: source.license || '',
      
      // UI display helpers
      iconName: iconName,
      iconColor: iconColor,
      badgeText: `from ${source.database || 'Unknown'}`,
    };
  }
}

export default new BarcodeScannerService();
