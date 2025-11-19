import React, { useEffect, useMemo, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  Image, 
  ActivityIndicator, 
  ScrollView, 
  StyleSheet, 
  TouchableOpacity, 
  Alert, 
  Modal, 
  TextInput,
  Animated,
  StatusBar,
  Platform
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { recognizeFood } from '../../services/food-recog-api';
import { supabase } from '../../lib/supabase';
import PantryService from '../../services/pantry-service';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import AuthGuard from '../../components/auth-guard';

const CONFIDENCE_THRESHOLD = 0.03; // 3% minimum confidence

// Category options for manual entry
const CATEGORIES = [
  'Fruits',
  'Vegetables',
  'Meat & Protein',
  'Dairy',
  'Grains',
  'Beverages',
  'Snacks',
  'Other',
];

export default function ResultScreen() {
  const params = useLocalSearchParams();
  const uri = params.uri;
  const insets = useSafeAreaInsets();
  // router is imported from expo-router

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [selectedFood, setSelectedFood] = useState(null);
  
  // Manual entry modal state
  const [manualEntryVisible, setManualEntryVisible] = useState(false);
  const [manualItemName, setManualItemName] = useState('');
  const [manualCategory, setManualCategory] = useState('Other');
  const [manualQuantity, setManualQuantity] = useState('1');
  const [manualExpiryDays, setManualExpiryDays] = useState('7');
  const [addingToInventory, setAddingToInventory] = useState(false);

  // Detailed Results Modal State
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);

  // Animation Values
  const scrollY = useRef(new Animated.Value(0)).current;

  // Parallax animations
  const imageTranslateY = scrollY.interpolate({
    inputRange: [-hp('35%'), 0, hp('35%')],
    outputRange: [-hp('35%') / 2, 0, -hp('35%') * 0.5],
    extrapolate: 'clamp'
  });

  const imageScale = scrollY.interpolate({
    inputRange: [-hp('35%'), 0],
    outputRange: [2, 1],
    extrapolateRight: 'clamp'
  });

  // Sticky Header Animations
  const headerProgress = scrollY.interpolate({
    inputRange: [hp('25%'), hp('32%')],
    outputRange: [0, 1],
    extrapolate: 'clamp'
  });

  const headerOpacity = headerProgress;
  const headerTranslateY = headerProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-20, 0],
  });

  const titleOpacity = headerProgress.interpolate({
    inputRange: [0.6, 1],
    outputRange: [0, 1],
  });

  const titleTranslateY = headerProgress.interpolate({
    inputRange: [0.6, 1],
    outputRange: [10, 0],
  });

  useEffect(() => {
    if (!result && uri) {
      (async () => {
        setLoading(true);
        try {
          console.log('🔍 Starting food recognition...');
          const res = await recognizeFood(uri);
          console.log('✅ Recognition result:', res);
          setResult(res);
        } catch (e) {
          console.error('❌ Recognition error:', e);
          setResult({ success: false, error: e.message });
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [result, uri]);

  // Get ALL predictions with ≥3% confidence for selection
  const getSelectableOptions = (data) => {
    if (!data || !data.success) return [];

    const allPredictions = [];

    // Add detector detections
    if (data.detections && Array.isArray(data.detections)) {
      data.detections.forEach(d => {
        allPredictions.push({
          label: d.label || d.class_name,
          confidence: d.confidence || 0,
          source: 'Detector (YOLOv8)',
          type: 'detector'
        });
      });
    }

    // Add Food101 predictions
    if (data.food101_topk && Array.isArray(data.food101_topk)) {
      data.food101_topk.forEach(f => {
        allPredictions.push({
          label: f.label,
          confidence: f.conf || 0,
          source: 'Food101 Classifier',
          type: 'food101'
        });
      });
    }

    // Add Filipino predictions
    if (data.filipino_topk && Array.isArray(data.filipino_topk)) {
      data.filipino_topk.forEach(f => {
        allPredictions.push({
          label: f.label,
          confidence: f.conf || 0,
          source: 'Filipino Classifier',
          type: 'filipino'
        });
      });
    }

    // Add global class if exists
    if (data.global_class) {
      allPredictions.push({
        label: data.global_class,
        confidence: data.global_conf || 0,
        source: data.global_class_source === 'food101' ? 'Food101 (Top Pick)' : 
                data.global_class_source === 'filipino' ? 'Filipino (Top Pick)' : 
                'Main Prediction',
        type: 'global'
      });
    }

    // Remove duplicates (keep highest confidence for same food)
    const uniqueMap = new Map();
    allPredictions.forEach(pred => {
      const normalizedLabel = pred.label.toLowerCase().trim();
      const existing = uniqueMap.get(normalizedLabel);
      
      if (!existing || pred.confidence > existing.confidence) {
        uniqueMap.set(normalizedLabel, pred);
      }
    });

    // Filter by threshold and sort by confidence
    return Array.from(uniqueMap.values())
      .filter(p => p.confidence >= CONFIDENCE_THRESHOLD)
      .sort((a, b) => b.confidence - a.confidence);
  };

  // Get top 5 results per model for display
  const getModelResults = (data) => {
    if (!data || !data.success) return { detector: [], food101: [], filipino: [] };

    const results = {
      detector: [],
      food101: [],
      filipino: []
    };

    // Detector results (top 5)
    if (data.detections && Array.isArray(data.detections)) {
      results.detector = data.detections
        .slice(0, 5)
        .map(d => ({
          label: d.label || d.class_name,
          confidence: d.confidence || 0
        }));
    }

    // Food101 results (top 5)
    if (data.food101_topk && Array.isArray(data.food101_topk)) {
      results.food101 = data.food101_topk
        .slice(0, 5)
        .map(f => ({
          label: f.label,
          confidence: f.conf || 0
        }));
    }

    // Filipino results (top 5)
    if (data.filipino_topk && Array.isArray(data.filipino_topk)) {
      results.filipino = data.filipino_topk
        .slice(0, 5)
        .map(f => ({
          label: f.label,
          confidence: f.conf || 0
        }));
    }

    return results;
  };

  const selectableOptions = result ? getSelectableOptions(result) : [];
  const modelResults = result ? getModelResults(result) : { detector: [], food101: [], filipino: [] };

  // Helper function to determine category
  const determineFoodCategory = (foodName) => {
    const name = foodName.toLowerCase();
    if (/apple|banana|orange|grape|strawberry|mango|pineapple|watermelon|kiwi|berry|guava|papaya|melon/i.test(name)) 
      return 'Fruits';
    if (/carrot|tomato|potato|onion|lettuce|cabbage|spinach|broccoli|pepper|cucumber|eggplant|squash|pumpkin/i.test(name)) 
      return 'Vegetables';
    if (/chicken|beef|pork|fish|salmon|tuna|egg|tofu|meat|steak|shrimp|lobster|crab/i.test(name)) 
      return 'Meat & Protein';
    if (/milk|cheese|yogurt|butter|cream|dairy/i.test(name)) 
      return 'Dairy';
    if (/rice|bread|pasta|noodle|wheat|cereal|oat|quinoa|barley/i.test(name)) 
      return 'Grains';
    if (/juice|soda|coffee|tea|water|drink|beverage|smoothie/i.test(name)) 
      return 'Beverages';
    if (/chip|cookie|candy|chocolate|snack|cracker|popcorn/i.test(name)) 
      return 'Snacks';
    return 'Other';
  };

  const estimateExpiryDate = (category) => {
    const now = new Date();
    const expiryDays = {
      'Fruits': 7, 'Vegetables': 7, 'Meat & Protein': 3,
      'Dairy': 7, 'Grains': 30, 'Beverages': 90, 'Snacks': 60, 'Other': 14
    };
    now.setDate(now.getDate() + (expiryDays[category] || 14));
    return now.toISOString();
  };

  const handleAddToInventory = async () => {
    if (!selectedFood) {
      Alert.alert('No Selection', 'Please select a food item first');
      return;
    }

    setAddingToInventory(true);
    
    try {
      // Step 1: Get Auth user (UUID)
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('You must be logged in to add items');
      }

      // Step 2: Convert Auth UUID to numeric userID
      const { data: userData, error: userLookupError } = await supabase
        .from('tbl_users')
        .select('userID')
        .eq('userEmail', user.email)
        .single();

      if (userLookupError || !userData) {
        throw new Error('Failed to find user in database. Please try logging out and back in.');
      }

      const numericUserID = userData.userID;

      // Step 3: Get or create inventory using NUMERIC userID
      const { data: inventories, error: invError } = await supabase
        .from('tbl_inventories')
        .select('*')
        .eq('userID', numericUserID)
        .order('createdAt', { ascending: true })
        .limit(1);

      if (invError) {
        throw new Error(`Failed to fetch inventory: ${invError.message}`);
      }

      let inventoryID = inventories?.[0]?.inventoryID;

      if (!inventoryID) {
        const newInventory = await PantryService.createInventory(numericUserID, {
          inventoryColor: '#8BC34A',
          maxItems: 100,
          inventoryTags: { name: 'My Pantry' },
        });
        inventoryID = newInventory.inventoryID;
      }

      const category = determineFoodCategory(selectedFood.label);
      const expiryDate = estimateExpiryDate(category);

      const itemData = {
        inventoryID: inventoryID,
        itemName: selectedFood.label,
        itemCategory: category,
        quantity: 1,
        unit: 'pcs',
        itemExpiration: expiryDate,
        itemDescription: `Detected by ${selectedFood.source}`,
        imageURL: uri,
        userID: numericUserID,
      };

      await PantryService.createItem(itemData);

      Alert.alert(
        'Added! Success',
        `${selectedFood.label} has been added to your pantry.`,
        [
          { 
            text: 'View Pantry', 
            onPress: () => router.push('/(tabs)/pantry') 
          },
          { 
            text: 'Scan Another', 
            onPress: () => router.replace('/food-recognition/upload') 
          }
        ]
      );

    } catch (error) {
      console.error('❌ Add to inventory error:', error);
      Alert.alert(
        'Error Adding Item',
        error.message || 'Failed to add item to pantry. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setAddingToInventory(false);
    }
  };

  const handleManualEntry = async () => {
    if (!manualItemName.trim()) {
      Alert.alert('Missing Information', 'Please enter an item name');
      return;
    }

    setAddingToInventory(true);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('You must be logged in');
      }

      const { data: userData, error: userLookupError } = await supabase
        .from('tbl_users')
        .select('userID')
        .eq('userEmail', user.email)
        .single();

      if (userLookupError || !userData) {
        throw new Error('Failed to find user in database');
      }

      const numericUserID = userData.userID;

      const { data: inventories, error: invError } = await supabase
        .from('tbl_inventories')
        .select('*')
        .eq('userID', numericUserID)
        .limit(1);

      if (invError) {
        throw new Error(`Failed to fetch inventory: ${invError.message}`);
      }

      let inventoryID = inventories?.[0]?.inventoryID;

      if (!inventoryID) {
        const newInventory = await PantryService.createInventory(numericUserID, {
          inventoryColor: '#8BC34A',
          maxItems: 100,
          inventoryTags: { name: 'My Pantry' },
        });
        inventoryID = newInventory.inventoryID;
      }

      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + parseInt(manualExpiryDays || '7'));

      const itemData = {
        inventoryID: inventoryID,
        itemName: manualItemName.trim(),
        itemCategory: manualCategory,
        quantity: parseInt(manualQuantity) || 1,
        unit: 'pcs',
        itemExpiration: expiryDate.toISOString(),
        itemDescription: 'Added manually from food recognition',
        imageURL: uri,
        userID: numericUserID,
      };

      await PantryService.createItem(itemData);

      setManualItemName('');
      setManualCategory('Other');
      setManualQuantity('1');
      setManualExpiryDays('7');
      setManualEntryVisible(false);

      Alert.alert(
        'Added! Success',
        `${manualItemName} has been added to your pantry.`,
        [
          { text: 'View Pantry', onPress: () => router.push('/(tabs)/pantry') },
          { text: 'Add Another', onPress: () => setManualEntryVisible(true) }
        ]
      );

    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to add item');
    } finally {
      setAddingToInventory(false);
    }
  };

  const handleSearchRecipes = () => {
    if (!selectedFood) return;
    
    router.push({
      pathname: '/(tabs)/recipe-search',
      params: { 
        searchQuery: selectedFood.label,
        autoSearch: 'true'
      }
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#81A969" />
        <Text style={styles.loadingText}>Analyzing food...</Text>
      </View>
    );
  }

  if (!result || !result.success) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#FF6B6B" />
        <Text style={styles.errorTitle}>Recognition Failed</Text>
        <Text style={styles.errorText}>
          {result?.error || 'Could not recognize food in the image'}
        </Text>
        <TouchableOpacity
          style={styles.manualEntryButton}
          onPress={() => setManualEntryVisible(true)}
        >
          <Ionicons name="create-outline" size={20} color="#FFF" />
          <Text style={styles.manualEntryButtonText}>Add Manually</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => router.replace('/food-recognition/upload')}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <AuthGuard>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

        {/* Sticky Header */}
        <Animated.View
          style={[
            styles.stickyHeader,
            { 
              opacity: headerOpacity,
              transform: [{ translateY: headerTranslateY }],
              height: insets.top + hp('2%') + wp('12%') + hp('1.5%'),
              paddingTop: insets.top + hp('2%'),
            }
          ]}
        >
          <View style={styles.stickyHeaderContent}>
            <TouchableOpacity 
              style={styles.stickyBackButton} 
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Animated.Text 
              style={[
                styles.stickyHeaderTitle,
                {
                  opacity: titleOpacity,
                  transform: [{ translateY: titleTranslateY }]
                }
              ]}
              numberOfLines={1}
            >
              Recognition Results
            </Animated.Text>
            <View style={{ width: 24 }} />
          </View>
        </Animated.View>

        {/* Parallax Image Background */}
        <Animated.View
          style={[
            styles.parallaxHeader,
            {
              transform: [
                { translateY: imageTranslateY },
                { scale: imageScale }
              ]
            }
          ]}
        >
          <Image source={{ uri }} style={styles.heroImage} />
          <View style={styles.imageOverlay} />
        </Animated.View>

        {/* Main Content */}
        <Animated.ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollViewContent}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
        >
          <View style={styles.parallaxSpacer} />

          <View style={styles.contentCard}>
            {/* Header Section */}
            <View style={styles.headerSection}>
              <Text style={styles.resultsTitle}>Food Recognition Results</Text>
              <Text style={styles.resultsSubtitle}>
                {selectableOptions.length} items detected with ≥3% confidence
              </Text>
            </View>

            {/* Selectable Options Section */}
            {selectableOptions.length > 0 ? (
              <View style={styles.optionsContainer}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#81A969" />
                  <Text style={styles.sectionHeaderText}>
                    Select Food to Add ({selectableOptions.length} options)
                  </Text>
                </View>

                {selectableOptions.map((item, index) => (
                  <TouchableOpacity
                    key={`${item.label}-${index}`}
                    style={[
                      styles.optionCard,
                      selectedFood?.label === item.label && styles.optionCardSelected,
                    ]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedFood(item);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.optionContent}>
                      <View style={styles.optionTextContainer}>
                        <Text style={styles.optionLabel}>{item.label}</Text>
                        <View style={styles.optionMeta}>
                          <View style={styles.confidenceBadge}>
                            <Ionicons name="analytics-outline" size={14} color="#81A969" />
                            <Text style={styles.optionConfidence}>
                              {(item.confidence * 100).toFixed(1)}%
                            </Text>
                          </View>
                          <View style={styles.sourceBadge}>
                            <Ionicons name="flask-outline" size={12} color="#666" />
                            <Text style={styles.optionSource}>{item.source}</Text>
                          </View>
                        </View>
                      </View>
                      <View style={[
                        styles.radioButton,
                        selectedFood?.label === item.label && styles.radioButtonSelected
                      ]}>
                        {selectedFood?.label === item.label && (
                          <Ionicons name="checkmark" size={16} color="#fff" />
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.noResultsContainer}>
                <Ionicons name="restaurant-outline" size={48} color="#999" />
                <Text style={styles.noResultsText}>
                  No foods detected with sufficient confidence
                </Text>
                <Text style={styles.noResultsSubtext}>
                  Try taking a clearer photo or add the item manually
                </Text>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionButtonsContainer}>
              <TouchableOpacity
                style={styles.manualButton}
                onPress={() => setManualEntryVisible(true)}
              >
                <Ionicons name="create-outline" size={20} color="#FF6B6B" />
                <Text style={styles.manualButtonText}>Manual Entry</Text>
              </TouchableOpacity>

              {selectableOptions.length > 0 && (
                <TouchableOpacity
                  style={[
                    styles.addButton,
                    (!selectedFood || addingToInventory) && styles.addButtonDisabled,
                  ]}
                  onPress={handleAddToInventory}
                  disabled={!selectedFood || addingToInventory}
                >
                  {addingToInventory ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="add-circle-outline" size={20} color="#FFF" />
                      <Text style={styles.addButtonText}>Add to Pantry</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Search Recipes Button */}
            {selectableOptions.length > 0 && (
              <TouchableOpacity
                style={[
                  styles.searchButton,
                  !selectedFood && styles.searchButtonDisabled,
                ]}
                onPress={handleSearchRecipes}
                disabled={!selectedFood}
              >
                <Ionicons name="search-outline" size={20} color="#FFF" />
                <Text style={styles.searchButtonText}>
                  Find Recipes for "{selectedFood?.label || 'Selected Food'}"
                </Text>
                <Ionicons name="arrow-forward-outline" size={20} color="#FFF" />
              </TouchableOpacity>
            )}

            {/* View Detailed Results Button */}
            {result && (
              <TouchableOpacity 
                style={styles.detailsButton}
                onPress={() => setDetailsModalVisible(true)}
              >
                <Ionicons name="stats-chart-outline" size={20} color="#81A969" />
                <Text style={styles.detailsButtonText}>View Detailed Model Results</Text>
              </TouchableOpacity>
            )}

          </View>
        </Animated.ScrollView>

        {/* Fixed Back Button (Initial State) */}
        <Animated.View style={[
          styles.fixedBackButton, 
          { 
            top: insets.top + 10,
            opacity: headerProgress.interpolate({
              inputRange: [0, 0.5],
              outputRange: [1, 0]
            })
          }
        ]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.roundButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
        </Animated.View>

        {/* Manual Entry Modal */}
        <ManualEntryModal
          visible={manualEntryVisible}
          onClose={() => setManualEntryVisible(false)}
          imageUri={uri}
          itemName={manualItemName}
          setItemName={setManualItemName}
          category={manualCategory}
          setCategory={setManualCategory}
          quantity={manualQuantity}
          setQuantity={setManualQuantity}
          expiryDays={manualExpiryDays}
          setExpiryDays={setManualExpiryDays}
          onSubmit={handleManualEntry}
          loading={addingToInventory}
        />

        {/* Detailed Results Modal */}
        <Modal
          visible={detailsModalVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setDetailsModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detailed Model Results</Text>
              <TouchableOpacity onPress={() => setDetailsModalVisible(false)} style={styles.closeModalButton}>
                <Ionicons name="close-circle" size={30} color="#ccc" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
               <Text style={styles.modelDetailsSubtitle}>
                Top 5 predictions from each AI model
              </Text>

              {/* Detector Results */}
              {modelResults.detector.length > 0 && (
                <View style={styles.modelSection}>
                  <View style={styles.modelSectionHeader}>
                    <Ionicons name="scan-outline" size={18} color="#FF6B6B" />
                    <Text style={styles.modelSectionTitle}>
                      Object Detector (YOLOv8)
                    </Text>
                  </View>
                  {modelResults.detector.map((item, i) => (
                    <View key={i} style={styles.resultRow}>
                      <View style={styles.resultRank}>
                        <Text style={styles.resultRankText}>{i + 1}</Text>
                      </View>
                      <Text style={styles.resultLabel}>{item.label}</Text>
                      <View style={styles.resultConfidenceBadge}>
                        <Text style={styles.resultConfidence}>
                          {(item.confidence * 100).toFixed(1)}%
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Food101 Results */}
              {modelResults.food101.length > 0 && (
                <View style={styles.modelSection}>
                  <View style={styles.modelSectionHeader}>
                    <Ionicons name="pizza-outline" size={18} color="#FF9800" />
                    <Text style={styles.modelSectionTitle}>
                      Food101 Classifier
                    </Text>
                  </View>
                  {modelResults.food101.map((item, i) => (
                    <View key={i} style={styles.resultRow}>
                      <View style={styles.resultRank}>
                        <Text style={styles.resultRankText}>{i + 1}</Text>
                      </View>
                      <Text style={styles.resultLabel}>{item.label}</Text>
                      <View style={styles.resultConfidenceBadge}>
                        <Text style={styles.resultConfidence}>
                          {(item.confidence * 100).toFixed(1)}%
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Filipino Results */}
              {modelResults.filipino.length > 0 && (
                <View style={styles.modelSection}>
                  <View style={styles.modelSectionHeader}>
                    <Ionicons name="restaurant-outline" size={18} color="#4CAF50" />
                    <Text style={styles.modelSectionTitle}>
                      Filipino Food Classifier
                    </Text>
                  </View>
                  {modelResults.filipino.map((item, i) => (
                    <View key={i} style={styles.resultRow}>
                      <View style={styles.resultRank}>
                        <Text style={styles.resultRankText}>{i + 1}</Text>
                      </View>
                      <Text style={styles.resultLabel}>{item.label}</Text>
                      <View style={styles.resultConfidenceBadge}>
                        <Text style={styles.resultConfidence}>
                          {(item.confidence * 100).toFixed(1)}%
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Technical Info */}
              <View style={styles.techInfo}>
                <Text style={styles.techInfoText}>
                  Processing time: {result.elapsed_ms?.toFixed(0)}ms
                </Text>
                <Text style={styles.techInfoText}>
                  Device: {result.device || 'CPU'}
                </Text>
                <Text style={styles.techInfoText}>
                  Confidence threshold: {(CONFIDENCE_THRESHOLD * 100).toFixed(0)}%
                </Text>
              </View>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </Modal>
      </View>
    </AuthGuard>
  );
}

// Manual Entry Modal Component
function ManualEntryModal({
  visible,
  onClose,
  imageUri,
  itemName,
  setItemName,
  category,
  setCategory,
  quantity,
  setQuantity,
  expiryDays,
  setExpiryDays,
  onSubmit,
  loading,
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={modalStyles.overlay} 
        activeOpacity={1} 
        onPress={onClose}
      >
        <TouchableOpacity 
          style={modalStyles.container} 
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={modalStyles.header}>
            <Text style={modalStyles.headerTitle}>Add Item Manually</Text>
            <TouchableOpacity onPress={onClose} style={modalStyles.closeButton}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={modalStyles.content}>
            {imageUri && (
              <View style={modalStyles.imagePreview}>
                <Image source={{ uri: imageUri }} style={modalStyles.previewImage} />
                <Text style={modalStyles.imageNote}>Reference image</Text>
              </View>
            )}

            <View style={modalStyles.field}>
              <Text style={modalStyles.label}>Item Name *</Text>
              <TextInput
                style={modalStyles.input}
                value={itemName}
                onChangeText={setItemName}
                placeholder="e.g., Fresh Apples"
                placeholderTextColor="#999"
              />
            </View>

            <View style={modalStyles.field}>
              <Text style={modalStyles.label}>Category *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={modalStyles.categoryContainer}>
                  {CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        modalStyles.categoryChip,
                        category === cat && modalStyles.categoryChipSelected,
                      ]}
                      onPress={() => setCategory(cat)}
                    >
                      <Text
                        style={[
                          modalStyles.categoryChipText,
                          category === cat && modalStyles.categoryChipTextSelected,
                        ]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={modalStyles.row}>
              <View style={[modalStyles.field, { flex: 1, marginRight: 10 }]}>
                <Text style={modalStyles.label}>Quantity</Text>
                <TextInput
                  style={modalStyles.input}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="numeric"
                  placeholder="1"
                />
              </View>
              <View style={[modalStyles.field, { flex: 1 }]}>
                <Text style={modalStyles.label}>Expires in (days)</Text>
                <TextInput
                  style={modalStyles.input}
                  value={expiryDays}
                  onChangeText={setExpiryDays}
                  keyboardType="numeric"
                  placeholder="7"
                />
              </View>
            </View>

            <TouchableOpacity
              style={[modalStyles.submitButton, loading && modalStyles.submitButtonDisabled]}
              onPress={onSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={modalStyles.submitButtonText}>Add to Pantry</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: hp('2%'),
    fontSize: wp('4.5%'),
    color: '#666',
    fontFamily: 'System',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: wp('5%'),
  },
  errorTitle: {
    fontSize: wp('6%'),
    fontWeight: 'bold',
    color: '#333',
    marginTop: hp('2%'),
    marginBottom: hp('1%'),
  },
  errorText: {
    fontSize: wp('4%'),
    color: '#666',
    textAlign: 'center',
    marginBottom: hp('4%'),
  },
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#81A969',
    zIndex: 900,
    justifyContent: 'flex-start',
    borderBottomLeftRadius: wp('6%'),
    borderBottomRightRadius: wp('6%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
  },
  stickyHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('5%'),
    width: '100%',
    justifyContent: 'space-between',
    height: wp('12%'),
  },
  stickyHeaderTitle: {
    color: '#fff',
    fontSize: wp('4.5%'),
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
  },
  stickyBackButton: {
    padding: 8,
  },
  parallaxHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: hp('35%'),
    zIndex: 0,
  },
  heroImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollViewContent: {
    paddingBottom: hp('10%'),
  },
  parallaxSpacer: {
    height: hp('35%'),
    backgroundColor: 'transparent',
  },
  contentCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: wp('7%'),
    borderTopRightRadius: wp('7%'),
    marginTop: wp('-6%'),
    paddingHorizontal: wp('5%'),
    paddingTop: hp('3%'),
    flex: 1,
    minHeight: hp('70%'),
  },
  fixedBackButton: {
    position: 'absolute',
    left: wp('5%'),
    zIndex: 1000,
  },
  roundButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  headerSection: {
    marginBottom: hp('3%'),
    alignItems: 'center',
  },
  resultsTitle: {
    fontSize: wp('6%'),
    fontWeight: 'bold',
    color: '#333',
    marginBottom: hp('0.5%'),
    textAlign: 'center',
  },
  resultsSubtitle: {
    fontSize: wp('3.8%'),
    color: '#666',
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('2%'),
  },
  sectionHeaderText: {
    fontSize: wp('4.5%'),
    fontWeight: '600',
    color: '#333',
    marginLeft: wp('2%'),
  },
  optionsContainer: {
    marginBottom: hp('3%'),
  },
  optionCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: wp('4%'),
    padding: wp('4%'),
    marginBottom: hp('1.5%'),
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  optionCardSelected: {
    backgroundColor: '#F0FDF4',
    borderColor: '#81A969',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionTextContainer: {
    flex: 1,
  },
  optionLabel: {
    fontSize: wp('4.5%'),
    fontWeight: 'bold',
    color: '#333',
    marginBottom: hp('0.5%'),
  },
  optionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: wp('2%'),
    paddingVertical: hp('0.3%'),
    borderRadius: wp('1%'),
    marginRight: wp('2%'),
  },
  optionConfidence: {
    fontSize: wp('3.2%'),
    color: '#81A969',
    fontWeight: '600',
    marginLeft: wp('1%'),
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionSource: {
    fontSize: wp('3.2%'),
    color: '#666',
    marginLeft: wp('1%'),
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: wp('3%'),
  },
  radioButtonSelected: {
    backgroundColor: '#81A969',
    borderColor: '#81A969',
  },
  noResultsContainer: {
    alignItems: 'center',
    padding: wp('8%'),
    backgroundColor: '#F9FAFB',
    borderRadius: wp('4%'),
    marginBottom: hp('3%'),
  },
  noResultsText: {
    fontSize: wp('4.5%'),
    fontWeight: '600',
    color: '#666',
    marginTop: hp('2%'),
    textAlign: 'center',
  },
  noResultsSubtext: {
    fontSize: wp('3.5%'),
    color: '#999',
    textAlign: 'center',
    marginTop: hp('1%'),
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: hp('2%'),
  },
  manualButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#FF6B6B',
    paddingVertical: hp('1.8%'),
    borderRadius: wp('3%'),
    marginRight: wp('2%'),
  },
  manualButtonText: {
    color: '#FF6B6B',
    fontWeight: 'bold',
    fontSize: wp('4%'),
    marginLeft: wp('2%'),
  },
  addButton: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#81A969',
    paddingVertical: hp('1.8%'),
    borderRadius: wp('3%'),
    marginLeft: wp('2%'),
    shadowColor: '#81A969',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  addButtonDisabled: {
    backgroundColor: '#D1D5DB',
    shadowOpacity: 0,
  },
  addButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: wp('4%'),
    marginLeft: wp('2%'),
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF9800',
    paddingVertical: hp('1.8%'),
    borderRadius: wp('3%'),
    marginBottom: hp('3%'),
    shadowColor: '#FF9800',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  searchButtonDisabled: {
    backgroundColor: '#D1D5DB',
    shadowOpacity: 0,
  },
  searchButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: wp('4%'),
    marginHorizontal: wp('2%'),
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('1.5%'),
    marginTop: hp('1%'),
  },
  detailsButtonText: {
    color: '#81A969',
    fontSize: wp('3.8%'),
    fontWeight: '600',
    marginLeft: wp('2%'),
    textDecorationLine: 'underline',
  },
  retryButton: {
    marginTop: hp('2%'),
    paddingVertical: hp('1.5%'),
    paddingHorizontal: wp('8%'),
    backgroundColor: '#81A969',
    borderRadius: wp('2%'),
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: wp('4%'),
  },
  manualEntryButton: {
    marginTop: hp('2%'),
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B6B',
    paddingVertical: hp('1.5%'),
    paddingHorizontal: wp('6%'),
    borderRadius: wp('2%'),
  },
  manualEntryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: wp('2%'),
  },
  
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('2%'),
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: wp('5%'),
    fontWeight: 'bold',
    color: '#333',
  },
  closeModalButton: {
    padding: 5,
  },
  modalContent: {
    padding: wp('5%'),
  },
  modelDetailsSubtitle: {
    fontSize: wp('4%'),
    color: '#666',
    marginBottom: hp('3%'),
  },
  modelSection: {
    marginBottom: hp('4%'),
  },
  modelSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('2%'),
    paddingBottom: hp('1%'),
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modelSectionTitle: {
    fontSize: wp('4.5%'),
    fontWeight: 'bold',
    color: '#333',
    marginLeft: wp('2%'),
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('1.5%'),
  },
  resultRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp('3%'),
  },
  resultRankText: {
    fontSize: wp('3.5%'),
    fontWeight: 'bold',
    color: '#666',
  },
  resultLabel: {
    flex: 1,
    fontSize: wp('4%'),
    color: '#333',
  },
  resultConfidenceBadge: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: wp('2%'),
    paddingVertical: hp('0.5%'),
    borderRadius: wp('1%'),
  },
  resultConfidence: {
    fontSize: wp('3.5%'),
    fontWeight: '600',
    color: '#81A969',
  },
  techInfo: {
    backgroundColor: '#F9FAFB',
    padding: wp('4%'),
    borderRadius: wp('3%'),
    marginTop: hp('2%'),
  },
  techInfoText: {
    fontSize: wp('3.5%'),
    color: '#666',
    marginBottom: hp('0.5%'),
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '80%',
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  content: {
    padding: 20,
  },
  imagePreview: {
    alignItems: 'center',
    marginBottom: 20,
  },
  previewImage: {
    width: 100,
    height: 100,
    borderRadius: 10,
    marginBottom: 5,
  },
  imageNote: {
    fontSize: 12,
    color: '#999',
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  categoryContainer: {
    flexDirection: 'row',
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categoryChipSelected: {
    backgroundColor: '#E8F5E9',
    borderColor: '#81A969',
  },
  categoryChipText: {
    color: '#666',
    fontWeight: '500',
  },
  categoryChipTextSelected: {
    color: '#81A969',
    fontWeight: 'bold',
  },
  submitButton: {
    backgroundColor: '#81A969',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 40,
  },
  submitButtonDisabled: {
    backgroundColor: '#A5D6A7',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});