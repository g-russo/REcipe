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
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import BarcodeScannerService from '../services/barcode-scanner-service';
import AlertModal from './AlertModal';

export default function BarcodeScannerModal({ visible, onClose, onBarcodeScanned }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [productData, setProductData] = useState(null);
  const [scannedCode, setScannedCode] = useState(null);
  const cameraRef = useRef(null);

  // Alert modal state
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'info',
    buttons: [],
  });

  useEffect(() => {
    if (visible) {
      setScanned(false);
      setProductData(null);
      setScannedCode(null);
    }
  }, [visible]);

  const showAlert = (title, message, type = 'info', buttons = []) => {
    setAlertConfig({
      visible: true,
      title,
      message,
      type,
      buttons: buttons.length > 0 ? buttons : [{ text: 'OK' }],
    });
  };

  const hideAlert = () => {
    setAlertConfig(prev => ({ ...prev, visible: false }));
  };

  const handleBarCodeScanned = async ({ type, data }) => {
    if (scanned || loading) return;

    setScanned(true);
    setScannedCode(data);
    setLoading(true);

    try {
      console.log('📊 Barcode scanned:', data);

      const product = await BarcodeScannerService.searchByBarcode(data);

      if (product && product.food_name) {
        setProductData(product);
        setLoading(false);
      } else {
        showAlert(
          'Not Found',
          'This barcode was not found in the database.',
          'warning',
          [
            {
              text: 'Scan Again', onPress: () => {
                setScanned(false);
                setProductData(null);
                setScannedCode(null);
              }
            }
          ]
        );
        setLoading(false);
      }
    } catch (error) {
      console.error('❌ Barcode lookup error:', error);
      showAlert(
        'Error',
        'Failed to lookup barcode: ' + error.message,
        'error',
        [{
          text: 'Try Again', onPress: () => {
            setScanned(false);
            setProductData(null);
            setScannedCode(null);
          }
        }]
      );
      setLoading(false);
    }
  };

  const pickImageFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permission Required', 'Please allow access to your photos.', 'warning');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
        allowsMultipleSelection: false,
      });

      if (result.canceled) return;

      showAlert(
        'Feature Coming Soon',
        'Barcode scanning from gallery images will be available in a future update. Please use the camera for now.',
        'info'
      );
    } catch (error) {
      console.error('❌ Gallery picker error:', error);
      showAlert('Error', 'Failed to pick image: ' + error.message, 'error');
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

            {/* Action Buttons */}
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
                <Ionicons name="scan" size={20} color="#81A969" />
                <Text style={styles.scanAgainButtonText}>Scan Another</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.addButton}
                onPress={() => {
                  onBarcodeScanned?.(productData);
                  onClose();
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.addButtonText}>Use Product</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Alert Modal */}
        <AlertModal
          visible={alertConfig.visible}
          onClose={hideAlert}
          title={alertConfig.title}
          message={alertConfig.message}
          type={alertConfig.type}
          buttons={alertConfig.buttons}
        />
      </>
    );
  }

  return (
    <>
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

      {/* Alert Modal */}
      <AlertModal
        visible={alertConfig.visible}
        onClose={hideAlert}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttons={alertConfig.buttons}
      />
    </>
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
    marginRight: 8,
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
    paddingVertical: 12,
    borderRadius: 10,
    marginLeft: 8,
    gap: 8,
    shadowColor: '#81A969',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});