import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, Alert, Modal, TextInput } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { recognizeFood } from '../../services/food-recog-api';
import { supabase } from '../../lib/supabase';
import PantryService from '../../services/pantry-service';

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

  // ✅ NEW: Get ALL predictions with ≥3% confidence for selection
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

  // ✅ NEW: Get top 5 results per model for display
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

  // ✅ FIXED: Add to inventory with proper UUID to numeric userID conversion
  const handleAddToInventory = async () => {
    if (!selectedFood) {
      Alert.alert('No Selection', 'Please select a food item first');
      return;
    }

    setAddingToInventory(true);
    
    try {
      console.log('🍽️ Adding to inventory:', selectedFood.label);

      // ✅ Step 1: Get Auth user (UUID)
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('You must be logged in to add items');
      }

      console.log('👤 Auth UUID:', user.id);
      console.log('📧 User email:', user.email);

      // ✅ Step 2: Convert Auth UUID to numeric userID
      const { data: userData, error: userLookupError } = await supabase
        .from('tbl_users')
        .select('userID')
        .eq('userEmail', user.email)
        .single();

      if (userLookupError || !userData) {
        console.error('❌ User lookup error:', userLookupError);
        throw new Error('Failed to find user in database. Please try logging out and back in.');
      }

      const numericUserID = userData.userID;
      console.log('✅ Numeric userID:', numericUserID);

      // ✅ Step 3: Get or create inventory using NUMERIC userID
      const { data: inventories, error: invError } = await supabase
        .from('tbl_inventories')
        .select('*')
        .eq('userID', numericUserID)
        .order('createdAt', { ascending: true })
        .limit(1);

      if (invError) {
        console.error('❌ Inventory fetch error:', invError);
        throw new Error(`Failed to fetch inventory: ${invError.message}`);
      }

      let inventoryID = inventories?.[0]?.inventoryID;

      if (!inventoryID) {
        console.log('📦 Creating new inventory for user...');
        const newInventory = await PantryService.createInventory(numericUserID, {
          inventoryColor: '#8BC34A',
          maxItems: 100,
          inventoryTags: { name: 'My Pantry' },
        });
        inventoryID = newInventory.inventoryID;
        console.log('✅ Created inventory:', inventoryID);
      } else {
        console.log('✅ Using existing inventory:', inventoryID);
      }

      const category = determineFoodCategory(selectedFood.label);
      const expiryDate = estimateExpiryDate(category);

      console.log('📝 Item details:', {
        name: selectedFood.label,
        category,
        expiryDate,
        inventoryID
      });

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

      console.log('💾 Saving item with data:', itemData);

      const createdItem = await PantryService.createItem(itemData);

      console.log('✅ Item created successfully:', createdItem);

      Alert.alert(
        'Added! ✅',
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
      console.error('❌ Full error:', JSON.stringify(error, null, 2));
      Alert.alert(
        'Error Adding Item',
        error.message || 'Failed to add item to pantry. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setAddingToInventory(false);
    }
  };

  // ✅ FIXED: Manual entry with proper UUID to numeric userID conversion
  const handleManualEntry = async () => {
    if (!manualItemName.trim()) {
      Alert.alert('Missing Information', 'Please enter an item name');
      return;
    }

    setAddingToInventory(true);

    try {
      console.log('📝 Manual entry:', manualItemName);

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('You must be logged in');
      }

      console.log('👤 Auth UUID:', user.id);
      console.log('📧 User email:', user.email);

      const { data: userData, error: userLookupError } = await supabase
        .from('tbl_users')
        .select('userID')
        .eq('userEmail', user.email)
        .single();

      if (userLookupError || !userData) {
        console.error('❌ User lookup error:', userLookupError);
        throw new Error('Failed to find user in database');
      }

      const numericUserID = userData.userID;
      console.log('✅ Numeric userID:', numericUserID);

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
        console.log('📦 Creating new inventory...');
        const newInventory = await PantryService.createInventory(numericUserID, {
          inventoryColor: '#8BC34A',
          maxItems: 100,
          inventoryTags: { name: 'My Pantry' },
        });
        inventoryID = newInventory.inventoryID;
        console.log('✅ Created inventory:', inventoryID);
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

      console.log('💾 Creating manual item:', itemData);

      await PantryService.createItem(itemData);

      setManualItemName('');
      setManualCategory('Other');
      setManualQuantity('1');
      setManualExpiryDays('7');
      setManualEntryVisible(false);

      Alert.alert(
        'Added! ✅',
        `${manualItemName} has been added to your pantry.`,
        [
          { text: 'View Pantry', onPress: () => router.push('/(tabs)/pantry') },
          { text: 'Add Another', onPress: () => setManualEntryVisible(true) }
        ]
      );

    } catch (error) {
      console.error('❌ Manual entry error:', error);
      console.error('❌ Full error:', JSON.stringify(error, null, 2));
      Alert.alert('Error', error.message || 'Failed to add item');
    } finally {
      setAddingToInventory(false);
    }
  };

  const handleSearchRecipes = () => {
    if (!selectedFood) return;
    
    // ✅ FIX: Add autoSearch parameter to trigger automatic search
    router.push({
      pathname: '/(tabs)/recipe-search',
      params: { 
        searchQuery: selectedFood.label,  // Changed from 'query' to 'searchQuery'
        autoSearch: 'true'  // Add this flag to trigger auto-search
      }
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
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
    <View style={styles.container}>
      <ScrollView>
        {/* Image Preview */}
        <View style={styles.imageContainer}>
          <Image source={{ uri }} style={styles.image} />
        </View>

        {/* Results Header */}
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>🍽️ Food Recognition Results</Text>
          <Text style={styles.resultsSubtitle}>
            {selectableOptions.length} items detected with ≥3% confidence
          </Text>
        </View>

        {/* ✅ NEW: Selectable Options Section (≥3% confidence) */}
        {selectableOptions.length > 0 ? (
          <View style={styles.optionsContainer}>
            <View style={styles.sectionHeader}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
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
                onPress={() => setSelectedFood(item)}
              >
                <View style={styles.optionContent}>
                  <View style={styles.optionTextContainer}>
                    <Text style={styles.optionLabel}>{item.label}</Text>
                    <View style={styles.optionMeta}>
                      <View style={styles.confidenceBadge}>
                        <Ionicons name="analytics" size={14} color="#4CAF50" />
                        <Text style={styles.optionConfidence}>
                          {(item.confidence * 100).toFixed(1)}%
                        </Text>
                      </View>
                      <View style={styles.sourceBadge}>
                        <Ionicons name="flask" size={12} color="#666" />
                        <Text style={styles.optionSource}>{item.source}</Text>
                      </View>
                    </View>
                  </View>
                  {selectedFood?.label === item.label && (
                    <Ionicons name="checkmark-circle" size={28} color="#4CAF50" />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.noResultsContainer}>
            <Ionicons name="restaurant-outline" size={48} color="#999" />
            <Text style={styles.noResultsText}>
              No foods detected with sufficient confidence (≥3%)
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
                !selectedFood && styles.addButtonDisabled,
                addingToInventory && styles.addButtonDisabled,
              ]}
              onPress={handleAddToInventory}
              disabled={!selectedFood || addingToInventory}
            >
              {addingToInventory ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="add-circle" size={20} color="#FFF" />
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
            <Ionicons name="search" size={20} color="#FFF" />
            <Text style={styles.searchButtonText}>
              Find Recipes for "{selectedFood?.label || 'Selected Food'}"
            </Text>
            <Ionicons name="arrow-forward" size={20} color="#FFF" />
          </TouchableOpacity>
        )}

        {/* ✅ NEW: Model Results Details (Top 5 per model) */}
        {result && (
          <View style={styles.modelDetailsContainer}>
            <Text style={styles.modelDetailsTitle}>📊 Detailed Results by Model</Text>
            <Text style={styles.modelDetailsSubtitle}>
              Top 5 predictions from each AI model
            </Text>

            {/* Detector Results */}
            {modelResults.detector.length > 0 && (
              <View style={styles.modelSection}>
                <View style={styles.modelSectionHeader}>
                  <Ionicons name="scan" size={18} color="#FF6B6B" />
                  <Text style={styles.modelSectionTitle}>
                    🎯 Object Detector (YOLOv8)
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
                  <Ionicons name="fast-food" size={18} color="#FF9800" />
                  <Text style={styles.modelSectionTitle}>
                    🍕 Food101 Classifier
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
                  <Ionicons name="restaurant" size={18} color="#4CAF50" />
                  <Text style={styles.modelSectionTitle}>
                    🇵🇭 Filipino Food Classifier
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
                ⚡ Processing time: {result.elapsed_ms?.toFixed(0)}ms
              </Text>
              <Text style={styles.techInfoText}>
                🖥️ Device: {result.device || 'CPU'}
              </Text>
              <Text style={styles.techInfoText}>
                🎯 Confidence threshold: {(CONFIDENCE_THRESHOLD * 100).toFixed(0)}%
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Back Button */}
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color="#333" />
      </TouchableOpacity>

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
    </View>
  );
}

// ✅ Manual Entry Modal Component (unchanged)
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
            <Text style={modalStyles.headerTitle}>✏️ Add Item Manually</Text>
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

            <View style={modalStyles.field}>
              <Text style={modalStyles.label}>Quantity</Text>
              <TextInput
                style={modalStyles.input}
                value={quantity}
                onChangeText={setQuantity}
                placeholder="1"
                keyboardType="numeric"
                placeholderTextColor="#999"
              />
            </View>

            <View style={modalStyles.field}>
              <Text style={modalStyles.label}>Days Until Expiry</Text>
              <TextInput
                style={modalStyles.input}
                value={expiryDays}
                onChangeText={setExpiryDays}
                placeholder="7"
                keyboardType="numeric"
                placeholderTextColor="#999"
              />
            </View>
          </ScrollView>

          <TouchableOpacity
            style={[
              modalStyles.submitButton,
              (!itemName.trim() || loading) && modalStyles.submitButtonDisabled,
            ]}
            onPress={onSubmit}
            disabled={!itemName.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                <Text style={modalStyles.submitButtonText}>Add to Pantry</Text>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  imageContainer: {
    width: '100%',
    height: 300,
    backgroundColor: '#000',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  resultsContainer: {
    padding: 20,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  resultsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  resultsSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  optionsContainer: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  sectionHeaderText: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '600',
    flex: 1,
  },
  optionCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  optionCardSelected: {
    borderColor: '#4CAF50',
    backgroundColor: '#F1F8F4',
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
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  optionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  optionConfidence: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  optionSource: {
    fontSize: 11,
    color: '#666',
  },
  noResultsContainer: {
    padding: 40,
    alignItems: 'center',
  },
  noResultsText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
  },
  noResultsSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  manualButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#FF6B6B',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  manualButtonText: {
    color: '#FF6B6B',
    fontSize: 16,
    fontWeight: '600',
  },
  addButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  addButtonDisabled: {
    backgroundColor: '#CCC',
  },
  addButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  searchButton: {
    flexDirection: 'row',
    backgroundColor: '#2196F3',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  searchButtonDisabled: {
    backgroundColor: '#CCC',
  },
  searchButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: '#FFF',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F5F5F5',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  manualEntryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  manualEntryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  retryButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // ✅ NEW: Model Details Styles
  modelDetailsContainer: {
    margin: 16,
    padding: 16,
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  modelDetailsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  modelDetailsSubtitle: {
    fontSize: 12,
    color: '#999',
    marginBottom: 16,
  },
  modelSection: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modelSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  modelSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    marginBottom: 6,
  },
  resultRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  resultRankText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
  },
  resultLabel: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  resultConfidenceBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  resultConfidence: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
  },
  techInfo: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  techInfoText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  imagePreview: {
    alignItems: 'center',
    marginBottom: 20,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    resizeMode: 'cover',
  },
  imageNote: {
    marginTop: 8,
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#F9F9F9',
  },
  categoryContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFF',
  },
  categoryChipSelected: {
    backgroundColor: '#FF6B6B',
    borderColor: '#FF6B6B',
  },
  categoryChipText: {
    fontSize: 14,
    color: '#666',
  },
  categoryChipTextSelected: {
    color: '#FFF',
    fontWeight: '600',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    margin: 20,
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#CCC',
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});