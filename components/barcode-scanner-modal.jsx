import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  ScrollView,
  Linking,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import BarcodeScannerService from '../services/barcode-scanner-service'; // ✅ FIX: Import the service correctly

export default function BarcodeScannerModal({ visible, onClose, onBarcodeScanned }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [productData, setProductData] = useState(null);
  const [scannedCode, setScannedCode] = useState(null);
  const cameraRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setScanned(false);
      setProductData(null);
      setScannedCode(null);
    }
  }, [visible]);

  const handleBarCodeScanned = async ({ type, data }) => {
    if (scanned || loading) return;

    setScanned(true);
    setScannedCode(data);
    setLoading(true);

    try {
      console.log('📊 Barcode scanned:', data);
      
      // ✅ FIX: Use the service correctly
      const product = await BarcodeScannerService.searchByBarcode(data);

      if (product && product.food_name) {
        setProductData(product);
        setLoading(false);
      } else {
        Alert.alert(
          'Not Found',
          'This barcode was not found in the database.',
          [
            { text: 'Scan Again', onPress: () => {
              setScanned(false);
              setProductData(null);
              setScannedCode(null);
            }}
          ]
        );
        setLoading(false);
      }
    } catch (error) {
      console.error('❌ Barcode lookup error:', error);
      Alert.alert(
        'Error',
        'Failed to lookup barcode: ' + error.message,
        [{ text: 'Try Again', onPress: () => {
          setScanned(false);
          setProductData(null);
          setScannedCode(null);
        }}]
      );
      setLoading(false);
    }
  };

  // ✅ NEW: Gallery picker for barcode images
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
        'Barcode scanning from gallery images will be available in a future update. Please use the camera for now.',
        [{ text: 'OK' }]
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

  // ✅ Product details view
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
            {/* Product Header */}
            <View style={styles.productHeader}>
              <Ionicons name="nutrition" size={48} color="#4CAF50" />
              <Text style={styles.productName}>{productData.food_name}</Text>
              
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

            {/* Attribution */}
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
              style={styles.addButton}
              onPress={() => {
                onBarcodeScanned?.(productData);
                onClose();
              }}
            >
              <Ionicons name="add-circle" size={20} color="#fff" />
              <Text style={styles.addButtonText}>Use Product</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
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
          <View style={styles.topOverlay} />
          <View style={styles.middleRow}>
            <View style={styles.sideOverlay} />
            <View style={styles.scanArea}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
            <View style={styles.sideOverlay} />
          </View>
          <View style={styles.bottomOverlay}>
            <Text style={styles.instructionText}>
              {scanned ? 'Looking up product...' : 'Align barcode within the frame'}
            </Text>
            
            {/* ✅ Gallery Button */}
            <TouchableOpacity
              style={styles.galleryButton}
              onPress={pickImageFromGallery}
              disabled={loading}
            >
              <Ionicons name="images-outline" size={24} color="#FFF" />
              <Text style={styles.galleryButtonText}>Choose from Gallery</Text>
            </TouchableOpacity>
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
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: '100%',
  },
  middleRow: {
    flexDirection: 'row',
    height: 250,
  },
  sideOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  scanArea: {
    width: 300,
    height: 250,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#4CAF50',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  bottomOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 40,
  },
  instructionText: {
    color: '#FFF',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  galleryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 16,
  },
  galleryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
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
    top: 50,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: '#4CAF50',
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
    backgroundColor: '#4CAF50',
  },
  closeIconButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
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
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});