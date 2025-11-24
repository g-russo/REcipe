import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import BarcodeScannerService from '../services/barcode-scanner-service';
import { supabase, safeGetUser } from '../lib/supabase';
import PantryService from '../services/pantry-service'; // ✅ Import PantryService

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

export default function BarcodeScannerModal({ visible, onClose, onBarcodeScanned }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [productData, setProductData] = useState(null);
  const [scannedCode, setScannedCode] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const cameraRef = useRef(null);

  // ✅ NEW: Add these states (same as result.jsx)
  const [addingToInventory, setAddingToInventory] = useState(false);
  const [inventories, setInventories] = useState([]);

  // ✅ Group Selection Alert State
  const [groupSelectionAlert, setGroupSelectionAlert] = useState({
    visible: false,
    message: '',
    groups: [],
    onSelectGroup: null,
    singleGroupMode: false
  });

  // ✅ Duplicate Alert State
  const [duplicateAlert, setDuplicateAlert] = useState({
    visible: false,
    itemData: null,
    duplicateItem: null,
    canMerge: false,
    numericUserID: null,
    resolve: null
  });

  // ✅ Success Modal State
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [addedItemName, setAddedItemName] = useState('');

  useEffect(() => {
    if (visible) {
      setScanned(false);
      setProductData(null);
      setScannedCode(null);
    }
  }, [visible]);

  // ✅ UPDATED: Add to Pantry function using PantryService (same as result.jsx)
  const handleAddToInventory = async () => {
    if (!productData) {
      Alert.alert('Error', 'No product data available');
      return;
    }

    setAddingToInventory(true);

    try {
      const { data: { user }, error: userError } = await safeGetUser();
      if (userError || !user) {
        Alert.alert('Error', 'You must be logged in to add items');
        setAddingToInventory(false);
        return;
      }

      // ✅ FIX: Get numeric userID from tbl_users (same as result.jsx)
      const { data: userData, error: userLookupError } = await supabase
        .from('tbl_users')
        .select('userID')
        .eq('userEmail', user.email)
        .single();

      if (userLookupError || !userData) {
        Alert.alert('Error', 'Failed to find user in database. Please try logging out and back in.');
        setAddingToInventory(false);
        return;
      }

      const numericUserID = userData.userID;

      console.log('🔑 User Email:', user.email);
      console.log('🔢 Numeric UserID:', numericUserID);

      // ✅ Fetch user's inventories using PantryService
      const { data: userInventories, error: invError } = await supabase
        .from('tbl_inventories')
        .select('*')
        .eq('userID', numericUserID)
        .order('createdAt', { ascending: true });

      if (invError) {
        console.error('Inventory error:', invError);
        Alert.alert('Error', `Failed to fetch inventories: ${invError.message}`);
        setAddingToInventory(false);
        return;
      }

      let inventoryList = userInventories || [];

      // ✅ Create default inventory if none exists using PantryService
      if (inventoryList.length === 0) {
        const newInventory = await PantryService.createInventory(numericUserID, {
          inventoryColor: '#8BC34A',
          maxItems: 100,
          inventoryTags: { name: 'My Pantry' },
        });
        inventoryList = [newInventory];
      }

      setInventories(inventoryList);

      const foodName = productData.food_name || productData.product_name || 'Unknown Food';
      const category = determineFoodCategory(foodName);
      const expiryDate = estimateExpiryDate(category);

      const serving = productData.servings?.serving;
      const servingData = Array.isArray(serving) ? serving[0] : serving;

      const itemData = {
        inventoryID: inventoryList[0].inventoryID,
        itemName: foodName,
        itemCategory: category, // ✅ Use itemCategory (not category)
        quantity: 1,
        unit: 'pcs',
        itemExpiration: expiryDate, // ✅ Use itemExpiration (not expiryDate)
        itemTags: {
          scannedAt: new Date().toISOString(),
          source: 'barcode',
          barcode: scannedCode,
          food_id: productData.food_id,
          brand: productData.brand_name || productData.brands,
          calories: servingData?.calories || productData.nutriments?.['energy-kcal_100g'],
          protein: servingData?.protein || productData.nutriments?.proteins_100g,
          carbs: servingData?.carbohydrate || productData.nutriments?.carbohydrates_100g,
          fat: servingData?.fat || productData.nutriments?.fat_100g,
        }
      };

      // ✅ Check for duplicates
      const { data: existingItems, error: searchError } = await supabase
        .from('tbl_items')
        .select('*')
        .eq('inventoryID', inventoryList[0].inventoryID);

      if (!searchError && existingItems) {
        const normalizedNewName = itemData.itemName.trim().toLowerCase();
        const duplicateItem = existingItems.find(
          item => item.itemName.trim().toLowerCase() === normalizedNewName
        );

        if (duplicateItem) {
          const canMerge =
            duplicateItem.unit?.trim().toLowerCase() === itemData.unit?.trim().toLowerCase() &&
            !isNaN(Number(duplicateItem.quantity)) &&
            !isNaN(Number(itemData.quantity));

          await new Promise((resolve) => {
            setDuplicateAlert({
              visible: true,
              itemData,
              duplicateItem,
              canMerge,
              numericUserID,
              resolve
            });
          });
          setAddingToInventory(false);
          return;
        }
      }

      // ✅ No duplicate - create item using PantryService
      await addItemDirectly(itemData, numericUserID);

    } catch (error) {
      console.error('Add to inventory error:', error);
      Alert.alert('Error', 'Failed to add item to pantry');
    } finally {
      setAddingToInventory(false);
    }
  };

  // ✅ Check and add to matching group (same as result.jsx)
  const checkAndAddToMatchingGroup = async (item, inventoryID) => {
    if (!item.itemCategory) return;

    try {
      const { data: groups, error: groupsError } = await supabase
        .from('tbl_groups')
        .select('*')
        .eq('inventoryID', inventoryID)
        .eq('groupCategory', item.itemCategory);

      if (groupsError || !groups || groups.length === 0) return;

      if (groups.length === 1) {
        const group = groups[0];
        await new Promise((resolve) => {
          setGroupSelectionAlert({
            visible: true,
            message: `"${item.itemName}" will be added to your ${group.groupTitle} group.`,
            groups: [group],
            onSelectGroup: async () => {
              try {
                await PantryService.addItemToGroup(item.itemID, group.groupID);
                console.log(`✅ Added item to group "${group.groupTitle}"`);
              } catch (error) {
                if (!error.message?.includes('already in this group')) {
                  console.error('Error adding to group:', error);
                }
              }
              setGroupSelectionAlert({ visible: false, message: '', groups: [], onSelectGroup: null, singleGroupMode: false });
              resolve();
            },
            singleGroupMode: true
          });
        });
      } else if (groups.length > 1) {
        await new Promise((resolve) => {
          setGroupSelectionAlert({
            visible: true,
            message: `You have ${groups.length} groups for ${item.itemCategory} items.\n\nChoose one to add "${item.itemName}" to:`,
            groups: groups.slice(0, 3),
            onSelectGroup: async (selectedGroup) => {
              try {
                await PantryService.addItemToGroup(item.itemID, selectedGroup.groupID);
                console.log(`✅ Added item to group "${selectedGroup.groupTitle}"`);
              } catch (error) {
                if (!error.message?.includes('already in this group')) {
                  console.error('Error adding to group:', error);
                }
              }
              setGroupSelectionAlert({ visible: false, message: '', groups: [], onSelectGroup: null, singleGroupMode: false });
              resolve();
            },
            singleGroupMode: false
          });
        });
      }
    } catch (error) {
      console.error('Error checking for matching groups:', error);
    }
  };

  // ✅ Add item directly using PantryService (FIXED)
  const addItemDirectly = async (itemData, numericUserID) => {
    try {
      // ✅ Use PantryService.createItem (handles RLS properly)
      const createdItem = await PantryService.createItem({
        ...itemData,
        userID: numericUserID,
      });

      // Check for matching groups
      await checkAndAddToMatchingGroup(createdItem, itemData.inventoryID);

      setAddedItemName(itemData.itemName);
      setSuccessModalVisible(true);

    } catch (error) {
      console.error('Direct add error:', error);
      Alert.alert('Error', error.message || 'Failed to add item');
    }
  };

  // ✅ Handle duplicate merge (UPDATED to use PantryService)
  const handleDuplicateMerge = async () => {
    const { itemData, duplicateItem, numericUserID, resolve } = duplicateAlert;

    try {
      const newQuantity = parseFloat(duplicateItem.quantity) + parseFloat(itemData.quantity);

      // ✅ Use PantryService.updateItem
      await PantryService.updateItem(duplicateItem.itemID, {
        quantity: newQuantity,
        userID: numericUserID,
      });

      // Check for matching groups
      await checkAndAddToMatchingGroup(duplicateItem, itemData.inventoryID);

      setAddedItemName(itemData.itemName);
      setSuccessModalVisible(true);
      resolve();

    } catch (error) {
      console.error('Merge error:', error);
      Alert.alert('Error', 'Failed to merge items');
    } finally {
      setDuplicateAlert({ ...duplicateAlert, visible: false });
    }
  };

  // ✅ Handle duplicate create new (UPDATED)
  const handleDuplicateCreate = async () => {
    const { itemData, numericUserID, resolve } = duplicateAlert;

    try {
      await addItemDirectly(itemData, numericUserID);
      resolve();
    } catch (error) {
      console.error('Create error:', error);
    } finally {
      setDuplicateAlert({ ...duplicateAlert, visible: false });
    }
  };

  // ✅ ADD THIS: Handle duplicate cancel
  const handleDuplicateCancel = () => {
    const { resolve } = duplicateAlert;
    setDuplicateAlert({ ...duplicateAlert, visible: false });
    resolve?.();
  };

  const handleBarcodeScanned = async ({ data }) => {
    if (scanned || isProcessing) return;

    setScanned(true);
    setIsProcessing(true);
    setScannedCode(data);

    try {
      console.log('📊 Scanned barcode:', data);
      const result = await BarcodeScannerService.searchByBarcode(data);

      console.log('🔍 Full result object:', JSON.stringify(result, null, 2));

      const foodData = result?.food || result?.product || result;

      if (foodData && (foodData.food_name || foodData.product_name)) {
        console.log('✅ Food found:', foodData);
        setProductData(foodData);
      } else {
        console.log('❌ No food data found in result:', result);
        Alert.alert('Not Found', 'No food information found for this barcode.');
        setScanned(false);
      }
    } catch (error) {
      console.error('❌ Barcode scan error:', error);
      Alert.alert('Error', error.message || 'Failed to fetch food information');
      setScanned(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const pickImageFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
        allowsMultipleSelection: false,
      });

      if (result.canceled) return;

      Alert.alert(
        'Feature Coming Soon',
        'Barcode scanning from gallery images will be available in a future update. Please use the camera for now.'
      );
    } catch (error) {
      console.error('❌ Gallery picker error:', error);
      Alert.alert('Error', 'Failed to pick image: ' + error.message);
    }
  };

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={styles.container}>
          <View style={styles.permissionContainer}>
            <Ionicons name="camera-outline" size={64} color="#666" />
            <Text style={styles.permissionText}>
              Camera permission is required to scan barcodes
            </Text>
            <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
              <Text style={styles.permissionButtonText}>Grant Permission</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={32} color="#FFF" />
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  // Product details view
  if (productData && !loading) {
    const nutritionFacts = BarcodeScannerService.getNutritionFacts(productData);
    const source = BarcodeScannerService.getSourceAttribution(productData);
    const foodName = productData.food_name || productData.product_name || 'Unknown Product';

    return (
      <>
        <Modal visible={visible} animationType="slide">
          <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={onClose} style={styles.closeIconButton}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Product Details</Text>
              <View style={{ width: 28 }} />
            </View>

            <ScrollView style={styles.detailsContainer}>
              {/* Product Header */}
              <View style={styles.productHeader}>
                <View style={styles.productIconContainer}>
                  <Ionicons name="nutrition" size={48} color="#81A969" />
                </View>
                <Text style={styles.productName}>{foodName}</Text>

                {/* Source Badge */}
                <View style={[styles.sourceBadge, { backgroundColor: source.iconColor + '20' }]}>
                  <Ionicons name={source.iconName} size={16} color={source.iconColor} />
                  <Text style={[styles.sourceBadgeText, { color: source.iconColor }]}>
                    {source.badgeText}
                  </Text>
                </View>
              </View>

              {/* Barcode */}
              <View style={styles.barcodeSection}>
                <Ionicons name="barcode-outline" size={20} color="#666" />
                <Text style={styles.barcodeText}>{scannedCode}</Text>
              </View>

              {/* Nutrition Facts */}
              <View style={styles.nutritionCard}>
                <View style={styles.sectionTitleContainer}>
                  <Ionicons name="restaurant-outline" size={22} color="#81A969" />
                  <Text style={styles.sectionTitle}>Nutrition Facts</Text>
                </View>
                {nutritionFacts.map((fact, index) => (
                  <View
                    key={index}
                    style={[
                      styles.nutritionRow,
                      fact.isHeader && styles.nutritionHeader,
                      fact.indent && styles.nutritionIndent,
                    ]}
                  >
                    <Text style={[
                      styles.nutritionLabel,
                      fact.bold && styles.nutritionBold,
                      fact.isHeader && styles.nutritionHeaderText,
                    ]}>
                      {fact.label}
                    </Text>
                    <Text style={[
                      styles.nutritionValue,
                      fact.bold && styles.nutritionBold,
                      fact.isHeader && styles.nutritionHeaderText,
                    ]}>
                      {fact.value}{fact.unit ? ` ${fact.unit}` : ''}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Attribution */}
              <View style={styles.attributionCard}>
                <View style={styles.sectionTitleContainer}>
                  <Ionicons name="information-circle-outline" size={22} color="#81A969" />
                  <Text style={styles.attributionTitle}>Data Source</Text>
                </View>
                <Text style={styles.attributionText}>{source.attribution}</Text>

                {source.url && (
                  <TouchableOpacity onPress={() => Linking.openURL(source.url)}>
                    <Text style={styles.attributionLink}>Learn more →</Text>
                  </TouchableOpacity>
                )}

                {source.license && (
                  <Text style={styles.licenseText}>License: {source.license}</Text>
                )}
              </View>
            </ScrollView>

            {/* ✅ FIXED: Action Buttons with adjusted text sizes */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.scanAgainButton}
                onPress={() => {
                  setScanned(false);
                  setProductData(null);
                  setScannedCode(null);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="scan" size={18} color="#81A969" />
                <Text style={styles.scanAgainButtonText}>Scan</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.addButton, addingToInventory && styles.addButtonDisabled]}
                onPress={handleAddToInventory}
                disabled={addingToInventory}
                activeOpacity={0.8}
              >
                {addingToInventory ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="add-circle" size={18} color="#fff" />
                    <Text style={styles.addButtonText}>Add</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.useProductButton}
                onPress={() => {
                  onBarcodeScanned?.(productData);
                  onClose();
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={styles.useProductButtonText}>Use</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ✅ Group Selection Alert Modal */}
        <Modal
          transparent={true}
          visible={groupSelectionAlert.visible}
          onRequestClose={() => setGroupSelectionAlert({ ...groupSelectionAlert, visible: false })}
        >
          <View style={styles.centeredView}>
            <View style={styles.modalView}>
              <Text style={styles.modalTitle}>{groupSelectionAlert.message}</Text>

              <ScrollView style={{ width: '100%', maxHeight: 300 }}>
                {groupSelectionAlert.groups.map((group) => (
                  <TouchableOpacity
                    key={group.groupID}
                    style={groupSelectionAlertStyles.groupButton}
                    onPress={async () => {
                      const { itemData } = duplicateAlert.visible ? duplicateAlert : { itemData: null };

                      setGroupSelectionAlert({ ...groupSelectionAlert, visible: false });

                      // Add to selected group
                      const item = itemData || {
                        inventoryID: group.inventoryID,
                        itemName: productData.food_name || productData.product_name,
                        category: determineFoodCategory(productData.food_name || productData.product_name),
                        quantity: 1,
                        unit: 'pcs',
                        expiryDate: estimateExpiryDate(determineFoodCategory(productData.food_name || productData.product_name)),
                        groupID: group.groupID,
                        itemTags: {
                          scannedAt: new Date().toISOString(),
                          source: 'barcode',
                          barcode: scannedCode
                        }
                      };

                      await addItemDirectly(item, group.inventoryID);
                      groupSelectionAlert.onSelectGroup?.();
                    }}
                  >
                    <Text style={groupSelectionAlertStyles.groupButtonText}>
                      {group.groupTags?.name || `Group ${group.groupID}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity
                style={[styles.button, styles.buttonClose]}
                onPress={() => {
                  setGroupSelectionAlert({ ...groupSelectionAlert, visible: false });
                  groupSelectionAlert.onSelectGroup?.();
                }}
              >
                <Text style={styles.textStyle}>Skip</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ✅ Duplicate Alert Modal */}
        <Modal
          transparent={true}
          visible={duplicateAlert.visible}
          onRequestClose={handleDuplicateCancel}
        >
          <View style={styles.centeredView}>
            <View style={styles.modalView}>
              <Text style={styles.modalTitle}>Duplicate Item Found</Text>
              <Text style={styles.modalText}>
                "{duplicateAlert.itemData?.itemName}" already exists in your pantry.
              </Text>

              {duplicateAlert.canMerge ? (
                <TouchableOpacity
                  style={duplicateAlertStyles.addToExistingButton}
                  onPress={handleDuplicateMerge}
                >
                  <Ionicons name="add-circle" size={20} color="#fff" />
                  <Text style={duplicateAlertStyles.addToExistingButtonText}>
                    Add to Existing ({duplicateAlert.duplicateItem?.quantity} {duplicateAlert.duplicateItem?.unit})
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={{ fontSize: 12, color: '#999', marginBottom: 10, textAlign: 'center' }}>
                  Cannot merge (different units or categories)
                </Text>
              )}

              <TouchableOpacity
                style={duplicateAlertStyles.addAnywayButton}
                onPress={handleDuplicateCreate}
              >
                <Ionicons name="duplicate" size={20} color="#81A969" />
                <Text style={duplicateAlertStyles.addAnywayButtonText}>
                  Add as Separate Item
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.buttonClose]}
                onPress={handleDuplicateCancel}
              >
                <Text style={styles.textStyle}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ✅ Success Modal */}
        <Modal
          transparent={true}
          visible={successModalVisible}
          onRequestClose={() => {
            setSuccessModalVisible(false);
            onClose();
          }}
        >
          <View style={styles.centeredView}>
            <View style={styles.modalView}>
              <Ionicons name="checkmark-circle" size={60} color="#81A969" />
              <Text style={styles.modalTitle}>Added to Pantry! ✅</Text>
              <Text style={styles.modalText}>
                {addedItemName} has been added to your pantry.
              </Text>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: '#81A969' }]}
                onPress={() => {
                  setSuccessModalVisible(false);
                  onClose();
                }}
              >
                <Text style={styles.textStyle}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: [
              'ean13',
              'ean8',
              'upc_a',
              'upc_e',
              'code128',
              'code39',
              'qr',
            ],
          }}
        />

        {/* Scanning Overlay */}
        <View style={styles.overlay}>
          <View style={styles.topOverlay}>
            <View style={styles.topHeader}>
              <View style={styles.headerContent}>
                <Ionicons name="barcode-outline" size={32} color="#FFF" />
                <Text style={styles.headerTitle}>Scan Barcode</Text>
              </View>
            </View>
          </View>
          <View style={styles.middleRow}>
            <View style={styles.sideOverlay} />
            <View style={styles.scanArea}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
              {scanned && (
                <View style={styles.scanningIndicator}>
                  <ActivityIndicator size="large" color="#81A969" />
                </View>
              )}
            </View>
            <View style={styles.sideOverlay} />
          </View>
          <View style={styles.bottomOverlay}>
            <View style={styles.instructionContainer}>
              <Text style={styles.instructionText}>
                {scanned ? 'Looking up product...' : 'Align barcode within the frame'}
              </Text>
              {!scanned && (
                <Text style={styles.instructionSubtext}>
                  Supported: EAN, UPC, Code 128, Code 39
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Loading Indicator */}
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#FFF" />
            <Text style={styles.loadingText}>Looking up barcode...</Text>
          </View>
        )}

        {/* Close Button */}
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={32} color="#FFF" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    width: '100%',
    justifyContent: 'flex-start',
  },
  topHeader: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '700',
  },
  middleRow: {
    flexDirection: 'row',
    height: 280,
  },
  sideOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  scanArea: {
    width: 300,
    height: 280,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#81A969',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 5,
    borderLeftWidth: 5,
    borderTopLeftRadius: 4,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 5,
    borderRightWidth: 5,
    borderTopRightRadius: 4,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 5,
    borderLeftWidth: 5,
    borderBottomLeftRadius: 4,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 5,
    borderRightWidth: 5,
    borderBottomRightRadius: 4,
  },
  scanningIndicator: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  bottomOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    width: '100%',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 40,
  },
  instructionContainer: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  instructionText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  instructionSubtext: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    textAlign: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFF',
    fontSize: 16,
    marginTop: 12,
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionText: {
    color: '#FFF',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  permissionButton: {
    backgroundColor: '#81A969',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Product Details Styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#81A969',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  closeIconButton: {
    padding: 8,
  },
  detailsContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  productHeader: {
    backgroundColor: '#fff',
    padding: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  productIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1F8E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  productName: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 12,
    textAlign: 'center',
    color: '#333',
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 8,
  },
  sourceBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  barcodeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  barcodeText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    fontFamily: 'monospace',
  },
  nutritionCard: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  nutritionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  nutritionHeader: {
    backgroundColor: '#F9F9F9',
    paddingHorizontal: 12,
    marginHorizontal: -12,
    borderBottomWidth: 2,
    borderBottomColor: '#E0E0E0',
  },
  nutritionIndent: {
    paddingLeft: 20,
  },
  nutritionLabel: {
    fontSize: 14,
    color: '#333',
  },
  nutritionValue: {
    fontSize: 14,
    color: '#666',
  },
  nutritionBold: {
    fontWeight: '700',
    color: '#000',
  },
  nutritionHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  attributionCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  attributionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  attributionText: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    marginBottom: 8,
    lineHeight: 18,
  },
  attributionLink: {
    fontSize: 12,
    color: '#81A969',
    fontWeight: '600',
    marginTop: 4,
  },
  licenseText: {
    fontSize: 10,
    color: '#999',
    marginTop: 8,
    fontStyle: 'italic',
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
    gap: 8,
  },
  scanAgainButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#81A969',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6, // ✅ Reduced gap
  },
  scanAgainButtonText: {
    color: '#81A969',
    fontSize: 14, // ✅ Reduced from 16
    fontWeight: '600',
  },
  addButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#81A969',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6, // ✅ Reduced gap
    shadowColor: '#81A969',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14, // ✅ Reduced from 16
    fontWeight: '600',
  },
  addButtonDisabled: {
    backgroundColor: '#ccc',
  },
  useProductButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B6B',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6, // ✅ Reduced gap
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  useProductButtonText: {
    color: '#fff',
    fontSize: 14, // ✅ Reduced from 16
    fontWeight: '600',
  },

  // ✅ Modal styles
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: 'rgba(0,0,0,0.5)'
  },
  modalView: {
    margin: 20,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 25,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    width: '85%',
    maxHeight: '70%'
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center'
  },
  modalText: {
    marginBottom: 15,
    textAlign: 'center',
    color: '#666'
  },
  button: {
    borderRadius: 12,
    padding: 10,
    elevation: 2,
    marginTop: 15,
    minWidth: 100,
    alignItems: 'center'
  },
  buttonClose: {
    backgroundColor: "#FF6B6B",
  },
  textStyle: {
    color: "white",
    fontWeight: "bold",
    textAlign: "center"
  },
});

// ✅ Group selection styles
const groupSelectionAlertStyles = StyleSheet.create({
  groupButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#81A969',
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  groupButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.3,
  },
});

// ✅ Duplicate alert styles
const duplicateAlertStyles = StyleSheet.create({
  addToExistingButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#81A969',
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addToExistingButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.3,
    marginLeft: 8,
  },
  addAnywayButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#81A969',
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  addAnywayButtonText: {
    color: '#81A969',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.3,
    marginLeft: 8,
  },
});