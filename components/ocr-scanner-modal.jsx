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
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';

export default function OCRScannerModal({ visible, onClose, onTextExtracted }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [extractedText, setExtractedText] = useState('');

  useEffect(() => {
    if (visible && !permission?.granted) {
      requestPermission();
    }
    if (visible) {
      setExtractedText('');
      setScanning(false);
    }
  }, [visible]);

  const captureAndExtractText = async (camera) => {
    if (scanning) return;
    
    setScanning(true);
    
    try {
      // Take photo
      const photo = await camera.takePictureAsync({
        quality: 0.8,
        base64: false,
      });

      // For now, we'll use a mock OCR response
      // In production, you'd send this to your backend or use a library
      await performOCR(photo.uri);
      
    } catch (error) {
      console.error('OCR error:', error);
      Alert.alert('Error', 'Failed to extract text. Please try again.');
      setScanning(false);
    }
  };

  const performOCR = async (imageUri) => {
    try {
      // Option 1: Send to your AWS backend
      const formData = new FormData();
      formData.append('file', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'ocr-image.jpg',
      });

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_FOOD_API_URL}/ocr/extract`,
        {
          method: 'POST',
          body: formData,
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      if (!response.ok) {
        throw new Error('OCR extraction failed');
      }

      const result = await response.json();
      const text = result.text || '';

      setExtractedText(text);
      setScanning(false);

      if (text.trim()) {
        Alert.alert(
          'Text Extracted',
          text,
          [
            { text: 'Retry', onPress: () => setExtractedText('') },
            {
              text: 'Use Text',
              onPress: () => {
                onTextExtracted(text);
                onClose();
              },
            },
          ]
        );
      } else {
        Alert.alert(
          'No Text Found',
          'No text was detected in the image. Try again with better lighting.',
          [{ text: 'OK', onPress: () => setScanning(false) }]
        );
      }
    } catch (error) {
      console.error('OCR processing error:', error);
      Alert.alert(
        'Error',
        'Failed to process text. Please try again.',
        [{ text: 'OK', onPress: () => setScanning(false) }]
      );
    }
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
              Please allow camera access to scan text
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Close</Text>
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
          <Text style={styles.headerTitle}>Scan Text (OCR)</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Camera */}
        <View style={styles.cameraContainer}>
          <CameraView
            ref={(ref) => (cameraRef.current = ref)}
            style={StyleSheet.absoluteFillObject}
            facing="back"
          />

          {/* Overlay */}
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
            <Ionicons name="document-text-outline" size={48} color="#fff" />
            <Text style={styles.instructionsText}>
              {scanning ? 'Extracting text...' : 'Align text within frame and tap capture'}
            </Text>
            {scanning && <ActivityIndicator size="large" color="#fff" style={{ marginTop: 10 }} />}
          </View>

          {/* Capture Button */}
          {!scanning && (
            <View style={styles.captureContainer}>
              <TouchableOpacity
                style={styles.captureButton}
                onPress={() => captureAndExtractText(cameraRef.current)}
              >
                <Ionicons name="camera" size={32} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Extracted Text Display */}
        {extractedText && (
          <View style={styles.textDisplay}>
            <ScrollView style={styles.textScroll}>
              <Text style={styles.textContent}>{extractedText}</Text>
            </ScrollView>
            <View style={styles.textActions}>
              <TouchableOpacity
                style={[styles.textButton, styles.retryButton]}
                onPress={() => setExtractedText('')}
              >
                <Text style={styles.textButtonText}>Retry</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.textButton, styles.useButton]}
                onPress={() => {
                  onTextExtracted(extractedText);
                  onClose();
                }}
              >
                <Text style={styles.textButtonText}>Use Text</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const cameraRef = { current: null };

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
  cameraContainer: {
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
    width: 300,
    height: 200,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#FF9800',
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
    bottom: 150,
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
  captureContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FF9800',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  textDisplay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '50%',
    padding: 16,
  },
  textScroll: {
    maxHeight: 200,
  },
  textContent: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  textActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  textButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  retryButton: {
    backgroundColor: '#666',
  },
  useButton: {
    backgroundColor: '#FF9800',
  },
  textButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
    backgroundColor: '#FF9800',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});