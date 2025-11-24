import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { extractText } from '../services/food-recog-api';
import { supabase } from '../lib/supabase';
import PantryService from '../services/pantry-service';

export default function OCRScannerModal({ visible, onClose, onTextExtracted }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedText, setScannedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedItems, setDetectedItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [ocrSource, setOcrSource] = useState(''); // 'tesseract', 'gemini', or 'openai'
  const [inventories, setInventories] = useState([]);
  const [addingToInventory, setAddingToInventory] = useState(false);

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
  const [addedItemsCount, setAddedItemsCount] = useState(0);

  useEffect(() => {
    if (visible && !permission?.granted) {
      requestPermission();
    }
  }, [visible]);

  // ✅ Helper function to determine category
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

  // ✅ Helper function to estimate expiry date
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
    
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const year = now.getFullYear();
    
    return `${month}/${day}/${year}`;
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

  // ✅ Add item directly using PantryService
  const addItemDirectly = async (itemData, numericUserID) => {
    try {
      const createdItem = await PantryService.createItem({
        ...itemData,
        userID: numericUserID,
      });

      await checkAndAddToMatchingGroup(createdItem, itemData.inventoryID);

      return createdItem;
    } catch (error) {
      console.error('Direct add error:', error);
      throw error;
    }
  };

  // ✅ Handle duplicate merge
  const handleDuplicateMerge = async () => {
    const { itemData, duplicateItem, numericUserID, resolve } = duplicateAlert;

    try {
      const newQuantity = parseFloat(duplicateItem.quantity) + parseFloat(itemData.quantity);

      await PantryService.updateItem(duplicateItem.itemID, {
        quantity: newQuantity,
        userID: numericUserID,
      });

      await checkAndAddToMatchingGroup(duplicateItem, itemData.inventoryID);

      resolve(true);
    } catch (error) {
      console.error('Merge error:', error);
      Alert.alert('Error', 'Failed to merge items');
      resolve(false);
    } finally {
      setDuplicateAlert({ ...duplicateAlert, visible: false });
    }
  };

  // ✅ Handle duplicate create new
  const handleDuplicateCreate = async () => {
    const { itemData, numericUserID, resolve } = duplicateAlert;

    try {
      await addItemDirectly(itemData, numericUserID);
      resolve(true);
    } catch (error) {
      console.error('Create error:', error);
      resolve(false);
    } finally {
      setDuplicateAlert({ ...duplicateAlert, visible: false });
    }
  };

  // ✅ Handle duplicate cancel
  const handleDuplicateCancel = () => {
    const { resolve } = duplicateAlert;
    setDuplicateAlert({ ...duplicateAlert, visible: false });
    resolve?.(false);
  };

  // ✅ Add selected items to inventory
  const handleAddToInventory = async () => {
    if (selectedItems.size === 0) {
      Alert.alert('No Selection', 'Please select at least one item to add');
      return;
    }

    setAddingToInventory(true);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        Alert.alert('Error', 'You must be logged in to add items');
        setAddingToInventory(false);
        return;
      }

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

      if (inventoryList.length === 0) {
        const newInventory = await PantryService.createInventory(numericUserID, {
          inventoryColor: '#8BC34A',
          maxItems: 100,
          inventoryTags: { name: 'My Pantry' },
        });
        inventoryList = [newInventory];
      }

      setInventories(inventoryList);

      let successCount = 0;

      for (const itemName of selectedItems) {
        const category = determineFoodCategory(itemName);
        const expiryDate = estimateExpiryDate(category);

        const itemData = {
          inventoryID: inventoryList[0].inventoryID,
          itemName,
          itemCategory: category,
          quantity: 1,
          unit: 'pcs',
          itemExpiration: expiryDate,
          itemTags: {
            scannedAt: new Date().toISOString(),
            source: 'ocr',
            ocrSource: ocrSource,
            extractedText: scannedText
          }
        };

        // Check for duplicates
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

            const userChoice = await new Promise((resolve) => {
              setDuplicateAlert({
                visible: true,
                itemData,
                duplicateItem,
                canMerge,
                numericUserID,
                resolve
              });
            });

            if (userChoice) successCount++;
            continue;
          }
        }

        try {
          await addItemDirectly(itemData, numericUserID);
          successCount++;
        } catch (error) {
          console.error(`Failed to add ${itemName}:`, error);
        }
      }

      setAddedItemsCount(successCount);
      setSuccessModalVisible(true);

    } catch (error) {
      console.error('Add to inventory error:', error);
      Alert.alert('Error', 'Failed to add items to pantry');
    } finally {
      setAddingToInventory(false);
    }
  };

  const handleTakePicture = async () => {
    try {
      setIsProcessing(true);

      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow camera access to scan text.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const response = await extractText(result.assets[0].uri);
        
        if (response.success && response.text) {
          setScannedText(response.text);
          setOcrSource(response.source);
          
          const items = response.text.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && line.length < 100); // Filter out very long lines

          setDetectedItems(items);
          setSelectedItems(new Set(items)); // Select all by default
          
          onTextExtracted?.(response.text);
        } else {
          Alert.alert('No Text Found', 'Could not extract text from the image.');
        }
      }
    } catch (error) {
      console.error('❌ OCR camera error:', error);
      Alert.alert('Error', error.message || 'Failed to extract text from image');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePickFromGallery = async () => {
    try {
      setIsProcessing(true);

      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow photo library access.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const response = await extractText(result.assets[0].uri);
        
        if (response.success && response.text) {
          setScannedText(response.text);
          setOcrSource(response.source);
          
          const items = response.text.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && line.length < 100);

          setDetectedItems(items);
          setSelectedItems(new Set(items)); // Select all by default
          
          onTextExtracted?.(response.text);
        } else {
          Alert.alert('No Text Found', 'Could not extract text from the image.');
        }
      }
    } catch (error) {
      console.error('❌ OCR gallery error:', error);
      Alert.alert('Error', error.message || 'Failed to extract text from image');
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleItemSelection = (item) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(item)) {
      newSelection.delete(item);
    } else {
      newSelection.add(item);
    }
    setSelectedItems(newSelection);
  };

  const selectAll = () => {
    setSelectedItems(new Set(detectedItems));
  };

  const deselectAll = () => {
    setSelectedItems(new Set());
  };

  if (!permission) {
    return null;
  }

  if (!permission.granted) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={80} color="#999" />
          <Text style={styles.permissionText}>Camera permission is required</Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <>
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeIcon}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
            <Text style={styles.title}>Text Scanner (OCR)</Text>
            <View style={{ width: 28 }} />
          </View>

          <View style={styles.infoContainer}>
            <Ionicons name="information-circle" size={24} color="#2196F3" />
            <Text style={styles.infoText}>
              Take a photo or choose from gallery to extract text from labels and lists
            </Text>
          </View>

          {detectedItems.length > 0 ? (
            <View style={styles.resultContainer}>
              {/* AI Source Badge */}
              <View style={styles.sourceBadgeContainer}>
                <Ionicons 
                  name={ocrSource === 'gemini' ? 'sparkles' : ocrSource === 'openai' ? 'flash' : 'eye'} 
                  size={16} 
                  color={ocrSource === 'gemini' ? '#673AB7' : ocrSource === 'openai' ? '#10a37f' : '#FF6B6B'} 
                />
                <Text style={[styles.sourceBadgeText, {
                  color: ocrSource === 'gemini' ? '#673AB7' : ocrSource === 'openai' ? '#10a37f' : '#FF6B6B'
                }]}>
                  {ocrSource === 'gemini' ? 'Gemini AI' : ocrSource === 'openai' ? 'OpenAI GPT-4o' : 'Tesseract OCR'}
                </Text>
              </View>

              <Text style={styles.resultTitle}>Select Items to Add:</Text>
              
              {/* Select All / Deselect All Buttons */}
              <View style={styles.selectionControls}>
                <TouchableOpacity style={styles.selectButton} onPress={selectAll}>
                  <Ionicons name="checkmark-done" size={18} color="#81A969" />
                  <Text style={styles.selectButtonText}>Select All</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.selectButton} onPress={deselectAll}>
                  <Ionicons name="close" size={18} color="#FF6B6B" />
                  <Text style={styles.selectButtonText}>Deselect All</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.itemsList}>
                {detectedItems.map((item, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.itemCard,
                      selectedItems.has(item) && styles.itemCardSelected
                    ]}
                    onPress={() => toggleItemSelection(item)}
                  >
                    <View style={styles.itemContent}>
                      <View style={styles.checkbox}>
                        {selectedItems.has(item) && (
                          <Ionicons name="checkmark" size={18} color="#fff" />
                        )}
                      </View>
                      <Text style={styles.itemText}>{item}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.scanAgainButton}
                  onPress={() => {
                    setDetectedItems([]);
                    setSelectedItems(new Set());
                    setScannedText('');
                  }}
                >
                  <Ionicons name="scan" size={20} color="#81A969" />
                  <Text style={styles.scanAgainButtonText}>Scan Again</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.addButton, (selectedItems.size === 0 || addingToInventory) && styles.addButtonDisabled]}
                  onPress={handleAddToInventory}
                  disabled={selectedItems.size === 0 || addingToInventory}
                >
                  {addingToInventory ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <>
                      <Ionicons name="add-circle" size={20} color="white" />
                      <Text style={styles.addButtonText}>Add ({selectedItems.size})</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.buttonsContainer}>
              <TouchableOpacity
                style={[styles.actionButton, styles.cameraButton]}
                onPress={handleTakePicture}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Ionicons name="camera" size={32} color="white" />
                    <Text style={styles.actionButtonText}>Take Photo</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.galleryButton]}
                onPress={handlePickFromGallery}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Ionicons name="images" size={32} color="white" />
                    <Text style={styles.actionButtonText}>Choose from Gallery</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {isProcessing && (
            <View style={styles.processingOverlay}>
              <ActivityIndicator size="large" color="#FF9800" />
              <Text style={styles.processingText}>Extracting text...</Text>
            </View>
          )}
        </View>
      </Modal>

      {/* Group Selection Alert Modal */}
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
                  onPress={() => {
                    setGroupSelectionAlert({ ...groupSelectionAlert, visible: false });
                    if (groupSelectionAlert.onSelectGroup) {
                      groupSelectionAlert.onSelectGroup(groupSelectionAlert.singleGroupMode ? undefined : group);
                    }
                  }}
                >
                  <Text style={groupSelectionAlertStyles.groupButtonText}>
                    {groupSelectionAlert.singleGroupMode
                      ? `Add to ${group.groupTitle}`
                      : `${group.groupTitle} (${group.itemCount || 0} items)`}
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

      {/* Duplicate Alert Modal */}
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

      {/* Success Modal */}
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
              Successfully added {addedItemsCount} of {selectedItems.size} items to your pantry.
            </Text>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: '#81A969' }]}
              onPress={() => {
                setSuccessModalVisible(false);
                setDetectedItems([]);
                setSelectedItems(new Set());
                setScannedText('');
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: 'white',
  },
  closeIcon: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: 16,
    margin: 16,
    borderRadius: 12,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1976D2',
    lineHeight: 20,
  },
  buttonsContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cameraButton: {
    backgroundColor: '#FF9800',
  },
  galleryButton: {
    backgroundColor: '#9C27B0',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  resultContainer: {
    flex: 1,
    padding: 16,
  },
  sourceBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 12,
    gap: 6,
  },
  sourceBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  selectionControls: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  selectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    gap: 6,
  },
  selectButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  itemsList: {
    flex: 1,
    marginBottom: 16,
  },
  itemCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  itemCardSelected: {
    borderColor: '#81A969',
    backgroundColor: '#F1F8E9',
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#81A969',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  itemText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  actionButtons: {
    flexDirection: 'row',
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
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  scanAgainButtonText: {
    color: '#81A969',
    fontSize: 16,
    fontWeight: '600',
  },
  addButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#81A969',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  addButtonDisabled: {
    backgroundColor: '#ccc',
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  processingText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  permissionText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  permissionButton: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  closeButtonText: {
    color: '#666',
    fontSize: 16,
  },
  // Modal styles
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

// Group selection styles
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

// Duplicate alert styles
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