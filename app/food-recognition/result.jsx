import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { recognizeFood } from '../../services/food-recog-api';

const CONFIDENCE_THRESHOLD = 0.03; // 3% minimum confidence

export default function FoodRecognitionResult() {
  const { imageUri } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [selectedTab, setSelectedTab] = useState('detected'); // 'detected', 'food101', 'filipino', 'ingredients'

  useEffect(() => {
    recognizeFoodImage();
  }, []);

  const recognizeFoodImage = async () => {
    try {
      console.log('🔍 Starting food recognition...');
      setLoading(true);
      setError(null);

      const result = await recognizeFood(imageUri);
      console.log('✅ Recognition complete:', result);
      setResults(result);
    } catch (err) {
      console.error('❌ Recognition error:', err);
      setError(err.message || 'Failed to recognize food');
      Alert.alert('Recognition Failed', err.message || 'Failed to recognize food');
    } finally {
      setLoading(false);
    }
  };

  const filterConfidentResults = (predictions) => {
    return predictions?.filter(p => p.confidence >= CONFIDENCE_THRESHOLD) || [];
  };

  const renderDetectedObjects = () => {
    if (!results?.detections || results.detections.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="scan-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>No objects detected</Text>
        </View>
      );
    }

    return results.detections.map((detection, index) => (
      <View key={index} style={styles.resultCard}>
        <View style={styles.resultHeader}>
          <Ionicons name="camera" size={24} color="#FF6347" />
          <Text style={styles.resultTitle}>{detection.class}</Text>
        </View>
        <View style={styles.confidenceBar}>
          <View
            style={[
              styles.confidenceFill,
              { width: `${detection.confidence * 100}%` },
            ]}
          />
        </View>
        <Text style={styles.confidenceText}>
          {(detection.confidence * 100).toFixed(1)}% confident
        </Text>
      </View>
    ));
  };

  const renderPredictions = (predictions, icon) => {
    const filtered = filterConfidentResults(predictions);

    if (filtered.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="restaurant-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>No predictions above threshold</Text>
        </View>
      );
    }

    return filtered.map((prediction, index) => (
      <View key={index} style={styles.resultCard}>
        <View style={styles.resultHeader}>
          <Ionicons name={icon} size={24} color="#FF6347" />
          <Text style={styles.resultTitle}>{prediction.name}</Text>
        </View>
        <View style={styles.confidenceBar}>
          <View
            style={[
              styles.confidenceFill,
              { width: `${prediction.confidence * 100}%` },
            ]}
          />
        </View>
        <Text style={styles.confidenceText}>
          {(prediction.confidence * 100).toFixed(1)}% confident
        </Text>
      </View>
    ));
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6347" />
          <Text style={styles.loadingText}>Analyzing food image...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#FF6347" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={recognizeFoodImage}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.resultsContainer}>
        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'detected' && styles.activeTab]}
            onPress={() => setSelectedTab('detected')}
          >
            <Ionicons
              name="scan"
              size={20}
              color={selectedTab === 'detected' ? '#FF6347' : '#666'}
            />
            <Text
              style={[
                styles.tabText,
                selectedTab === 'detected' && styles.activeTabText,
              ]}
            >
              Detected ({results?.detections?.length || 0})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, selectedTab === 'food101' && styles.activeTab]}
            onPress={() => setSelectedTab('food101')}
          >
            <Ionicons
              name="fast-food"
              size={20}
              color={selectedTab === 'food101' ? '#FF6347' : '#666'}
            />
            <Text
              style={[
                styles.tabText,
                selectedTab === 'food101' && styles.activeTabText,
              ]}
            >
              Food101
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, selectedTab === 'filipino' && styles.activeTab]}
            onPress={() => setSelectedTab('filipino')}
          >
            <Ionicons
              name="fish"
              size={20}
              color={selectedTab === 'filipino' ? '#FF6347' : '#666'}
            />
            <Text
              style={[
                styles.tabText,
                selectedTab === 'filipino' && styles.activeTabText,
              ]}
            >
              Filipino
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, selectedTab === 'ingredients' && styles.activeTab]}
            onPress={() => setSelectedTab('ingredients')}
          >
            <Ionicons
              name="nutrition"
              size={20}
              color={selectedTab === 'ingredients' ? '#FF6347' : '#666'}
            />
            <Text
              style={[
                styles.tabText,
                selectedTab === 'ingredients' && styles.activeTabText,
              ]}
            >
              Ingredients
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        <ScrollView style={styles.tabContent}>
          {selectedTab === 'detected' && renderDetectedObjects()}
          {selectedTab === 'food101' &&
            renderPredictions(results?.food101_predictions, 'fast-food')}
          {selectedTab === 'filipino' &&
            renderPredictions(results?.filipino_predictions, 'fish')}
          {selectedTab === 'ingredients' &&
            renderPredictions(results?.ingredient_predictions, 'nutrition')}
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Food Recognition</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Image Preview */}
      <View style={styles.imageContainer}>
        <Image source={{ uri: imageUri }} style={styles.image} />
      </View>

      {/* Results */}
      {renderContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  imageContainer: {
    backgroundColor: '#000',
    aspectRatio: 4 / 3,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#FF6347',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#FF6347',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultsContainer: {
    flex: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 4,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#FF6347',
  },
  tabText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#FF6347',
    fontWeight: 'bold',
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
    textTransform: 'capitalize',
  },
  confidenceBar: {
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  confidenceFill: {
    height: '100%',
    backgroundColor: '#FF6347',
  },
  confidenceText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'right',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
});