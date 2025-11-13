import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FRAME_WIDTH = SCREEN_WIDTH * 0.85;
const FRAME_HEIGHT = 200;

export default function OCRScannerModal({ visible, onClose, onTextExtracted }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [extractedLines, setExtractedLines] = useState([]);
  const [selectedLines, setSelectedLines] = useState(new Set());
  const [ocrProgress, setOcrProgress] = useState('');
  const cameraRef = useRef(null);

  useEffect(() => {
    if (visible && !permission?.granted) {
      requestPermission();
    }
    if (visible) {
      setExtractedLines([]);
      setSelectedLines(new Set());
      setScanning(false);
      setOcrProgress('');
    }
  }, [visible]);

  const captureAndExtractText = async () => {
    if (scanning || !cameraRef.current) return;
    
    setScanning(true);
    setOcrProgress('Capturing image...');
    
    try {
      console.log('📷 Capturing image...');
      
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
      });

      console.log('✅ Image captured');
      setOcrProgress('Processing image...');

      console.log('✅ Image processed, starting OCR...');
      setOcrProgress('Extracting text...');
      
      await performOCR(photo.uri);
      
    } catch (error) {
      console.error('❌ OCR error:', error);
      Alert.alert('Error', 'Failed to capture image. Please try again.');
      setScanning(false);
      setOcrProgress('');
    }
  };

  const performOCR = async (photoUri) => {
    try {
      console.log('🔍 Calling backend OCR endpoint...');
      console.log('📸 Photo URI:', photoUri);
      
      // Create form data with the image file
      const formData = new FormData();
      formData.append('file', {
        uri: photoUri,
        type: 'image/jpeg',
        name: 'ocr-scan.jpg',
      });

      // Call backend OCR endpoint
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

      const result = await response.json();
      console.log('📥 Backend OCR Response:', JSON.stringify(result, null, 2));
      
      if (result.success && result.text) {
        const detectedText = result.text;
        
        console.log('✅ OCR Complete!');
        console.log('📝 Extracted text:', detectedText);
        console.log('📏 Text Length:', result.length);

        // Split text into lines
        const lines = detectedText
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0);

        setExtractedLines(lines);
        setScanning(false);
        setOcrProgress('');

        if (lines.length === 0) {
          Alert.alert(
            'No Text Found',
            'No text was detected in the image. Try again with better lighting or clearer text.',
            [{ text: 'OK' }]
          );
        }
      } else {
        throw new Error(result.error || 'No text detected');
      }
    } catch (error) {
      console.error('❌ OCR processing error:', error);
      Alert.alert(
        'Error',
        error.message === 'No text detected' 
          ? 'No text was detected in the image. Please try again.'
          : 'Failed to process text. Please try again.',
        [{ text: 'OK' }]
      );
      setScanning(false);
      setOcrProgress('');
    }
  };

  const toggleLine = (index) => {
    const newSelected = new Set(selectedLines);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedLines(newSelected);
  };

  const selectAll = () => {
    setSelectedLines(new Set(extractedLines.map((_, i) => i)));
  };

  const deselectAll = () => {
    setSelectedLines(new Set());
  };

  const useSelectedText = () => {
    if (selectedLines.size === 0) {
      Alert.alert('No Text Selected', 'Please select at least one line of text.');
      return;
    }

    const selectedText = Array.from(selectedLines)
      .sort((a, b) => a - b)
      .map(i => extractedLines[i])
      .join('\n');

    onTextExtracted(selectedText);
    onClose();
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

        {/* Camera or Results */}
        {extractedLines.length === 0 ? (
          <View style={styles.cameraContainer}>
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFillObject}
              facing="back"
            />

            {/* Overlay */}
            <View style={styles.overlay}>
              <View style={styles.unfocusedTop} />
              <View style={styles.middleRow}>
                <View style={styles.unfocusedSide} />
                <View style={styles.focusedFrame}>
                  <View style={[styles.corner, styles.topLeft]} />
                  <View style={[styles.corner, styles.topRight]} />
                  <View style={[styles.corner, styles.bottomLeft]} />
                  <View style={[styles.corner, styles.bottomRight]} />
                  
                  {/* Scanning line animation */}
                  <View style={styles.scanLine} />
                </View>
                <View style={styles.unfocusedSide} />
              </View>
              <View style={styles.unfocusedBottom} />
            </View>

            {/* Instructions */}
            <View style={styles.instructionsContainer}>
              <Ionicons name="document-text-outline" size={48} color="#fff" />
              <Text style={styles.instructionsText}>
                {scanning 
                  ? ocrProgress
                  : 'Position text within the frame'}
              </Text>
              <Text style={styles.instructionsSubtext}>
                Only text inside the frame will be scanned
              </Text>
              
              {scanning && <ActivityIndicator size="large" color="#fff" style={{ marginTop: 10 }} />}
            </View>

            {/* Capture Button */}
            {!scanning && (
              <View style={styles.captureContainer}>
                <TouchableOpacity
                  style={styles.captureButton}
                  onPress={captureAndExtractText}
                >
                  <Ionicons name="camera" size={32} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.captureHint}>Tap to scan</Text>
              </View>
            )}
          </View>
        ) : (
          /* Results View - KEEP AS IS */
          <View style={styles.resultsContainer}>
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsTitle}>Select Text Lines</Text>
              <Text style={styles.resultsSubtitle}>
                {selectedLines.size} of {extractedLines.length} selected
              </Text>
              <View style={styles.selectButtons}>
                <TouchableOpacity style={styles.selectAllButton} onPress={selectAll}>
                  <Text style={styles.selectButtonText}>Select All</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deselectButton} onPress={deselectAll}>
                  <Text style={styles.selectButtonText}>Deselect All</Text>
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={styles.linesScroll}>
              {extractedLines.map((line, index) => {
                const isSelected = selectedLines.has(index);
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.lineItem,
                      isSelected && styles.lineItemSelected,
                    ]}
                    onPress={() => toggleLine(index)}
                  >
                    <View style={[
                      styles.checkbox,
                      isSelected && styles.checkboxSelected
                    ]}>
                      {isSelected && (
                        <Ionicons name="checkmark" size={18} color="#fff" />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.lineText,
                        isSelected && styles.lineTextSelected,
                      ]}
                    >
                      {line}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.resultsActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.retryButton]}
                onPress={() => {
                  setExtractedLines([]);
                  setSelectedLines(new Set());
                }}
              >
                <Ionicons name="camera" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Rescan</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.useButton,
                  selectedLines.size === 0 && styles.useButtonDisabled,
                ]}
                onPress={useSelectedText}
                disabled={selectedLines.size === 0}
              >
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Use Text</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
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
    backgroundColor: 'rgba(0,0,0,0.9)',
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
  },
  unfocusedTop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  middleRow: {
    flexDirection: 'row',
    height: FRAME_HEIGHT,
  },
  unfocusedSide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  focusedFrame: {
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
    position: 'relative',
    borderWidth: 2,
    borderColor: '#FF9800',
  },
  unfocusedBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#FF9800',
    borderWidth: 4,
  },
  topLeft: {
    top: -2,
    left: -2,
    borderBottomWidth: 0,
    borderRightWidth: 0,
  },
  topRight: {
    top: -2,
    right: -2,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
  },
  bottomLeft: {
    bottom: -2,
    left: -2,
    borderTopWidth: 0,
    borderRightWidth: 0,
  },
  bottomRight: {
    bottom: -2,
    right: -2,
    borderTopWidth: 0,
    borderLeftWidth: 0,
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#FF9800',
    top: '50%',
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
    fontWeight: '600',
  },
  instructionsSubtext: {
    color: '#fff',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
    opacity: 0.8,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  captureHint: {
    color: '#fff',
    fontSize: 14,
    marginTop: 8,
    fontWeight: '500',
  },
  resultsContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  resultsHeader: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  resultsSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  selectButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  selectAllButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#FF9800',
    borderRadius: 6,
    alignItems: 'center',
  },
  deselectButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#666',
    borderRadius: 6,
    alignItems: 'center',
  },
  selectButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  linesScroll: {
    flex: 1,
    padding: 16,
  },
  lineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  lineItemSelected: {
    borderColor: '#FF9800',
    backgroundColor: '#FFF8E1',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#bbb',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxSelected: {
    backgroundColor: '#FF9800',
    borderColor: '#FF9800',
  },
  lineText: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    lineHeight: 20,
  },
  lineTextSelected: {
    fontWeight: '500',
    color: '#000',
  },
  resultsActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  retryButton: {
    backgroundColor: '#666',
  },
  useButton: {
    backgroundColor: '#FF9800',
  },
  useButtonDisabled: {
    backgroundColor: '#ccc',
  },
  actionButtonText: {
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
  // ✅ Add progress bar styles
  progressBarContainer: {
    width: '80%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FF9800',
    borderRadius: 3,
  },
});