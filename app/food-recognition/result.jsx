import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Animated,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { recognizeFoodCombined } from '../../services/food-recog-api'; // ✅ UPDATED: Use combined endpoint
import { supabase } from '../../lib/supabase';
import PantryService from '../../services/pantry-service';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import AuthGuard from '../../components/auth-guard';
import ItemFormModal from '../../components/pantry/item-form-modal';

const CONFIDENCE_THRESHOLD = 0.03; // 3% minimum confidence
const DISPLAY_THRESHOLD = 0.60; // 60% minimum confidence for "Other Options" list

// Category options for manual entry
const CATEGORIES = [
  'Rice', 'Soup', 'Leftovers', 'Kakanin',
  'Baking', 'Beverages', 'Canned', 'Jarred', 'Condiments', 'Sauces', 'Dairy', 'Eggs',
  'Fruits', 'Frozen', 'Grains', 'Pasta', 'Noodles', 'Meat', 'Poultry', 'Seafood',
  'Snacks', 'Spices', 'Herbs', 'Vegetables', 'Other'
];

export default function FoodRecognitionResult() {
  // ✅ FIX: Get params correctly
  const params = useLocalSearchParams();
  const uri = params.uri;

  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [selectedFood, setSelectedFood] = useState(null);
  const [showOtherOptions, setShowOtherOptions] = useState(false);
  const [optionsModalVisible, setOptionsModalVisible] = useState(false); // ✅ NEW: Options Modal State

  // Manual entry modal state
  const [manualEntryVisible, setManualEntryVisible] = useState(false);
  const [manualItemName, setManualItemName] = useState('');
  const [manualCategory, setManualCategory] = useState('Other');
  const [manualQuantity, setManualQuantity] = useState('1');
  const [manualExpiryDays, setManualExpiryDays] = useState('7');
  const [addingToInventory, setAddingToInventory] = useState(false);

  // Item Form Modal State
  const [itemFormVisible, setItemFormVisible] = useState(false);
  const [inventories, setInventories] = useState([]);
  const [prefilledItemData, setPrefilledItemData] = useState(null);

  // Detailed Results Modal State
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);

  // Success Modal State
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [addedItemName, setAddedItemName] = useState('');

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
    // ✅ UPDATED: Use combined endpoint
    if (!result && uri) {
      (async () => {
        setLoading(true);
        try {
          const res = await recognizeFoodCombined(uri);
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

  // Get ALL predictions with ≥60% confidence for selection
  const getSelectableOptions = (data) => {
    if (!data || !data.success) return [];

    let geminiPredictions = [];
    if (data.gemini_prediction) {
      if (Array.isArray(data.gemini_prediction)) {
        geminiPredictions = data.gemini_prediction;
      } else {
        geminiPredictions = [data.gemini_prediction];
      }
    }

    // ✅ Check for Gemini "Unknown" or "Not a Food"
    if (geminiPredictions.length > 0) {
      const first = geminiPredictions[0];
      const name = first.name.toLowerCase();
      if (name.includes('unknown') || name.includes('not a food')) {
        return [{
          label: 'Unknown Food',
          confidence: 0,
          source: 'SousChef AI',
          type: 'unknown',
          isUnknown: true
        }];
      }
    }

    const uniqueMap = new Map();

    // 1. Add Gemini Primary (Always add if available)
    if (geminiPredictions.length > 0) {
      const first = geminiPredictions[0];
      uniqueMap.set(first.name.toLowerCase().trim(), {
        label: first.name,
        confidence: first.confidence || 0.95, // High trust
        source: 'SousChef AI',
        type: 'gemini'
      });
    }

    // Helper to add predictions if they meet threshold
    const addIfValid = (items, source, type) => {
      if (!items || !Array.isArray(items)) return;
      items.forEach(item => {
        const conf = item.confidence || 0;
        // STRICT FILTER: Only >= DISPLAY_THRESHOLD (0.60)
        if (conf >= DISPLAY_THRESHOLD) {
          const label = (item.class || item.name).trim(); // Handle 'class' vs 'name'
          const normalizedLabel = label.toLowerCase();

          // Only add if not exists or higher confidence
          const existing = uniqueMap.get(normalizedLabel);
          if (!existing || conf > existing.confidence) {
            uniqueMap.set(normalizedLabel, {
              label: label,
              confidence: conf,
              source: source,
              type: type
            });
          }
        }
      });
    };

    // 2. Add Local Models (Filtered by 60% threshold)
    addIfValid(data.detections, 'Detector (YOLOv8)', 'detector');
    addIfValid(data.food101_predictions, 'Food101 Classifier', 'food101');
    addIfValid(data.filipino_predictions, 'Filipino Classifier', 'filipino');
    addIfValid(data.ingredient_predictions, 'Ingredient Detector', 'ingredient');

    // 3. Fill with Gemini Alternatives if < 5
    if (uniqueMap.size < 5 && geminiPredictions.length > 1) {
      for (let i = 1; i < geminiPredictions.length; i++) {
        if (uniqueMap.size >= 5) break;
        const pred = geminiPredictions[i];

        // Ensure confidence is a number
        const conf = typeof pred.confidence === 'number' ? pred.confidence : 0;

        // ✅ STRICT CHECK: Skip if below threshold
        if (conf < DISPLAY_THRESHOLD) continue;

        const normalizedLabel = pred.name.toLowerCase().trim();

        if (!uniqueMap.has(normalizedLabel)) {
          uniqueMap.set(normalizedLabel, {
            label: pred.name,
            confidence: conf,
            source: 'SousChef AI (Alternative)',
            type: 'gemini_alt'
          });
        }
      }
    }

    // Sort by confidence (Gemini first)
    return Array.from(uniqueMap.values())
      .sort((a, b) => {
        if (a.type === 'gemini') return -1;
        if (b.type === 'gemini') return 1;
        return b.confidence - a.confidence;
      });
  };  // Get top 5 results per model for display
  const getModelResults = (data) => {
    if (!data || !data.success) return { detector: [], food101: [], filipino: [], ingredients: [], gemini: [] };

    const results = {
      detector: [],
      food101: [],
      filipino: [],
      ingredients: [], // ✅ Add ingredients
      gemini: [] // ✅ Add Gemini
    };

    // ✅ Map Gemini result
    if (data.gemini_prediction) {
      if (Array.isArray(data.gemini_prediction)) {
        results.gemini = data.gemini_prediction.map(p => ({
          label: p.name,
          confidence: p.confidence || 0.99
        }));
      } else {
        results.gemini.push({
          label: data.gemini_prediction.name,
          confidence: data.gemini_prediction.confidence || 0.99
        });
      }
    }

    // Detector results (top 5)
    if (data.detections && Array.isArray(data.detections)) {
      results.detector = data.detections
        .slice(0, 5)
        .map(d => ({
          label: d.class,
          confidence: d.confidence || 0
        }));
    }

    // Food101 results (top 5)
    if (data.food101_predictions && Array.isArray(data.food101_predictions)) {
      results.food101 = data.food101_predictions
        .slice(0, 5)
        .map(f => ({
          label: f.name,
          confidence: f.confidence || 0
        }));
    }

    // Filipino results (top 5)
    if (data.filipino_predictions && Array.isArray(data.filipino_predictions)) {
      results.filipino = data.filipino_predictions
        .slice(0, 5)
        .map(f => ({
          label: f.name,
          confidence: f.confidence || 0
        }));
    }

    // ✅ Ingredient results (top 5)
    if (data.ingredient_predictions && Array.isArray(data.ingredient_predictions)) {
      results.ingredients = data.ingredient_predictions
        .slice(0, 5)
        .map(i => ({
          label: i.name,
          confidence: i.confidence || 0
        }));
    }

    return results;
  };

  const selectableOptions = result ? getSelectableOptions(result) : [];
  const modelResults = result ? getModelResults(result) : { detector: [], food101: [], filipino: [], ingredients: [], gemini: [] };

  // ✅ FIX: Automatically select the best option when results load
  useEffect(() => {
    if (selectableOptions.length > 0 && !selectedFood) {
      setSelectedFood(selectableOptions[0]);
    }
  }, [result]);

  // Helper function to determine category
  const determineFoodCategory = (foodName) => {
    const name = foodName.toLowerCase();
    if (/apple|banana|orange|grape|strawberry|mango|pineapple|watermelon|kiwi|berry|guava|papaya|melon/i.test(name))
      return 'Fruits';
    if (/carrot|tomato|potato|onion|lettuce|cabbage|spinach|broccoli|pepper|cucumber|eggplant|squash|pumpkin/i.test(name))
      return 'Vegetables';
    if (/chicken|beef|pork|fish|salmon|tuna|egg|tofu|meat|steak|shrimp|lobster|crab/i.test(name))
      return 'Meat';
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
      'Fruits': 7, 'Vegetables': 7, 'Meat': 3, 'Poultry': 3, 'Seafood': 2,
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

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        Alert.alert('Error', 'You must be logged in to add items');
        return;
      }

      const { data: userData, error: userLookupError } = await supabase
        .from('tbl_users')
        .select('userID')
        .eq('userEmail', user.email)
        .single();

      if (userLookupError || !userData) {
        Alert.alert('Error', 'Failed to find user in database. Please try logging out and back in.');
        return;
      }

      const numericUserID = userData.userID;

      // Fetch user's inventories
      const { data: userInventories, error: invError } = await supabase
        .from('tbl_inventories')
        .select('*')
        .eq('userID', numericUserID)
        .order('createdAt', { ascending: true });

      if (invError) {
        Alert.alert('Error', `Failed to fetch inventories: ${invError.message}`);
        return;
      }

      let inventoryList = userInventories || [];

      // Create default inventory if none exists
      if (inventoryList.length === 0) {
        const newInventory = await PantryService.createInventory(numericUserID, {
          inventoryColor: '#8BC34A',
          maxItems: 100,
          inventoryTags: { name: 'My Pantry' },
        });
        inventoryList = [newInventory];
      }

      setInventories(inventoryList);

      // Prepare prefilled data
      const category = determineFoodCategory(selectedFood.label);
      const expiryDate = estimateExpiryDate(category);
      
      // Smart unit suggestion based on category
      const suggestUnit = (cat) => {
        switch (cat) {
          case 'Rice':
          case 'Soup':
          case 'Leftovers':
          case 'Beverages':
            return 'ml';
          case 'Grains':
          case 'Pasta':
          case 'Noodles':
          case 'Baking':
          case 'Spices':
          case 'Herbs':
            return 'g';
          case 'Meat':
          case 'Poultry':
          case 'Seafood':
          case 'Dairy':
          case 'Fruits':
          case 'Vegetables':
            return 'kg';
          default:
            return 'pcs';
        }
      };

      setPrefilledItemData({
        itemName: selectedFood.label,
        itemCategory: category,
        quantity: 1,
        unit: suggestUnit(category),
        itemExpiration: expiryDate,
        itemDescription: `Detected by ${selectedFood.source}`,
        imageURL: uri,
        inventoryID: inventoryList[0].inventoryID,
      });

      // Open the item form modal
      setItemFormVisible(true);

    } catch (error) {
      console.error('❌ Error preparing item form:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to open item form. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleSaveItem = async (itemData) => {
    try {
      // Ensure user session
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('You must be logged in');
      }

      // Resolve numeric user ID
      const { data: userData, error: userLookupError } = await supabase
        .from('tbl_users')
        .select('userID')
        .eq('userEmail', user.email)
        .single();

      if (userLookupError || !userData) {
        throw new Error('Failed to find user in database');
      }

      const numericUserID = userData.userID;

      // Create the item
      const createdItem = await PantryService.createItem({
        ...itemData,
        userID: numericUserID,
      });

      // Close form and show success
      setItemFormVisible(false);
      setPrefilledItemData(null);
      setAddedItemName(createdItem.itemName || itemData.itemName);
      setSuccessModalVisible(true);

      return { status: 'created', item: createdItem };
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to save item');
      return { status: 'error', error };
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

      setAddedItemName(manualItemName);
      setSuccessModalVisible(true);

      setManualItemName('');
      setManualCategory('Other');
      setManualQuantity('1');
      setManualExpiryDays('7');
      setManualEntryVisible(false);

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
          scrollEnabled={true}
        >
          <View style={styles.parallaxSpacer} />

          <View style={styles.contentCard}>
            {/* Hero Section - Top Result */}
            {selectedFood && !selectedFood.isUnknown ? (
              <View style={styles.heroContainer}>
                <View style={styles.heroHeader}>
                  <Text style={styles.heroLabel}>{selectedFood.label}</Text>
                  <View style={styles.heroBadgeContainer}>
                    <View style={styles.confidenceBadgeLarge}>
                      <Ionicons name="analytics" size={16} color="#FFF" />
                      <Text style={styles.confidenceTextLarge}>
                        {(selectedFood.confidence * 100).toFixed(0)}% Confidence
                      </Text>
                    </View>
                    <View style={styles.sourceBadgeLarge}>
                      <Ionicons name={selectedFood.source.includes('SousChef') ? "sparkles" : "flask"} size={16} color="#666" />
                      <Text style={styles.sourceTextLarge}>{selectedFood.source}</Text>
                    </View>
                  </View>
                </View>

                {/* Primary Actions for Selected Food */}
                <View style={styles.heroActions}>
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={handleAddToInventory}
                  >
                    <Ionicons name="add-circle" size={22} color="#FFF" />
                    <Text style={styles.addButtonText}>Add to Pantry</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.searchButtonHero}
                    onPress={handleSearchRecipes}
                  >
                    <Ionicons name="search" size={22} color="#FFF" />
                    <Text style={styles.addButtonText}>Find Recipes</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.noResultsContainer}>
                <Ionicons name="help-circle-outline" size={64} color="#FF6B6B" />
                <Text style={styles.noResultsText}>
                  {selectedFood?.isUnknown ? "We couldn't identify this food." : "No foods detected with sufficient confidence"}
                </Text>
                <Text style={styles.noResultsSubtext}>
                  Try taking a clearer photo or add the item manually.
                </Text>
              </View>
            )}

            {/* "Not your food?" Button */}
            {selectableOptions.length > 1 && !selectedFood?.isUnknown && (
              <View style={styles.toggleOptionsButton}>
                <Text style={styles.notYourFoodText}>
                  Not your food?{' '}
                </Text>
                <TouchableOpacity onPress={() => setOptionsModalVisible(true)}>
                  <Text style={styles.toggleOptionsText}>View Options</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.divider} />

            {/* Secondary Actions */}
            <View style={styles.secondaryActions}>
              <TouchableOpacity
                style={styles.manualButton}
                onPress={() => setManualEntryVisible(true)}
              >
                <Ionicons name="create-outline" size={20} color="#81A969" />
                <Text style={styles.manualButtonText}>Manual Entry</Text>
              </TouchableOpacity>

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

        {/* Options Modal */}
        <Modal
          animationType="none"
          transparent={true}
          visible={optionsModalVisible}
          onRequestClose={() => setOptionsModalVisible(false)}
        >
          <Animated.View style={[styles.centeredView, {
            opacity: optionsModalVisible ? 1 : 0
          }]}>
            <View style={styles.modalView}>
              <Text style={[styles.modalTitle, { marginBottom: 15 }]}>Select a Dish</Text>
              <ScrollView style={{ width: '100%' }} showsVerticalScrollIndicator={false}>
                {selectableOptions
                  .filter(item => item.label !== selectedFood?.label)
                  .map((item, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.optionCard}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedFood(item);
                        setOptionsModalVisible(false);
                      }}
                    >
                      <View style={styles.optionContent}>
                        <View style={styles.optionTextContainer}>
                          <Text style={styles.optionLabel}>{item.label}</Text>
                          <View style={styles.optionMeta}>
                            <Text style={styles.optionConfidence}>
                              {(item.confidence * 100).toFixed(0)}%
                            </Text>
                            <Text style={styles.optionSource}>{item.source}</Text>
                          </View>
                        </View>
                        <Ionicons name="radio-button-off" size={20} color="#ccc" />
                      </View>
                    </TouchableOpacity>
                  ))}
              </ScrollView>
              <TouchableOpacity
                style={[styles.button, styles.buttonClose]}
                onPress={() => setOptionsModalVisible(false)}
              >
                <Text style={styles.textStyle}>Close</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Modal>

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
                Top predictions from each AI model
              </Text>

              {/* Gemini Results Section */}
              {modelResults.gemini.length > 0 && (
                <View style={styles.modelSection}>
                  <View style={styles.modelSectionHeader}>
                    <Ionicons name="sparkles" size={18} color="#673AB7" />
                    <Text style={styles.modelSectionTitle}>SousChef AI Analysis</Text>
                  </View>
                  {modelResults.gemini.map((item, i) => (
                    <View key={i} style={styles.resultRow}>
                      <Text style={styles.resultLabel}>{item.label}</Text>
                      <View style={styles.resultConfidenceBadge}>
                        <Text style={styles.resultConfidence}>{(item.confidence * 100).toFixed(0)}%</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

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

              {/* ✅ NEW: Ingredient Results */}
              {modelResults.ingredients.length > 0 && (
                <View style={styles.modelSection}>
                  <View style={styles.modelSectionHeader}>
                    <Ionicons name="nutrition-outline" size={18} color="#9C27B0" />
                    <Text style={styles.modelSectionTitle}>
                      Ingredient Detector
                    </Text>
                  </View>
                  {modelResults.ingredients.map((item, i) => (
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
                  Confidence threshold: {(CONFIDENCE_THRESHOLD * 100).toFixed(0)}%
                </Text>
              </View>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </Modal>

        {/* Success Modal */}
        <Modal
          visible={successModalVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setSuccessModalVisible(false)}
        >
          <View style={successModalStyles.overlay}>
            <View style={successModalStyles.container}>
              <View style={successModalStyles.iconContainer}>
                <Ionicons name="checkmark-circle" size={80} color="#81A969" />
              </View>

              <Text style={successModalStyles.title}>Added Successfully!</Text>
              <Text style={successModalStyles.message}>
                {addedItemName} has been added to your pantry.
              </Text>

              <View style={successModalStyles.buttonContainer}>
                <TouchableOpacity
                  style={[successModalStyles.button, successModalStyles.primaryButton]}
                  onPress={() => {
                    setSuccessModalVisible(false);
                    router.push('/(tabs)/pantry');
                  }}
                >
                  <Ionicons name="basket-outline" size={20} color="#FFF" />
                  <Text style={successModalStyles.primaryButtonText}>View Pantry</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[successModalStyles.button, successModalStyles.secondaryButton]}
                  onPress={() => {
                    setSuccessModalVisible(false);
                    router.replace('/food-recognition/upload');
                  }}
                >
                  <Ionicons name="camera-outline" size={20} color="#81A969" />
                  <Text style={successModalStyles.secondaryButtonText}>Scan Another</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[successModalStyles.button, successModalStyles.cancelButton]}
                  onPress={() => setSuccessModalVisible(false)}
                >
                  <Text style={successModalStyles.cancelButtonText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>

      {/* Item Form Modal */}
      {inventories.length > 0 && (
        <ItemFormModal
          visible={itemFormVisible}
          onClose={() => {
            setItemFormVisible(false);
            setPrefilledItemData(null);
          }}
          onSave={handleSaveItem}
          initialData={prefilledItemData}
          inventories={inventories}
        />
      )}
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
                  placeholderTextColor="#999"
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
                  placeholderTextColor="#999"
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

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: hp('2%'),
    fontSize: wp('4%'),
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp('5%'),
    backgroundColor: '#f5f5f5',
  },
  errorTitle: {
    fontSize: wp('5%'),
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
  manualEntryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B6B',
    paddingVertical: hp('1.5%'),
    paddingHorizontal: wp('6%'),
    borderRadius: 12,
    marginBottom: hp('2%'),
  },
  manualEntryButtonText: {
    color: '#FFF',
    fontSize: wp('4%'),
    fontWeight: 'bold',
    marginLeft: 8,
  },
  retryButton: {
    paddingVertical: hp('1.5%'),
    paddingHorizontal: wp('6%'),
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#81A969',
  },
  retryButtonText: {
    color: '#81A969',
    fontSize: wp('4%'),
    fontWeight: 'bold',
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
    backgroundColor: 'transparent',
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
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  headerSection: {
    marginBottom: hp('2%'),
  },
  resultsTitle: {
    fontSize: wp('5.5%'),
    fontWeight: 'bold',
    color: '#333',
    marginBottom: hp('0.5%'),
  },
  resultsSubtitle: {
    fontSize: wp('3.5%'),
    color: '#666',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('1.5%'),
  },
  sectionHeaderText: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  optionsContainer: {
    marginBottom: hp('2%'),
  },
  optionCard: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: wp('4%'),
    marginBottom: hp('1%'),
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionCardSelected: {
    borderColor: '#81A969',
    backgroundColor: '#f0f8e8',
  },
  optionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionTextContainer: {
    flex: 1,
  },
  optionLabel: {
    fontSize: wp('4.2%'),
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  optionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  optionConfidence: {
    fontSize: wp('3%'),
    color: '#81A969',
    fontWeight: '600',
    marginLeft: 4,
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  optionSource: {
    fontSize: wp('3%'),
    color: '#666',
    marginLeft: 4,
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    backgroundColor: '#81A969',
    borderColor: '#81A969',
  },
  noResultsContainer: {
    alignItems: 'center',
    padding: hp('4%'),
  },
  noResultsText: {
    fontSize: wp('4%'),
    color: '#666',
    marginTop: hp('2%'),
    textAlign: 'center',
  },
  noResultsSubtext: {
    fontSize: wp('3.5%'),
    color: '#999',
    marginTop: hp('1%'),
    textAlign: 'center',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: hp('2%'),
  },
  manualButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#81A969',
    paddingVertical: hp('1.5%'),
    borderRadius: 12,
  },
  manualButtonText: {
    color: '#81A969',
    fontSize: wp('4%'),
    fontWeight: 'bold',
    marginLeft: 6,
  },
  addButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#81A969',
    paddingVertical: hp('1.5%'),
    borderRadius: 12,
  },
  addButtonDisabled: {
    backgroundColor: '#ccc',
  },
  addButtonText: {
    color: '#FFF',
    fontSize: wp('4%'),
    fontWeight: 'bold',
    marginLeft: 6,
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B6B',
    paddingVertical: hp('1.5%'),
    paddingHorizontal: wp('4%'),
    borderRadius: 12,
    marginBottom: hp('2%'),
  },
  searchButtonDisabled: {
    backgroundColor: '#ccc',
  },
  searchButtonText: {
    color: '#FFF',
    fontSize: wp('4%'),
    fontWeight: 'bold',
    marginHorizontal: 8,
    flex: 1,
    textAlign: 'center',
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    paddingVertical: hp('1.5%'),
    borderRadius: 12,
  },
  detailsButtonText: {
    color: '#81A969',
    fontSize: wp('4%'),
    fontWeight: 'bold',
    marginLeft: 6,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp('5%'),
    paddingTop: hp('6%'),
    paddingBottom: hp('2%'),
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: wp('5%'),
    fontWeight: 'bold',
    color: '#333',
  },
  closeModalButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: wp('5%'),
    paddingTop: hp('2%'),
  },
  modelDetailsSubtitle: {
    fontSize: wp('3.5%'),
    color: '#666',
    marginBottom: hp('2%'),
  },
  modelSection: {
    marginBottom: hp('3%'),
  },
  modelSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('1%'),
  },
  modelSectionTitle: {
    fontSize: wp('4.2%'),
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    padding: wp('3%'),
    borderRadius: 8,
    marginBottom: hp('0.8%'),
  },
  resultRank: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#81A969',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  resultRankText: {
    color: '#fff',
    fontSize: wp('3.5%'),
    fontWeight: 'bold',
  },
  resultLabel: {
    flex: 1,
    fontSize: wp('4%'),
    color: '#333',
    textTransform: 'capitalize',
  },
  resultConfidenceBadge: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  resultConfidence: {
    fontSize: wp('3.5%'),
    color: '#81A969',
    fontWeight: '600',
  },
  techInfo: {
    backgroundColor: '#f0f0f0',
    padding: wp('4%'),
    borderRadius: 8,
    marginTop: hp('2%'),
  },
  techInfoText: {
    fontSize: wp('3.5%'),
    color: '#666',
    marginBottom: 4,
  },
  heroContainer: {
    alignItems: 'center',
    marginBottom: hp('3%'),
  },
  heroHeader: {
    alignItems: 'center',
    marginBottom: SCREEN_HEIGHT < 700 ? hp('4%') : hp('12%'),
  },
  heroLabel: {
    fontSize: wp('7%'),
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: hp('1%'),
    textTransform: 'capitalize',
  },
  heroBadgeContainer: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  confidenceBadgeLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#81A969',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  confidenceTextLarge: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: wp('3.5%'),
    marginLeft: 6,
  },
  sourceBadgeLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  sourceTextLarge: {
    color: '#666',
    fontSize: wp('3.5%'),
    marginLeft: 6,
  },
  heroActions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  searchButtonHero: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#81A969',
    paddingVertical: hp('1.5%'),
    borderRadius: 12,
  },
  toggleOptionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('1.5%'),
    marginBottom: hp('1%'),
  },
  notYourFoodText: {
    color: '#666',
    fontSize: wp('4%'),
    fontWeight: '400',
  },
  toggleOptionsText: {
    color: '#81A969',
    fontSize: wp('4%'),
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  noOtherOptionsText: {
    textAlign: 'center',
    color: '#999',
    fontStyle: 'italic',
    padding: 10,
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: hp('4%'),
  },
  secondaryActions: {
    gap: 10,
  },
  // ✅ NEW: Modal Styles
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: 'transparent'
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
    maxHeight: hp('80%'),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: wp('5%'),
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: wp('5%'),
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: wp('5%'),
  },
  imagePreview: {
    alignItems: 'center',
    marginBottom: hp('2%'),
  },
  previewImage: {
    width: '100%',
    height: hp('20%'),
    borderRadius: 12,
    resizeMode: 'cover',
  },
  imageNote: {
    fontSize: wp('3%'),
    color: '#999',
    marginTop: 8,
  },
  field: {
    marginBottom: hp('2%'),
  },
  label: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.5%'),
    fontSize: wp('4%'),
    color: '#333',
  },
  categoryContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1%'),
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  categoryChipSelected: {
    backgroundColor: '#81A969',
    borderColor: '#81A969',
  },
  categoryChipText: {
    fontSize: wp('3.5%'),
    color: '#666',
  },
  categoryChipTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  row: {
    flexDirection: 'row',
  },
  submitButton: {
    backgroundColor: '#81A969',
    paddingVertical: hp('2%'),
    borderRadius: 12,
    alignItems: 'center',
    marginTop: hp('2%'),
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: wp('4.5%'),
    fontWeight: 'bold',
  },
});

const successModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp('5%'),
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: wp('6%'),
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: hp('2%'),
  },
  title: {
    fontSize: wp('6%'),
    fontWeight: 'bold',
    color: '#333',
    marginBottom: hp('1%'),
  },
  message: {
    fontSize: wp('4%'),
    color: '#666',
    textAlign: 'center',
    marginBottom: hp('3%'),
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('1.5%'),
    borderRadius: 12,
  },
  primaryButton: {
    backgroundColor: '#81A969',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: wp('4%'),
    fontWeight: 'bold',
    marginLeft: 8,
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#81A969',
  },
  secondaryButtonText: {
    color: '#81A969',
    fontSize: wp('4%'),
    fontWeight: 'bold',
    marginLeft: 8,
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: wp('4%'),
    fontWeight: '600',
  },
});