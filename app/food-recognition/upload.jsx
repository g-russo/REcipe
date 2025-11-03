import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import BarcodeScannerModal from '../../components/barcode-scanner-modal';
import OCRScannerModal from '../../components/ocr-scanner-modal';

export default function FoodRecognitionUpload() {
  const [scannerVisible, setScannerVisible] = useState(false);
  const [ocrVisible, setOcrVisible] = useState(false);

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

  const handleBarcodeFound = (food) => {
    console.log('Food found:', food);
    
    Alert.alert(
      'Food Found!',
      `${food.food_name}\n\n${food.food_description || 'No description available'}`,
      [
        {
          text: 'Close',
          style: 'cancel',
          onPress: () => {
            setScannerVisible(false);
            router.back();
          },
        },
        {
          text: 'Scan Another',
          onPress: () => {
            setScannerVisible(false);
            setTimeout(() => setScannerVisible(true), 300);
          },
        },
      ]
    );
  };

  const handleTextExtracted = (text) => {
    console.log('Text extracted:', text);
    
    // Search FatSecret with extracted text
    Alert.alert(
      'Text Extracted',
      `Extracted text: "${text}"\n\nWould you like to search for this food?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Search',
          onPress: () => {
            // Navigate to recipe search with the text
            router.push({
              pathname: '/(tabs)/recipe-search',
              params: { query: text },
            });
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Food</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Title */}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>How would you like to add food?</Text>
          <Text style={styles.subtitle}>
            Choose a method to identify your food and get nutrition information
          </Text>
        </View>

        {/* Options Grid */}
        <View style={styles.optionsContainer}>
          {/* Take Photo */}
          <TouchableOpacity
            style={styles.optionCard}
            onPress={() => pickImage(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconCircle, { backgroundColor: '#E3F2FD' }]}>
              <Ionicons name="camera" size={32} color="#2196F3" />
            </View>
            <Text style={styles.optionTitle}>Take Photo</Text>
            <Text style={styles.optionDescription}>
              Capture food and recognize with AI
            </Text>
          </TouchableOpacity>

          {/* Upload from Gallery */}
          <TouchableOpacity
            style={styles.optionCard}
            onPress={() => pickImage(false)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconCircle, { backgroundColor: '#F3E5F5' }]}>
              <Ionicons name="images" size={32} color="#9C27B0" />
            </View>
            <Text style={styles.optionTitle}>Choose from Gallery</Text>
            <Text style={styles.optionDescription}>
              Select photo to analyze with AI
            </Text>
          </TouchableOpacity>

          {/* Scan Barcode/QR */}
          <TouchableOpacity
            style={styles.optionCard}
            onPress={() => setScannerVisible(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconCircle, { backgroundColor: '#E8F5E9' }]}>
              <Ionicons name="barcode" size={32} color="#4CAF50" />
            </View>
            <Text style={styles.optionTitle}>Scan Barcode/QR</Text>
            <Text style={styles.optionDescription}>
              Scan product code for instant info
            </Text>
          </TouchableOpacity>

          {/* OCR Text Scanner */}
          <TouchableOpacity
            style={styles.optionCard}
            onPress={() => setOcrVisible(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconCircle, { backgroundColor: '#FFF3E0' }]}>
              <Ionicons name="document-text" size={32} color="#FF9800" />
            </View>
            <Text style={styles.optionTitle}>Scan Text (OCR)</Text>
            <Text style={styles.optionDescription}>
              Extract text from labels and menus
            </Text>
          </TouchableOpacity>
        </View>

        {/* Info */}
        <View style={styles.infoContainer}>
          <Ionicons name="information-circle-outline" size={20} color="#666" />
          <Text style={styles.infoText}>
            All methods provide detailed nutrition information and ingredient lists
          </Text>
        </View>
      </ScrollView>

      {/* Barcode/QR Scanner Modal */}
      <BarcodeScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onFoodFound={handleBarcodeFound}
      />

      {/* OCR Scanner Modal */}
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
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  content: {
    padding: 20,
  },
  titleContainer: {
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  optionsContainer: {
    gap: 16,
  },
  optionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  optionDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff3cd',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#856404',
    lineHeight: 18,
  },
});