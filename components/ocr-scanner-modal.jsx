import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { extractText } from '../services/food-recog-api'; // ✅ Use the service

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

  // ✅ Gallery picker for OCR
  const pickImageFromGallery = async () => {
    if (scanning) return;

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsMultipleSelection: false,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const uri = result.assets[0].uri;

      setScanning(true);
      setOcrProgress('Processing image...');

      console.log('📸 Processing gallery image for OCR...');

      const ocrResult = await extractText(uri);

      if (ocrResult?.success && ocrResult?.text) {
        const lines = ocrResult.text
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0);

        if (lines.length === 0) {
          Alert.alert(
            'No Text Found',
            'No text was detected in the image. Try again with better lighting or clearer text.',
            [{ text: 'OK' }]
          );
        } else {
          setExtractedLines(lines);
          setSelectedLines(new Set());
        }
      } else {
        throw new Error('No text detected');
      }
    } catch (error) {
      console.error('❌ OCR gallery error:', error);
      Alert.alert(
        'Error',
        error.message === 'No text detected'
          ? 'No text was detected in the image. Please try again.'
          : 'Failed to process text. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setScanning(false);
      setOcrProgress('');
    }
  };

  const captureAndExtractText = async () => {
    if (scanning || !cameraRef.current) return;

    setScanning(true);
    setOcrProgress('Capturing image...');

    try {
      console.log('📷 Capturing image...');

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
      });

      console.log('✅ Image captured, starting OCR...');
      setOcrProgress('Extracting text...');

      const ocrResult = await extractText(photo.uri);

      if (ocrResult?.success && ocrResult?.text) {
        const lines = ocrResult.text
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
        throw new Error('No text detected');
      }
    } catch (error) {
      console.error('❌ OCR error:', error);
      Alert.alert(
        'Error',
        'Failed to capture image. Please try again.',
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
            <TouchableOpacity style={styles.permissionButton} onPress={onClose}>
              <Text style={styles.permissionButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
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
              <View style={styles.unfocusedTop}>
                <View style={styles.topHeader}>
                  <View style={styles.headerContent}>
                    <Ionicons name="document-text-outline" size={32} color="#FFF" />
                    <Text style={styles.headerTitleOverlay}>Scan Text</Text>
                  </View>
                </View>
              </View>
              <View style={styles.middleRow}>
                <View style={styles.unfocusedSide} />
                <View style={styles.focusedFrame}>
                  <View style={[styles.corner, styles.topLeft]} />
                  <View style={[styles.corner, styles.topRight]} />
                  <View style={[styles.corner, styles.bottomLeft]} />
                  <View style={[styles.corner, styles.bottomRight]} />

                  {/* Scanning line animation */}
                  {scanning && <View style={styles.scanLine} />}
                  {scanning && (
                    <View style={styles.scanningIndicator}>
                      <ActivityIndicator size="large" color="#FF9800" />
                    </View>
                  )}
                </View>
                <View style={styles.unfocusedSide} />
              </View>
              <View style={styles.unfocusedBottom}>
                <View style={styles.instructionContainer}>
                  <Text style={styles.instructionText}>
                    {scanning
                      ? ocrProgress
                      : 'Position text within the frame'}
                  </Text>
                  {!scanning && (
                    <Text style={styles.instructionSubtext}>
                      Works best with clear, well-lit text
                    </Text>
                  )}
                </View>
              </View>
            </View>

            {/* Buttons Container */}
            {!scanning && (
              <View style={styles.buttonsContainer}>
                {/* Gallery Button */}
                <TouchableOpacity
                  style={styles.galleryButton}
                  onPress={pickImageFromGallery}
                >
                  <Ionicons name="images" size={24} color="#fff" />
                  <Text style={styles.galleryButtonText}>Gallery</Text>
                </TouchableOpacity>

                {/* Capture Button */}
                <TouchableOpacity
                  style={styles.captureButton}
                  onPress={captureAndExtractText}
                >
                  <View style={styles.captureButtonInner}>
                    <Ionicons name="scan" size={32} color="#fff" />
                  </View>
                </TouchableOpacity>

                {/* Placeholder for symmetry */}
                <View style={styles.galleryButton} />
              </View>
            )}

            {/* Close Button */}
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={32} color="#FFF" />
            </TouchableOpacity>
          </View>
        ) : (
          /* Results View */
          <View style={styles.resultsContainer}>
            {/* Header for Results View */}
            <View style={styles.header}>
              <TouchableOpacity onPress={onClose} style={styles.closeIconButton}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Scan Text (OCR)</Text>
              <View style={{ width: 28 }} />
            </View>
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
  cameraContainer: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  unfocusedTop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
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
  headerTitleOverlay: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '700',
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  unfocusedBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 40,
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#FF9800',
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
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#FF9800',
    top: '50%',
    shadowColor: '#FF9800',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
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
  buttonsContainer: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#FF9800',
  },
  captureButtonInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FF9800',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF9800',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  galleryButton: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 152, 0, 0.3)',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 152, 0, 0.5)',
  },
  galleryButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
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
  resultsContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  permissionButton: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});