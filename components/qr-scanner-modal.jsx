import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Linking,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import BarcodeScannerService from '../services/barcode-scanner-service';
import PantryService from '../services/pantry-service';
import { supabase } from '../lib/supabase'; // ✅ Import supabase directly

export default function QRScannerModal({ visible, onClose, onFoodFound }) {
  // ✅ Remove useAuth
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [productData, setProductData] = useState(null);
  const [scannedCode, setScannedCode] = useState(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (visible && !permission?.granted) {
      requestPermission();
    }
    if (visible) {
      setScanned(false);
      setProductData(null);
      setScannedCode(null);
    }
  }, [visible]);

  const handleQRScanned = async ({ type, data }) => {
    // Only process QR codes
    if (type !== 'qr' && type !== 256) {
      return; // Ignore non-QR codes
    }

    if (scanned) return;
    
    setScanned(true);
    setScannedCode(data);
    setLoading(true);

    try {
      console.log(`QR code scanned: ${data}`);
      const result = await BarcodeScannerService.searchByQRCode(data);

      if (!result) {
        Alert.alert(
          'Not Found',
          'This QR code was not found in FatSecret or OpenFoodFacts databases.',
          [
            { text: 'Close', style: 'cancel', onPress: onClose },
            { text: 'Scan Again', onPress: () => {
              setScanned(false);
              setProductData(null);
              setScannedCode(null);
            }}
          ]
        );
        setLoading(false);
        return;
      }

      setProductData(result);
      setLoading(false);
    } catch (error) {
      console.error('QR code lookup error:', error);
      Alert.alert(
        'Error',
        'Failed to lookup QR code. Please try again.',
        [
          { text: 'Cancel', style: 'cancel', onPress: onClose },
          { text: 'Try Again', onPress: () => {
            setScanned(false);
            setProductData(null);
            setScannedCode(null);
          }}
        ]
      );
      setLoading(false);
    }
  };

  const handleAddToInventory = async () => {
    if (!productData) return;

    setAdding(true);
    try {
      // ✅ Get user directly from supabase
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        Alert.alert('Error', 'You must be logged in to add items');
        setAdding(false);
        return;
      }

      const authUUID = user.id;

      // Determine category and expiry based on product type
      const itemCategory = determineCategory(productData);
      const expiryDate = estimateExpiryDate(itemCategory);

      await PantryService.createItem(authUUID, {
        itemName: productData.food_name,
        itemCategory: itemCategory,
        quantity: 1,
        itemExpiration: expiryDate,
      });

      Alert.alert(
        'Success!',
        `${productData.food_name} has been added to your pantry.`,
        [{ text: 'OK', onPress: onClose }]
      );
    } catch (error) {
      console.error('Failed to add item to inventory:', error);
      Alert.alert('Error', 'Failed to add item to inventory. Please try again.');
    } finally {
      setAdding(false);
    }
  };

  const determineCategory = (product) => {
    const name = product.food_name?.toLowerCase() || '';
    
    if (name.includes('milk') || name.includes('cheese') || name.includes('yogurt')) return 'Dairy';
    if (name.includes('chicken') || name.includes('beef') || name.includes('pork') || name.includes('fish')) return 'Meat';
    if (name.includes('apple') || name.includes('banana') || name.includes('orange') || name.includes('berry')) return 'Fruit';
    if (name.includes('carrot') || name.includes('lettuce') || name.includes('spinach') || name.includes('broccoli')) return 'Vegetable';
    if (name.includes('bread') || name.includes('rice') || name.includes('pasta') || name.includes('cereal')) return 'Grain';
    
    return 'Other';
  };

  const estimateExpiryDate = (category) => {
    const now = new Date();
    const daysToAdd = {
      'Dairy': 7,
      'Meat': 3,
      'Fruit': 5,
      'Vegetable': 7,
      'Grain': 30,
      'Other': 14,
    };
    
    now.setDate(now.getDate() + (daysToAdd[category] || 14));
    return now.toISOString().split('T')[0];
  };

  if (!permission) {
    return null;
  }

  if (!permission.granted) {
    return (
      <Modal visible={visible} animationType="slide" transparent>
        <View style={styles.permissionContainer}>
          <View style={styles.permissionBox}>
            <Ionicons name="camera-off" size={64} color="#ff6b6b" />
            <Text style={styles.permissionTitle}>Camera Permission Required</Text>
            <Text style={styles.permissionText}>
              Please allow camera access to scan QR codes
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  // Render product details view
  if (productData && !loading) {
    const nutritionFacts = BarcodeScannerService.getNutritionFacts(productData);
    const source = BarcodeScannerService.getSourceAttribution(productData);

    return (
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
            {/* Product Name */}
            <View style={styles.productHeader}>
              <Ionicons name="nutrition" size={48} color="#4CAF50" />
              <Text style={styles.productName}>{productData.food_name}</Text>
              
              {/* Source Attribution Badge */}
              <View style={[styles.sourceBadge, { backgroundColor: source.iconColor + '20' }]}>
                <Ionicons name={source.iconName} size={16} color={source.iconColor} />
                <Text style={[styles.sourceBadgeText, { color: source.iconColor }]}>
                  {source.badgeText}
                </Text>
              </View>
            </View>

            {/* QR Code */}
            <View style={styles.barcodeSection}>
              <Ionicons name="qr-code-outline" size={20} color="#666" />
              <Text style={styles.barcodeText}>{scannedCode}</Text>
            </View>

            {/* Nutrition Facts */}
            <View style={styles.nutritionCard}>
              <Text style={styles.sectionTitle}>Nutrition Facts</Text>
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

            {/* Attribution Section */}
            <View style={styles.attributionCard}>
              <Text style={styles.attributionTitle}>Data Source</Text>
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

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.scanAgainButton}
              onPress={() => {
                setScanned(false);
                setProductData(null);
                setScannedCode(null);
              }}
            >
              <Ionicons name="scan" size={20} color="#4CAF50" />
              <Text style={styles.scanAgainButtonText}>Scan Another</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.addButton, adding && styles.addButtonDisabled]}
              onPress={handleAddToInventory}
              disabled={adding}
            >
              {adding ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="add-circle" size={20} color="#fff" />
                  <Text style={styles.addButtonText}>Add to Pantry</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeIconButton}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan QR Code</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Scanner */}
        <View style={styles.scannerContainer}>
          <CameraView
            onBarcodeScanned={scanned ? undefined : handleQRScanned}
            style={StyleSheet.absoluteFillObject}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ['qr'], // Only QR codes
            }}
          />

          {/* Overlay with square frame for QR */}
          <View style={styles.overlay}>
            <View style={styles.unfocusedContainer} />
            <View style={styles.middleContainer}>
              <View style={styles.unfocusedContainer} />
              <View style={styles.focusedContainer}>
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />
              </View>
              <View style={styles.unfocusedContainer} />
            </View>
            <View style={styles.unfocusedContainer} />
          </View>

          {/* Instructions */}
          <View style={styles.instructionsContainer}>
            <Ionicons name="qr-code-outline" size={48} color="#fff" />
            <Text style={styles.instructionsText}>
              {loading ? 'Searching FatSecret and OpenFoodFacts...' :
               scanned ? 'Processing...' :
               'Align QR code within frame'}
            </Text>
            {loading && <ActivityIndicator size="large" color="#fff" style={{ marginTop: 10 }} />}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  closeIconButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  scannerContainer: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  unfocusedContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  middleContainer: {
    flexDirection: 'row',
  },
  focusedContainer: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#2196F3',
    borderWidth: 4,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderBottomWidth: 0,
    borderRightWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderTopWidth: 0,
    borderRightWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderTopWidth: 0,
    borderLeftWidth: 0,
  },
  instructionsContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  instructionsText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 10,
    textAlign: 'center',
    fontWeight: '500',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    width: '80%',
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  permissionText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  closeButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Product Details Styles
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
  productName: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
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
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  attributionText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  attributionLink: {
    fontSize: 12,
    color: '#4CAF50',
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
  },
  scanAgainButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    marginRight: 8,
  },
  scanAgainButtonText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  addButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    marginLeft: 8,
  },
  addButtonDisabled: {
    backgroundColor: '#A5D6A7',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});