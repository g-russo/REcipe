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
import { recognizeFoodCombined } from '../../services/food-recog-api';
import { supabase, safeGetUser } from '../../lib/supabase';
import PantryService from '../../services/pantry-service';
import LoadingOverlay from '../../components/food-recognition/loading-overlay';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import AuthGuard from '../../components/auth-guard';
import ItemFormModal from '../../components/pantry/item-form-modal';
import PantryAlert from '../../components/pantry/pantry-alert';
import SousChefAIService from '../../services/souschef-ai-service';
import DeconstructionModal from '../../components/food-recognition/deconstruction-modal';
import EdamamService from '../../services/edamam-service';
import * as ImageManipulator from 'expo-image-manipulator';

const CONFIDENCE_THRESHOLD = 0.03; // 3% minimum confidence

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

  // Manual entry - now uses ItemFormModal directly
  const [addingToInventory, setAddingToInventory] = useState(false);

  // Item Form Modal State
  const [itemFormVisible, setItemFormVisible] = useState(false);
  const [inventories, setInventories] = useState([]);
  const [prefilledItemData, setPrefilledItemData] = useState(null);

  // Group Selection Alert State
  const [groupSelectionAlert, setGroupSelectionAlert] = useState({
    visible: false,
    message: '',
    groups: [],
    onSelectGroup: null,
    singleGroupMode: false
  });

  // Duplicate Alert State
  const [duplicateAlert, setDuplicateAlert] = useState({
    visible: false,
    itemData: null,
    duplicateItem: null,
    canMerge: false,
    numericUserID: null,
    resolve: null
  });

  // Detailed Results Modal State
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [deconstructionModalVisible, setDeconstructionModalVisible] = useState(false);
  const [deconstructionData, setDeconstructionData] = useState(null);

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

  // Get ALL predictions with ≥3% confidence for selection
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
        // STRICT FILTER: Only >= CONFIDENCE_THRESHOLD (0.03)
        if (conf >= CONFIDENCE_THRESHOLD) {
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

    // 2. Add Local Models (Filtered by 3% threshold)
    addIfValid(data.detections, 'Detector (YOLOv8)', 'detector');
    addIfValid(data.food101_predictions, 'Food101 Classifier', 'food101');
    addIfValid(data.filipino_predictions, 'Filipino Classifier', 'filipino');
    addIfValid(data.ingredient_predictions, 'Ingredient Detector', 'ingredient');

    // 3. Fill with Gemini Alternatives
    if (geminiPredictions.length > 1) {
      for (let i = 1; i < geminiPredictions.length; i++) {
        const pred = geminiPredictions[i];

        // Ensure confidence is a number
        const conf = typeof pred.confidence === 'number' ? pred.confidence : 0;

        // ✅ STRICT CHECK: Skip if below threshold
        if (conf < CONFIDENCE_THRESHOLD) continue;

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

  const handleAddToInventory = async () => {
    if (!selectedFood) {
      Alert.alert('No Selection', 'Please select a food item first');
      return;
    }

    setLoading(true); // Show loading indicator

    try {
      const { data: { user }, error: userError } = await safeGetUser();
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

      // Prepare image for AI analysis (convert to base64)
      let imageBase64 = null;
      try {
        const manipResult = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: 500 } }], // Resize to reduce payload size
          { base64: true, compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        );
        imageBase64 = manipResult.base64;
      } catch (imgError) {
        console.warn('⚠️ Failed to process image for AI analysis:', imgError);
        // Continue without image if processing fails
      }

      // AI Prediction for Category and Shelf Life (with visual context)
      const prediction = await SousChefAIService.predictItemDetails(selectedFood.label, imageBase64);
      const category = prediction.category;

      // Calculate expiry date based on AI prediction
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + prediction.shelfLifeDays);

      const formattedExpiry = expiryDate.toLocaleDateString('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: 'numeric'
      }).replace(/\//g, '/');

      // Smart unit suggestion based on category
      const suggestUnit = (cat) => {
        switch (cat) {
          case 'Rice':
          case 'Soup':
          case 'Leftovers':
          case 'Beverages':
          case 'Condiments':
          case 'Sauces':
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
          case 'Canned':
            return 'can';
          case 'Jarred':
            return 'jar';
          case 'Snacks':
          case 'Frozen':
            return 'pack';
          default:
            return 'pieces';
        }
      };

      setPrefilledItemData({
        itemName: selectedFood.label,
        itemCategory: category,
        quantity: '1',
        unit: suggestUnit(category),
        itemExpiration: formattedExpiry,
        itemDescription: `Detected by ${selectedFood.source}`,
        imageURL: uri,
        inventoryID: inventoryList[0].inventoryID,
        isAI: true, // Flag for UI
        aiReasoning: prediction.reasoning, // Pass reasoning to modal
      });

      setLoading(false); // Stop loading
      // Open the item form modal
      setItemFormVisible(true);

    } catch (error) {
      setLoading(false); // Stop loading on error
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
      const { data: { user }, error: userError } = await safeGetUser();
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

      // Check for duplicate items in the same inventory
      const { data: existingItems, error: itemsError } = await supabase
        .from('tbl_items')
        .select('*')
        .eq('inventoryID', itemData.inventoryID);

      if (!itemsError && existingItems) {
        const normalizedNewName = itemData.itemName.trim().toLowerCase();
        const duplicateItem = existingItems.find(
          item => item.itemName.trim().toLowerCase() === normalizedNewName
        );

        if (duplicateItem) {
          // Check if merge is possible (same unit)
          const canMerge =
            duplicateItem.unit?.trim().toLowerCase() === itemData.unit?.trim().toLowerCase() &&
            !isNaN(Number(duplicateItem.quantity)) &&
            !isNaN(Number(itemData.quantity));

          return new Promise((resolve) => {
            setDuplicateAlert({
              visible: true,
              itemData,
              duplicateItem,
              canMerge,
              numericUserID,
              resolve
            });
          });
        }
      }

      // No duplicate found - create the item
      const createdItem = await PantryService.createItem({
        ...itemData,
        userID: numericUserID,
      });

      // Check for matching groups
      await checkAndAddToMatchingGroup(createdItem, itemData.inventoryID);

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

  // Check for groups with matching category and add item
  const checkAndAddToMatchingGroup = async (item, inventoryID) => {
    if (!item.itemCategory) return;

    try {
      // Get all groups for this inventory with matching category
      const { data: groups, error: groupsError } = await supabase
        .from('tbl_groups')
        .select('*')
        .eq('inventoryID', inventoryID)
        .eq('groupCategory', item.itemCategory);

      if (groupsError || !groups || groups.length === 0) return;

      // If there's exactly one matching group, add automatically with PantryAlert
      if (groups.length === 1) {
        const group = groups[0];
        setGroupSelectionAlert({
          visible: true,
          message: `"${item.itemName}" will be added to your ${group.groupTitle} group.`,
          groups: [group],
          onSelectGroup: async () => {
            try {
              await PantryService.addItemToGroup(item.itemID, group.groupID);
              console.log(`✅ Added item to group "${group.groupTitle}"`);
            } catch (error) {
              if (!error.message?.includes('already in this group')) {
                console.error('Error adding to group:', error);
              }
            }
            setGroupSelectionAlert({ visible: false, message: '', groups: [], onSelectGroup: null, singleGroupMode: false });
          },
          singleGroupMode: true
        });
      } else if (groups.length > 1) {
        // Multiple matching groups - show selection with PantryAlert
        setGroupSelectionAlert({
          visible: true,
          message: `You have ${groups.length} groups for ${item.itemCategory} items.\n\nChoose one to add "${item.itemName}" to:`,
          groups: groups.slice(0, 3),
          onSelectGroup: async (selectedGroup) => {
            try {
              await PantryService.addItemToGroup(item.itemID, selectedGroup.groupID);
              console.log(`✅ Added item to group "${selectedGroup.groupTitle}"`);
            } catch (error) {
              if (!error.message?.includes('already in this group')) {
                console.error('Error adding to group:', error);
              }
            }
            setGroupSelectionAlert({ visible: false, message: '', groups: [], onSelectGroup: null, singleGroupMode: false });
          },
          singleGroupMode: false
        });
      }
    } catch (error) {
      console.error('Error checking for matching groups:', error);
    }
  };

  // Handle duplicate alert actions
  const handleDuplicateMerge = async () => {
    const { duplicateItem, itemData, numericUserID, resolve } = duplicateAlert;
    try {
      const mergedQty = Number(duplicateItem.quantity) + Number(itemData.quantity);
      await PantryService.updateItem(duplicateItem.itemID, {
        quantity: mergedQty,
        userID: numericUserID,
      });

      // Check for matching groups
      await checkAndAddToMatchingGroup(duplicateItem, itemData.inventoryID);

      setItemFormVisible(false);
      setPrefilledItemData(null);
      setAddedItemName(duplicateItem.itemName);
      setSuccessModalVisible(true);
      setDuplicateAlert({ visible: false, itemData: null, duplicateItem: null, canMerge: false, numericUserID: null, resolve: null });
      if (resolve) resolve({ status: 'duplicate-merged', item: duplicateItem });
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to merge items');
      if (resolve) resolve({ status: 'error', error });
    }
  };

  const handleDuplicateCreate = async () => {
    const { itemData, numericUserID, resolve } = duplicateAlert;
    try {
      const createdItem = await PantryService.createItem({
        ...itemData,
        userID: numericUserID,
      });

      // Check for matching groups
      await checkAndAddToMatchingGroup(createdItem, itemData.inventoryID);

      setItemFormVisible(false);
      setPrefilledItemData(null);
      setAddedItemName(createdItem.itemName);
      setSuccessModalVisible(true);
      setDuplicateAlert({ visible: false, itemData: null, duplicateItem: null, canMerge: false, numericUserID: null, resolve: null });
      if (resolve) resolve({ status: 'created', item: createdItem });
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to save item');
      if (resolve) resolve({ status: 'error', error });
    }
  };

  const handleDuplicateCancel = () => {
    const { resolve } = duplicateAlert;
    setDuplicateAlert({ visible: false, itemData: null, duplicateItem: null, canMerge: false, numericUserID: null, resolve: null });
    if (resolve) resolve({ status: 'duplicate-cancelled' });
  };

  const handleManualEntry = async () => {
    try {
      const { data: { user }, error: userError } = await safeGetUser();
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

      // Calculate expiry date (7 days from now as default)
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 7);
      const formattedExpiry = `${expiryDate.getMonth() + 1}/${expiryDate.getDate()}/${expiryDate.getFullYear()}`;

      // Open item form modal with minimal prefilled data for manual entry
      setPrefilledItemData({
        itemName: '',
        itemCategory: 'Other',
        quantity: '1',
        unit: 'pieces',
        itemExpiration: formattedExpiry,
        itemDescription: 'Added manually from food recognition',
        imageURL: uri,
        inventoryID: inventoryList[0].inventoryID,
      });

      setItemFormVisible(true);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to prepare item form');
    }
  };

  const handleSearchRecipes = async () => {
    if (!selectedFood) return;

    setLoading(true);

    try {
      // 1. Deconstruct the dish
      const deconstructionResult = await SousChefAIService.deconstructDish(selectedFood.label);

      if (deconstructionResult.is_dish || (deconstructionResult.suggested_recipes && deconstructionResult.suggested_recipes.length > 0)) {

        // 2. Search for recipes using the ingredients (Individually to maximize results)
        let realRecipes = [];
        if (deconstructionResult.ingredients && deconstructionResult.ingredients.length > 0) {
          try {
            console.log(`🔍 Searching for recipes individually for: ${deconstructionResult.ingredients.join(', ')}`);

            // Search for each ingredient individually in parallel
            const searchPromises = deconstructionResult.ingredients.map(async (ingredient) => {
              try {
                const result = await EdamamService.searchRecipes(ingredient, { to: 2 }); // Get top 2 for each
                return result.success && result.data ? result.data.recipes : [];
              } catch (e) {
                console.warn(`Failed to search for ${ingredient}:`, e);
                return [];
              }
            });

            const results = await Promise.all(searchPromises);

            // Flatten and deduplicate results
            const allFoundRecipes = results.flat();
            const seenUris = new Set();

            realRecipes = allFoundRecipes.filter(recipe => {
              if (!recipe || !recipe.uri) return false;
              if (seenUris.has(recipe.uri)) return false;
              seenUris.add(recipe.uri);
              return true;
            }).slice(0, 10); // Limit total to 10 recipes

            console.log(`✅ Found ${realRecipes.length} total recipes from individual ingredient searches`);

          } catch (searchError) {
            console.error("Error searching for recipes:", searchError);
          }
        }

        setLoading(false);

        setDeconstructionData({
          ...deconstructionResult,
          originalDish: selectedFood.label,
          realRecipes: realRecipes // Pass the actual recipes found
        });
        setDeconstructionModalVisible(true);
        return;
      }

      setLoading(false);
      router.push({
        pathname: '/(tabs)/recipe-search',
        params: {
          searchQuery: selectedFood.label,
          autoSearch: 'true'
        }
      });
    } catch (error) {
      console.error("Error in handleSearchRecipes:", error);
      setLoading(false);
      router.push({
        pathname: '/(tabs)/recipe-search',
        params: {
          searchQuery: selectedFood.label,
          autoSearch: 'true'
        }
      });
    }
  };

  const handleDeconstructionSearch = (query) => {
    setDeconstructionModalVisible(false);
    router.push({
      pathname: '/(tabs)/recipe-search',
      params: {
        searchQuery: query,
        autoSearch: 'true',
        isDeconstructed: 'true',
        originalDish: selectedFood.label
      }
    });
  };

  // New function to handle AI recipe generation
  const handleGenerateRecipe = (recipeName) => {
    setDeconstructionModalVisible(false);
    router.push({
      pathname: '/(tabs)/recipe-search',
      params: {
        searchQuery: recipeName,
        autoSearch: 'true',
        mode: 'generate'
      }
    });
  };

  // New function to handle recipe selection
  const handleRecipeSelect = (recipe) => {
    setDeconstructionModalVisible(false);
    router.push({
      pathname: '/recipe-detail',
      params: {
        recipeData: JSON.stringify(recipe)
      }
    });
  };

  // If not loading and no result, show error (but keep overlay if loading)
  if (!loading && (!result || !result.success)) {
    return (
      <View style={styles.container}>
        <LoadingOverlay visible={loading} />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#FF6B6B" />
          <Text style={styles.errorTitle}>Recognition Failed</Text>
          <Text style={styles.errorText}>
            {result?.error || 'Could not recognize food in the image'}
          </Text>
          <TouchableOpacity
            style={styles.manualEntryButton}
            onPress={handleManualEntry}
          >
            <Ionicons name="create-outline" size={20} color="#FFF" />
            <Text style={styles.manualEntryButtonText}>Add Manually</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => router.back()}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <AuthGuard>
      <View style={styles.container}>
        <LoadingOverlay visible={loading} />
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
                  {selectedFood?.isUnknown
                    ? "This image appears to be not food intended for human consumption; manual entry and detailed model results are disabled for this image."
                    : "Try taking a clearer photo or add the item manually."}
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
              {!selectedFood?.isUnknown && (
                <>
                  <TouchableOpacity
                    style={styles.manualButton}
                    onPress={handleManualEntry}
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
                </>
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

        {/* Deconstruction Modal */}
        <DeconstructionModal
          visible={deconstructionModalVisible}
          onClose={() => setDeconstructionModalVisible(false)}
          data={deconstructionData}
          onSearchRecipe={handleDeconstructionSearch}
          onRecipeSelect={handleRecipeSelect} // Pass the new handler
          onGenerateRecipe={handleGenerateRecipe} // Pass the new handler
        />

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

        {/* Group Selection Alert */}
        <PantryAlert
          visible={groupSelectionAlert.visible}
          type="info"
          title={groupSelectionAlert.singleGroupMode ? "Add to Group" : "Select Group"}
          message={groupSelectionAlert.message}
          onClose={() => setGroupSelectionAlert({ visible: false, message: '', groups: [], onSelectGroup: null, singleGroupMode: false })}
          cancelLabel={groupSelectionAlert.singleGroupMode ? "Cancel" : "Skip"}
          customIcon={
            <Ionicons name="albums-outline" size={wp('15%')} color="#81A969" />
          }
        >
          {groupSelectionAlert.groups.map((group, index) => (
            <TouchableOpacity
              key={group.groupID}
              style={groupSelectionAlertStyles.groupButton}
              onPress={() => {
                if (groupSelectionAlert.onSelectGroup) {
                  groupSelectionAlert.onSelectGroup(groupSelectionAlert.singleGroupMode ? undefined : group);
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={groupSelectionAlertStyles.groupButtonText}>
                {groupSelectionAlert.singleGroupMode
                  ? `Add to ${group.groupTitle}`
                  : `${group.groupTitle} (${group.itemCount || 0} ${(group.itemCount || 0) === 1 ? 'item' : 'items'})`}
              </Text>
            </TouchableOpacity>
          ))}
        </PantryAlert>

        {/* Duplicate Alert */}
        <PantryAlert
          visible={duplicateAlert.visible}
          type="info"
          title="Duplicate Item"
          message={
            duplicateAlert.itemData
              ? `"${duplicateAlert.itemData.itemName}" already exists in your pantry. How would you like to proceed?`
              : ''
          }
          onClose={handleDuplicateCancel}
          cancelLabel="Return"
          customIcon={
            <Ionicons name="alert-circle-outline" size={wp('15%')} color="#FF9800" />
          }
        >
          <TouchableOpacity
            style={duplicateAlertStyles.addToExistingButton}
            onPress={handleDuplicateMerge}
            activeOpacity={0.7}
          >
            <Ionicons name="layers-outline" size={wp('5%')} color="#fff" />
            <Text style={duplicateAlertStyles.addToExistingButtonText}>Add to Existing</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={duplicateAlertStyles.addAnywayButton}
            onPress={handleDuplicateCreate}
            activeOpacity={0.7}
          >
            <Ionicons name="add-circle-outline" size={wp('5%')} color="#81A969" />
            <Text style={duplicateAlertStyles.addAnywayButtonText}>Add Anyway</Text>
          </TouchableOpacity>
        </PantryAlert>

        {/* Success Modal */}
        <PantryAlert
          visible={successModalVisible}
          type="success"
          title="Success!"
          message={`"${addedItemName}" has been successfully added to your pantry.`}
          onClose={() => setSuccessModalVisible(false)}
          cancelLabel="Return"
          customIcon={
            <Ionicons name="checkmark-circle" size={wp('15%')} color="#81A969" />
          }
        />
      </View>
    </AuthGuard>
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

const groupSelectionAlertStyles = StyleSheet.create({
  groupButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#81A969',
    paddingVertical: hp('1.6%'),
    borderRadius: wp('2.5%'),
    marginBottom: hp('1%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  groupButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: wp('4%'),
    letterSpacing: 0.3,
  },
});

const duplicateAlertStyles = StyleSheet.create({
  addToExistingButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#81A969',
    paddingVertical: hp('1.6%'),
    borderRadius: wp('2.5%'),
    marginBottom: hp('1%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addToExistingButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: wp('4%'),
    letterSpacing: 0.3,
    marginLeft: wp('2%'),
  },
  addAnywayButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#81A969',
    paddingVertical: hp('1.6%'),
    borderRadius: wp('2.5%'),
    marginBottom: hp('1%'),
  },
  addAnywayButtonText: {
    color: '#81A969',
    fontWeight: '700',
    fontSize: wp('4%'),
    letterSpacing: 0.3,
    marginLeft: wp('2%'),
  },
});