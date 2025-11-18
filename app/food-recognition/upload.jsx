import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ScrollView,
  Platform,
  StatusBar,
} from 'react-native';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import BarcodeScannerModal from '../../components/barcode-scanner-modal';
import QRScannerModal from '../../components/qr-scanner-modal';
import OCRScannerModal from '../../components/ocr-scanner-modal';
import { supabase } from '../../lib/supabase';

export default function FoodRecognitionUpload() {
  const [barcodeScannerVisible, setBarcodeScannerVisible] = useState(false);
  const [qrScannerVisible, setQrScannerVisible] = useState(false);
  const [ocrVisible, setOcrVisible] = useState(false);

  // Helper function to determine category
  const determineFoodCategory = (foodName) => {
    const name = foodName.toLowerCase();

    if (/apple|banana|orange|grape|strawberry|mango|pineapple|watermelon|kiwi|berry/i.test(name)) {
      return 'Fruits';
    }
    if (/carrot|tomato|potato|onion|lettuce|cabbage|spinach|broccoli|pepper|cucumber/i.test(name)) {
      return 'Vegetables';
    }
    if (/chicken|beef|pork|fish|salmon|tuna|egg|tofu|meat|steak/i.test(name)) {
      return 'Meat & Protein';
    }
    if (/milk|cheese|yogurt|butter|cream|dairy/i.test(name)) {
      return 'Dairy';
    }
    if (/rice|bread|pasta|noodle|wheat|cereal|oat/i.test(name)) {
      return 'Grains';
    }
    if (/juice|soda|coffee|tea|water|drink|beverage/i.test(name)) {
      return 'Beverages';
    }
    if (/chip|cookie|candy|chocolate|snack|cracker/i.test(name)) {
      return 'Snacks';
    }

    return 'Other';
  };

  // Helper function to estimate expiry date
  const estimateExpiryDate = (category) => {
    const now = new Date();
    const expiryDays = {
      'Fruits': 7,
      'Vegetables': 7,
      'Meat & Protein': 3,
      'Dairy': 7,
      'Grains': 30,
      'Beverages': 90,
      'Snacks': 60,
      'Other': 14
    };

    const days = expiryDays[category] || 14;
    now.setDate(now.getDate() + days);
    return now.toISOString();
  };

  // Add item to Supabase
  const addItemToInventory = async (itemName, metadata = {}) => {
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        Alert.alert('Error', 'You must be logged in to add items');
        return false;
      }

      // Get user's first inventory
      const { data: inventories, error: invError } = await supabase
        .from('inventories')
        .select('*')
        .eq('userID', user.id)
        .order('createdAt', { ascending: true })
        .limit(1);

      if (invError) {
        console.error('Inventory error:', invError);
        Alert.alert('Error', 'Failed to fetch inventory');
        return false;
      }

      let inventoryID;

      if (!inventories || inventories.length === 0) {
        // Create default inventory if none exists
        const { data: newInventory, error: createError } = await supabase
          .from('inventories')
          .insert({
            userID: user.id,
            inventoryColor: '#8BC34A',
            maxItems: 100,
            inventoryTags: { name: 'My Pantry' }
          })
          .select()
          .single();

        if (createError) {
          console.error('Create inventory error:', createError);
          Alert.alert('Error', 'Failed to create inventory');
          return false;
        }
        inventoryID = newInventory.inventoryID;
      } else {
        inventoryID = inventories[0].inventoryID;
      }

      // Determine category and expiry
      const category = determineFoodCategory(itemName);
      const expiryDate = estimateExpiryDate(category);

      // Insert the pantry item
      const { data: newItem, error: itemError } = await supabase
        .from('pantry_items')
        .insert({
          inventoryID,
          itemName,
          category,
          quantity: 1,
          unit: 'pcs',
          expiryDate,
          itemTags: {
            scannedAt: new Date().toISOString(),
            ...metadata
          }
        })
        .select()
        .single();

      if (itemError) {
        console.error('Item insert error:', itemError);
        Alert.alert('Error', `Failed to add item: ${itemError.message}`);
        return false;
      }

      // Update inventory count
      const { error: updateError } = await supabase
        .from('inventories')
        .update({
          itemCount: inventories[0].itemCount + 1,
          updatedAt: new Date().toISOString()
        })
        .eq('inventoryID', inventoryID);

      if (updateError) {
        console.warn('Count update error:', updateError);
      }

      return true;

    } catch (error) {
      console.error('Add to inventory error:', error);
      Alert.alert('Error', 'Failed to add item to pantry');
      return false;
    }
  };

  const pickImage = async (useCamera = false) => {
    const permissionMethod = useCamera
      ? ImagePicker.requestCameraPermissionsAsync
      : ImagePicker.requestMediaLibraryPermissionsAsync;

    const { status } = await permissionMethod();

    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        `Please allow ${useCamera ? 'camera' : 'photo library'} access to continue.`
      );
      return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      })
      : await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

    if (!result.canceled && result.assets[0]) {
      router.push({
        pathname: '/food-recognition/result',
        params: { uri: result.assets[0].uri },
      });
    }
  };

  const handleFoodFound = async (food) => {
    console.log('Food found:', food);

    const foodName = food.food_name || 'Unknown Food';

    Alert.alert(
      'Food Found!',
      `${foodName}\n\nAdd to your pantry?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add to Pantry',
          onPress: async () => {
            // Parse nutrition info
            const serving = food.servings?.serving;
            const servingData = Array.isArray(serving) ? serving[0] : serving;

            const metadata = {
              source: 'barcode',
              food_id: food.food_id,
              brand: food.brand_name,
              calories: servingData?.calories,
              protein: servingData?.protein,
              carbs: servingData?.carbohydrate,
              fat: servingData?.fat,
            };

            const success = await addItemToInventory(foodName, metadata);

            if (success) {
              Alert.alert(
                'Added to Pantry! ✅',
                `${foodName} has been added to your pantry.`,
                [
                  { text: 'View Pantry', onPress: () => router.push('/(tabs)/pantry') },
                  { text: 'OK' },
                ]
              );
            }
          },
        },
      ]
    );
  };

  const handleTextExtracted = async (text) => {
    console.log('Text extracted:', text);

    // Parse OCR text into item names (split by newlines)
    const items = text.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (items.length === 0) {
      Alert.alert('No Items', 'No valid items found in the text.');
      return;
    }

    Alert.alert(
      'Add Items to Pantry?',
      `Found ${items.length} item(s):\n${items.slice(0, 5).join('\n')}${items.length > 5 ? '\n...' : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add All',
          onPress: async () => {
            let successCount = 0;

            for (const itemName of items) {
              const success = await addItemToInventory(itemName, {
                source: 'ocr',
                extractedText: text
              });

              if (success) successCount++;
            }

            Alert.alert(
              'Items Added! ✅',
              `Successfully added ${successCount} of ${items.length} items to your pantry.`,
              [
                { text: 'View Pantry', onPress: () => router.push('/(tabs)/pantry') },
                { text: 'OK' }
              ]
            );
          }
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={wp('6%')} color="#333" />
          </TouchableOpacity>
          <View style={{ width: wp('6%') }} />
        </View>

        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.heroIconContainer}>
            <Ionicons name="scan" size={wp('12%')} color="#81A969" />
          </View>
          <Text style={styles.heroTitle}>Scan & Add Food</Text>
          <Text style={styles.heroSubtitle}>
            Choose your preferred method to quickly add items to your pantry
          </Text>
        </View>

        {/* Primary Actions */}
        <View style={styles.primaryActionsContainer}>
          <Text style={styles.sectionLabel}>Food Recognition</Text>

          <View style={styles.primaryGrid}>
            {/* AI Photo Recognition */}
            <TouchableOpacity
              style={styles.primaryCard}
              onPress={() => pickImage(true)}
              activeOpacity={0.8}
            >
              <View style={[styles.primaryIconCircle, { backgroundColor: '#E3F2FD' }]}>
                <Ionicons name="camera" size={wp('10%')} color="#2196F3" />
              </View>
              <Text style={styles.primaryCardTitle}>Camera</Text>
              <Text style={styles.primaryCardSubtitle}>AI Recognition</Text>
            </TouchableOpacity>

            {/* Gallery Upload */}
            <TouchableOpacity
              style={styles.primaryCard}
              onPress={() => pickImage(false)}
              activeOpacity={0.8}
            >
              <View style={[styles.primaryIconCircle, { backgroundColor: '#F3E5F5' }]}>
                <Ionicons name="images" size={wp('10%')} color="#9C27B0" />
              </View>
              <Text style={styles.primaryCardTitle}>Gallery</Text>
              <Text style={styles.primaryCardSubtitle}>AI Recognition</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Secondary Options */}
        <View style={styles.secondaryOptionsContainer}>
          <Text style={styles.sectionLabel}>More Options</Text>

          {/* Barcode Scanner */}
          <TouchableOpacity
            style={styles.secondaryOption}
            onPress={() => setBarcodeScannerVisible(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.secondaryIconCircle, { backgroundColor: '#E8F5E9' }]}>
              <Ionicons name="barcode" size={wp('6%')} color="#4CAF50" />
            </View>
            <View style={styles.secondaryTextContainer}>
              <Text style={styles.secondaryTitle}>Scan Barcode</Text>
              <Text style={styles.secondaryDescription}>
                Get product information instantly
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={wp('5%')} color="#999" />
          </TouchableOpacity>

          {/* QR Code */}
          <TouchableOpacity
            style={styles.secondaryOption}
            onPress={() => setQrScannerVisible(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.secondaryIconCircle, { backgroundColor: '#E3F2FD' }]}>
              <Ionicons name="qr-code" size={wp('6%')} color="#2196F3" />
            </View>
            <View style={styles.secondaryTextContainer}>
              <Text style={styles.secondaryTitle}>QR Code</Text>
              <Text style={styles.secondaryDescription}>
                Scan product QR codes
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={wp('5%')} color="#999" />
          </TouchableOpacity>

          {/* OCR Text Scanner */}
          <TouchableOpacity
            style={styles.secondaryOption}
            onPress={() => setOcrVisible(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.secondaryIconCircle, { backgroundColor: '#FFF3E0' }]}>
              <Ionicons name="document-text" size={wp('6%')} color="#FF9800" />
            </View>
            <View style={styles.secondaryTextContainer}>
              <Text style={styles.secondaryTitle}>Text Scanner (OCR)</Text>
              <Text style={styles.secondaryDescription}>
                Extract text from labels and lists
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={wp('5%')} color="#999" />
          </TouchableOpacity>
        </View>

        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <View style={styles.infoBannerIcon}>
            <Ionicons name="checkmark-circle" size={wp('5%')} color="#2E7D32" />
          </View>
          <Text style={styles.infoBannerText}>
            All scanned items are automatically saved to your pantry
          </Text>
        </View>
      </ScrollView>

      {/* Modals */}
      <BarcodeScannerModal
        visible={barcodeScannerVisible}
        onClose={() => setBarcodeScannerVisible(false)}
        onFoodFound={handleFoodFound}
      />

      <QRScannerModal
        visible={qrScannerVisible}
        onClose={() => setQrScannerVisible(false)}
        onFoodFound={handleFoodFound}
      />

      <OCRScannerModal
        visible={ocrVisible}
        onClose={() => setOcrVisible(false)}
        onTextExtracted={handleTextExtracted}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: hp('3%'),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('2%'),
    backgroundColor: '#fff',
  },
  backButton: {
    padding: wp('2%'),
  },
  headerTitle: {
    fontSize: wp('4.8%'),
    fontWeight: '700',
    color: '#333',
  },

  // Hero Section
  heroSection: {
    alignItems: 'center',
    paddingHorizontal: wp('5%'),
    paddingTop: hp('3%'),
    paddingBottom: hp('4%'),
  },
  heroIconContainer: {
    width: wp('24%'),
    height: wp('24%'),
    borderRadius: wp('12%'),
    backgroundColor: '#F1F8EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp('2%'),
  },
  heroTitle: {
    fontSize: wp('7%'),
    fontWeight: '700',
    color: '#333',
    marginBottom: hp('1%'),
  },
  heroSubtitle: {
    fontSize: wp('3.8%'),
    color: '#666',
    textAlign: 'center',
    lineHeight: hp('2.8%'),
    paddingHorizontal: wp('5%'),
  },

  // Section Labels
  sectionLabel: {
    fontSize: wp('4.2%'),
    fontWeight: '600',
    color: '#333',
    marginBottom: hp('2%'),
  },

  // Primary Actions (Grid)
  primaryActionsContainer: {
    paddingHorizontal: wp('5%'),
    marginBottom: hp('3%'),
  },
  primaryGrid: {
    flexDirection: 'row',
    gap: wp('4%'),
  },
  primaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: wp('4%'),
    padding: wp('5%'),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  primaryIconCircle: {
    width: wp('18%'),
    height: wp('18%'),
    borderRadius: wp('9%'),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp('1.5%'),
  },
  primaryCardTitle: {
    fontSize: wp('4.2%'),
    fontWeight: '700',
    color: '#333',
    marginBottom: hp('0.3%'),
  },
  primaryCardSubtitle: {
    fontSize: wp('3.2%'),
    color: '#666',
  },

  // Secondary Options (List)
  secondaryOptionsContainer: {
    paddingHorizontal: wp('5%'),
    marginBottom: hp('3%'),
  },
  secondaryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: wp('3%'),
    padding: wp('4%'),
    marginBottom: hp('1.5%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F5F5F5',
  },
  secondaryIconCircle: {
    width: wp('12%'),
    height: wp('12%'),
    borderRadius: wp('6%'),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp('3.5%'),
  },
  secondaryTextContainer: {
    flex: 1,
  },
  secondaryTitle: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#333',
    marginBottom: hp('0.3%'),
  },
  secondaryDescription: {
    fontSize: wp('3.2%'),
    color: '#666',
    lineHeight: hp('2%'),
  },

  // Info Banner
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F8EC',
    borderRadius: wp('3%'),
    padding: wp('4%'),
    marginHorizontal: wp('5%'),
    borderLeftWidth: 4,
    borderLeftColor: '#81A969',
  },
  infoBannerIcon: {
    marginRight: wp('3%'),
  },
  infoBannerText: {
    flex: 1,
    fontSize: wp('3.3%'),
    color: '#2E7D32',
    lineHeight: hp('2.2%'),
    fontWeight: '500',
  },
});