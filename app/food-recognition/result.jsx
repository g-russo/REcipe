import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, Alert, TextInput } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { recognizeFood } from '../../services/food-recog-api';
import { supabase } from '../../lib/supabase';
import PantryService from '../../services/pantry-service';

export default function ResultScreen() {
  const { data, uri } = useLocalSearchParams();

  const initial = useMemo(() => {
    try { return data ? JSON.parse(data) : null; } catch { return null; }
  }, [data]);

  const [result, setResult] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [origSize, setOrigSize] = useState(null);
  const [layoutW, setLayoutW] = useState(0);
  const [selectedFood, setSelectedFood] = useState(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualFoodName, setManualFoodName] = useState('');

  useEffect(() => {
    if (!result && uri) {
      (async () => {
        setLoading(true);
        try {
          const res = await recognizeFood(uri);
          setResult(res);
        } catch (e) {
          console.error('Recognize error:', e);
          setResult({ detections: [], note: 'frontend error' });
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [result, uri]);

  useEffect(() => {
    if (!uri) return;
    Image.getSize(
      uri,
      (w, h) => setOrigSize({ w, h }),
      () => setOrigSize(null)
    );
  }, [uri]);

  const detections = useMemo(() => {
    const arr = result?.detections || result?.detector_detections || [];
    return Array.isArray(arr) ? arr : [];
  }, [result]);

  const food101TopK = useMemo(() => {
    const arr = result?.main_topk || result?.food101_topk || [];
    return Array.isArray(arr) ? arr : [];
  }, [result]);

  const filipinoTopK = useMemo(() => {
    const arr = result?.fil_topk || result?.filipino_topk || [];
    return Array.isArray(arr) ? arr : [];
  }, [result]);

  const hasDetections = detections.length > 0;
  const pct = (v) => (typeof v === 'number' ? (v * 100).toFixed(1) : '?');

  const displayH = useMemo(() => {
    if (!origSize || !layoutW) return 0;
    const { w, h } = origSize;
    return Math.max(1, Math.round((layoutW * h) / w));
  }, [origSize, layoutW]);

  const scaleBox = (b) => {
    if (!origSize || !displayH || !layoutW) return null;
    const { w, h } = origSize;
    const isNormalized = Math.max(b.x2 ?? 0, b.y2 ?? 0) <= 1.5;
    const x1 = (isNormalized ? b.x1 * w : b.x1) || 0;
    const y1 = (isNormalized ? b.y1 * h : b.y1) || 0;
    const x2 = (isNormalized ? b.x2 * w : b.x2) || 0;
    const y2 = (isNormalized ? b.y2 * h : b.y2) || 0;
    const sx = layoutW / w;
    const sy = displayH / h;
    return {
      left: x1 * sx,
      top: y1 * sy,
      width: Math.max(1, (x2 - x1) * sx),
      height: Math.max(1, (y2 - y1) * sy),
    };
  };

  const determineFoodCategory = (foodName) => {
    const name = foodName.toLowerCase();
    if (/apple|banana|orange|grape|strawberry|mango|pineapple|watermelon|kiwi|berry/i.test(name)) return 'Fruits';
    if (/carrot|tomato|potato|onion|lettuce|cabbage|spinach|broccoli|pepper|cucumber/i.test(name)) return 'Vegetables';
    if (/chicken|beef|pork|fish|salmon|tuna|egg|tofu|meat|steak/i.test(name)) return 'Meat & Protein';
    if (/milk|cheese|yogurt|butter|cream|dairy/i.test(name)) return 'Dairy';
    if (/rice|bread|pasta|noodle|wheat|cereal|oat/i.test(name)) return 'Grains';
    if (/juice|soda|coffee|tea|water|drink|beverage/i.test(name)) return 'Beverages';
    if (/chip|cookie|candy|chocolate|snack|cracker/i.test(name)) return 'Snacks';
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

  const allDetectedFoods = useMemo(() => {
    const foods = [];

    if (result?.global_class) {
      foods.push({
        name: result.global_class,
        confidence: result.global_conf || 0,
        source: result.global_class_source || 'classifier',
        type: 'global'
      });
    }

    food101TopK.forEach((item, idx) => {
      if (idx < 5) {
        foods.push({
          name: item.label,
          confidence: item.conf,
          source: 'Food101',
          type: 'food101'
        });
      }
    });

    filipinoTopK.forEach((item, idx) => {
      if (idx < 5) {
        foods.push({
          name: item.label,
          confidence: item.conf,
          source: 'Filipino',
          type: 'filipino'
        });
      }
    });

    detections.forEach((item, idx) => {
      if (idx < 5) {
        foods.push({
          name: item.label || item.class_name,
          confidence: item.confidence,
          source: 'Detector',
          type: 'detector'
        });
      }
    });

    const uniqueFoods = [];
    const seenNames = new Set();

    foods
      .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
      .forEach(food => {
        const normalizedName = food.name.toLowerCase().trim();
        if (!seenNames.has(normalizedName)) {
          seenNames.add(normalizedName);
          uniqueFoods.push(food);
        }
      });

    return uniqueFoods.slice(0, 10);
  }, [result, food101TopK, filipinoTopK, detections]);

  const handleAddToPantry = async (foodName = null, isManual = false) => {
    const itemName = foodName || (isManual ? manualFoodName : selectedFood?.name);

    if (!itemName || itemName.trim() === '') {
      Alert.alert('Error', 'Please enter or select a food item');
      return;
    }

    Alert.alert(
      'Add to Pantry?',
      `Add "${itemName}" to your pantry?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add',
          onPress: async () => {
            try {
              // ✅ Step 1: Get Auth user (UUID)
              const { data: { user }, error: authError } = await supabase.auth.getUser();
              if (authError || !user) {
                Alert.alert('Error', 'You must be logged in');
                return;
              }

              console.log('🔍 Auth user ID (UUID):', user.id);
              console.log('📧 User email:', user.email);

              // ✅ Step 2: Convert UUID to numeric userID
              const numericUserID = await PantryService.getUserID(user.id);
              console.log('✅ Numeric userID:', numericUserID);

              // ✅ Step 3: Get user's inventories using NUMERIC userID (not UUID)
              const inventories = await PantryService.getUserInventories(numericUserID);
              console.log('📦 Inventories:', inventories);

              let inventoryID = inventories?.[0]?.inventoryID;

              // ✅ Step 4: Create inventory if none exists using NUMERIC userID
              if (!inventoryID) {
                console.log('📦 No inventory found, creating one...');
                const newInventory = await PantryService.createInventory(numericUserID, {
                  inventoryColor: '#8BC34A',
                  maxItems: 100,
                  inventoryTags: { name: 'My Pantry' },
                });
                inventoryID = newInventory.inventoryID;
                console.log('✅ Created inventory:', inventoryID);
              }

              const category = determineFoodCategory(itemName);
              const expiryDate = estimateExpiryDate(category);

              // ✅ Step 5: Create item with NUMERIC userID
              const itemData = {
                inventoryID: inventoryID,
                itemName: itemName,
                itemCategory: category,
                quantity: 1,
                unit: 'pcs',
                itemExpiration: expiryDate,
                itemTags: JSON.stringify({
                  source: isManual ? 'manual_entry' : 'food_recognition',
                  scannedAt: new Date().toISOString(),
                  confidence: isManual ? null : selectedFood?.confidence,
                  recognitionSource: isManual ? 'manual' : selectedFood?.source,
                  hasImage: !!uri,
                }),
                imageURL: uri, // Pass the URI, PantryService will upload it
                userID: numericUserID, // Use NUMERIC userID for image upload
              };

              console.log('📝 Creating item with data:', itemData);
              await PantryService.createItem(itemData);

              Alert.alert(
                'Added! ✅',
                `${itemName} has been added to your pantry.`,
                [
                  { text: 'View Pantry', onPress: () => router.push('/(tabs)/pantry') },
                  { text: 'Scan Another', onPress: () => router.replace('/food-recognition/upload') }
                ]
              );

              setShowManualEntry(false);
              setManualFoodName('');
            } catch (error) {
              console.error('❌ Add error:', error);
              Alert.alert('Error', `Failed to add item: ${error.message}`);
            }
          }
        }
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Food Recognition Result</Text>
        <TouchableOpacity onPress={() => router.replace('/food-recognition/upload')}>
          <Ionicons name="camera" size={24} color="#2196F3" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Image + overlays */}
        {uri ? (
          <View
            onLayout={(e) => setLayoutW(e.nativeEvent.layout.width)}
            style={{ width: '100%', backgroundColor: '#111', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}
          >
            {/* Displayed image */}
            {!!displayH && (
              <Image source={{ uri }} style={{ width: '100%', height: displayH, resizeMode: 'contain' }} />
            )}
            {/* Overlays for detector (best.pt) */}
            {!!displayH && hasDetections && (
              <View style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: displayH }}>
                {detections.map((d, i) => {
                  const box = scaleBox(d);
                  if (!box) return null;
                  return (
                    <View key={i} style={[styles.box, box]}>
                      <Text style={styles.boxLabel}>
                        {d.label || d.class_name} {typeof d.confidence === 'number' ? `${pct(d.confidence)}%` : ''}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ) : null}

        {loading && <ActivityIndicator size="large" />}

        {/* Food Selection List */}
        {!loading && allDetectedFoods.length > 0 && !showManualEntry && (
          <View>
            <Text style={styles.title}>Select detected food:</Text>
            
            {allDetectedFoods.map((food, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.foodOption,
                  selectedFood?.name === food.name && styles.foodOptionSelected
                ]}
                onPress={() => setSelectedFood(food)}
              >
                <View style={styles.foodOptionLeft}>
                  <View style={[
                    styles.radioButton,
                    selectedFood?.name === food.name && styles.radioButtonSelected
                  ]}>
                    {selectedFood?.name === food.name && (
                      <View style={styles.radioButtonInner} />
                    )}
                  </View>
                  <View>
                    <Text style={[
                      styles.foodName,
                      selectedFood?.name === food.name && styles.foodNameSelected
                    ]}>
                      {food.name}
                    </Text>
                    <Text style={styles.foodSource}>
                      {food.source} • {pct(food.confidence)}% confidence
                    </Text>
                  </View>
                </View>
                <Ionicons 
                  name={selectedFood?.name === food.name ? "checkmark-circle" : "ellipse-outline"} 
                  size={24} 
                  color={selectedFood?.name === food.name ? "#4CAF50" : "#ccc"} 
                />
              </TouchableOpacity>
            ))}

            {/* Wrong Detection Button */}
            <TouchableOpacity 
              style={styles.wrongDetectionButton}
              onPress={() => setShowManualEntry(true)}
            >
              <Ionicons name="alert-circle-outline" size={24} color="#FF9800" />
              <Text style={styles.wrongDetectionText}>Wrong detection? Enter manually</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.addButton,
                !selectedFood && styles.addButtonDisabled
              ]} 
              onPress={() => handleAddToPantry()}
              disabled={!selectedFood}
            >
              <Ionicons name="add-circle" size={24} color="#fff" />
              <Text style={styles.addButtonText}>
                {selectedFood ? `Add "${selectedFood.name}"` : 'Select a food first'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Manual Entry Form */}
        {!loading && showManualEntry && (
          <View>
            <Text style={styles.title}>Enter food name manually:</Text>
            
            <View style={styles.manualEntryCard}>
              <Ionicons name="create-outline" size={24} color="#666" style={{ marginBottom: 12 }} />
              <TextInput
                style={styles.manualInput}
                placeholder="e.g., Chicken Adobo, Apple, Rice"
                value={manualFoodName}
                onChangeText={setManualFoodName}
                autoFocus
                autoCapitalize="words"
              />
            </View>

            <View style={styles.manualButtonsRow}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => {
                  setShowManualEntry(false);
                  setManualFoodName('');
                }}
              >
                <Text style={styles.cancelButtonText}>Back to Results</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[
                  styles.addButtonManual,
                  !manualFoodName.trim() && styles.addButtonDisabled
                ]} 
                onPress={() => handleAddToPantry(null, true)}
                disabled={!manualFoodName.trim()}
              >
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={styles.addButtonText}>Add to Pantry</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* No Results */}
        {!loading && allDetectedFoods.length === 0 && !showManualEntry && (
          <View style={styles.noResultsContainer}>
            <Ionicons name="search-outline" size={64} color="#ccc" />
            <Text style={styles.noResultsText}>No food detected</Text>
            <Text style={styles.noResultsSubtext}>But you can still add it manually!</Text>
            
            <TouchableOpacity 
              style={styles.manualEntryButton}
              onPress={() => setShowManualEntry(true)}
            >
              <Ionicons name="create" size={20} color="#fff" />
              <Text style={styles.retryButtonText}>Enter Manually</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => router.replace('/food-recognition/upload')}
            >
              <Ionicons name="camera" size={20} color="#fff" />
              <Text style={styles.retryButtonText}>Take Another Photo</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Detailed Results */}
        {!loading && result && allDetectedFoods.length > 0 && !showManualEntry && (
          <View style={{ marginTop: 24, paddingTop: 24, borderTopWidth: 1, borderTopColor: '#e0e0e0' }}>
            <Text style={styles.detailsTitle}>📊 All Detection Results</Text>

            {food101TopK.length > 0 && (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.section}>Food101 Model</Text>
                {food101TopK.map((it, i) => (
                  <View key={i} style={styles.row}>
                    <Text style={styles.label}>{i + 1}. {it.label}</Text>
                    <Text style={styles.conf}>{pct(it.conf)}%</Text>
                  </View>
                ))}
              </View>
            )}

            {filipinoTopK.length > 0 && (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.section}>Filipino Food Model</Text>
                {filipinoTopK.map((it, i) => (
                  <View key={i} style={styles.row}>
                    <Text style={styles.label}>{i + 1}. {it.label}</Text>
                    <Text style={styles.conf}>{pct(it.conf)}%</Text>
                  </View>
                ))}
              </View>
            )}

            {detections.length > 0 && (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.section}>Object Detector</Text>
                {detections.map((it, i) => (
                  <View key={i} style={styles.row}>
                    <Text style={styles.label}>{i + 1}. {it.label || it.class_name}</Text>
                    <Text style={styles.conf}>{pct(it.confidence)}%</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#333', flex: 1, textAlign: 'center' },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 16, color: '#333' },
  detailsTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12, color: '#666' },
  
  foodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  foodOptionSelected: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  foodOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ccc',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    borderColor: '#4CAF50',
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
  },
  foodName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  foodNameSelected: {
    color: '#1B5E20',
  },
  foodSource: {
    fontSize: 12,
    color: '#666',
  },
  
  wrongDetectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    marginTop: 8,
    marginBottom: 16,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    gap: 8,
  },
  wrongDetectionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E65100',
  },
  manualEntryCard: {
    backgroundColor: '#f8f9fa',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  manualInput: {
    width: '100%',
    fontSize: 16,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  manualButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  addButtonManual: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  addButtonDisabled: {
    backgroundColor: '#ccc',
  },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  
  noResultsContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  noResultsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  noResultsSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    marginBottom: 24,
  },
  manualEntryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF9800',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    gap: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  
  section: { fontSize: 16, fontWeight: '600', marginBottom: 8, color: '#333' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  label: { fontSize: 14, color: '#111' },
  conf: { fontSize: 14, color: '#666' },
  box: { position: 'absolute', borderWidth: 2, borderColor: '#22c55e' },
  boxLabel: {
    position: 'absolute',
    left: 0,
    top: -20,
    backgroundColor: '#22c55e',
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
});