import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Substitute Selector Component
 * Shows suggested substitutes for the selected ingredient
 * Design: 2-column grid with selectable substitute cards
 * Features: Editable quantities and automatic unit conversion
 */
const SubstituteSelector = ({ 
  originalIngredient,
  originalQuantity,
  originalUnit,
  substitutes, 
  selectedSubstitute, 
  onSelectSubstitute,
  pantryScanned = true 
}) => {
  const [editingQuantity, setEditingQuantity] = useState(null);
  const [customQuantities, setCustomQuantities] = useState({});

  // Unit conversion mappings
  const convertUnit = (value, fromUnit, toUnit) => {
    // Normalize units
    const from = fromUnit?.toLowerCase().trim() || '';
    const to = toUnit?.toLowerCase().trim() || '';

    if (from === to) return value;

    // Weight conversions
    const weightConversions = {
      'g': { 'kg': 0.001, 'oz': 0.035274, 'lb': 0.00220462, 'g': 1 },
      'kg': { 'g': 1000, 'oz': 35.274, 'lb': 2.20462, 'kg': 1 },
      'oz': { 'g': 28.3495, 'kg': 0.0283495, 'lb': 0.0625, 'oz': 1 },
      'lb': { 'g': 453.592, 'kg': 0.453592, 'oz': 16, 'lb': 1 },
    };

    // Volume conversions
    const volumeConversions = {
      'ml': { 'l': 0.001, 'cup': 0.00422675, 'tbsp': 0.067628, 'tsp': 0.202884, 'fl oz': 0.033814, 'ml': 1 },
      'l': { 'ml': 1000, 'cup': 4.22675, 'tbsp': 67.628, 'tsp': 202.884, 'fl oz': 33.814, 'l': 1 },
      'cup': { 'ml': 236.588, 'l': 0.236588, 'tbsp': 16, 'tsp': 48, 'fl oz': 8, 'cup': 1 },
      'tbsp': { 'ml': 14.7868, 'l': 0.0147868, 'cup': 0.0625, 'tsp': 3, 'fl oz': 0.5, 'tbsp': 1 },
      'tsp': { 'ml': 4.92892, 'l': 0.00492892, 'cup': 0.0208333, 'tbsp': 0.333333, 'fl oz': 0.166667, 'tsp': 1 },
      'fl oz': { 'ml': 29.5735, 'l': 0.0295735, 'cup': 0.125, 'tbsp': 2, 'tsp': 6, 'fl oz': 1 },
    };

    // Try weight conversion
    if (weightConversions[from]?.[to]) {
      return parseFloat((value * weightConversions[from][to]).toFixed(2));
    }

    // Try volume conversion
    if (volumeConversions[from]?.[to]) {
      return parseFloat((value * volumeConversions[from][to]).toFixed(2));
    }

    // No conversion available, return original value
    return value;
  };

  const getConvertedSubstitute = (substitute) => {
    if (!originalUnit || !substitute.unit) {
      // No conversion needed, return with original values
      return {
        ...substitute,
        convertedQuantity: substitute.quantity || 1,
        convertedUnit: substitute.unit || '',
        originalQuantityInPantry: substitute.quantity,
        originalUnitInPantry: substitute.unit
      };
    }

    const convertedQuantity = convertUnit(
      substitute.quantity || 1,
      substitute.unit,
      originalUnit
    );

    return {
      ...substitute,
      convertedQuantity: convertedQuantity,
      convertedUnit: originalUnit,
      originalQuantityInPantry: substitute.quantity,
      originalUnitInPantry: substitute.unit
    };
  };

  const handleQuantityChange = (substitute, newQuantity) => {
    const quantity = parseFloat(newQuantity) || 0;
    
    // Convert the user's input back to pantry units to check if we have enough
    const converted = getConvertedSubstitute(substitute);
    const quantityInPantryUnits = convertUnit(quantity, originalUnit, substitute.unit);
    
    // Check if user has enough in pantry (compare in pantry units)
    if (quantityInPantryUnits > substitute.quantity) {
      Alert.alert(
        'Not Enough in Pantry',
        `You only have ${substitute.quantity} ${substitute.unit || ''} of ${substitute.name} in your pantry.`,
        [{ text: 'OK' }]
      );
      return;
    }

    setCustomQuantities({
      ...customQuantities,
      [substitute.name]: quantity
    });
  };

  const handleSelectSubstitute = (substitute) => {
    const converted = getConvertedSubstitute(substitute);
    const customQty = customQuantities[substitute.name];
    
    // Use custom quantity if user edited it, otherwise use the recipe's required quantity
    // NOT the full pantry amount (converted.convertedQuantity)
    const finalSubstitute = {
      ...converted,
      quantity: customQty !== undefined ? customQty : originalQuantity,
      unit: converted.convertedUnit
    };

    onSelectSubstitute(finalSubstitute);
  };
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Replace {originalIngredient} with...</Text>
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.grid}>
        {substitutes.map((substitute, index) => {
          const isSelected = selectedSubstitute?.name === substitute.name;
          const converted = getConvertedSubstitute(substitute);
          const isEditing = editingQuantity === substitute.name;
          const displayQuantity = customQuantities[substitute.name] !== undefined 
            ? customQuantities[substitute.name] 
            : converted.convertedQuantity;

          return (
            <TouchableOpacity
              key={index}
              style={[styles.card, isSelected && styles.cardSelected]}
              onPress={() => handleSelectSubstitute(substitute)}
              activeOpacity={0.7}
            >
              {/* Selected Checkmark */}
              {isSelected && (
                <View style={styles.checkmarkContainer}>
                  <Ionicons name="checkmark-circle" size={20} color="#2E7D32" />
                </View>
              )}

              {/* Substitute Name */}
              <Text style={[styles.cardText, isSelected && styles.cardTextSelected]} numberOfLines={2}>
                {substitute.name}
              </Text>

              {/* Quantity Display/Editor */}
              <View style={styles.quantityContainer}>
                {isEditing ? (
                  <View style={styles.quantityInputContainer}>
                    <TextInput
                      style={styles.quantityInput}
                      keyboardType="numeric"
                      value={customQuantities[substitute.name]?.toString() || converted.convertedQuantity.toString()}
                      onChangeText={(text) => handleQuantityChange(substitute, text)}
                      onBlur={() => setEditingQuantity(null)}
                      autoFocus
                      selectTextOnFocus
                    />
                    {converted.convertedUnit && (
                      <Text style={styles.unitText}>{converted.convertedUnit}</Text>
                    )}
                  </View>
                ) : (
                  <TouchableOpacity 
                    style={styles.quantityDisplay}
                    onPress={(e) => {
                      e.stopPropagation();
                      setEditingQuantity(substitute.name);
                    }}
                  >
                    <Text style={styles.quantityDisplayText}>
                      {displayQuantity} {converted.convertedUnit || ''}
                    </Text>
                    <Ionicons name="pencil" size={12} color="#2E7D32" style={styles.editIcon} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Pantry Info */}
              <Text style={styles.pantryInfo} numberOfLines={1}>
                In pantry: {substitute.quantity} {substitute.unit || ''}
              </Text>

              {/* Conversion Notice */}
              {substitute.unit !== converted.convertedUnit && (
                <View style={styles.conversionNotice}>
                  <Ionicons name="swap-horizontal" size={10} color="#6b7280" />
                  <Text style={styles.conversionText}>Converted</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {pantryScanned && (
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Your pantry was scanned by SousChef AI
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 24,
    marginHorizontal: 20,
  },
  scrollView: {
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 100, // Space for buttons and footer
  },
  card: {
    width: '47%',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 12,
    marginHorizontal: '1.5%',
    borderWidth: 2,
    borderColor: 'transparent',
    minHeight: 100,
    justifyContent: 'center',
    position: 'relative',
  },
  cardSelected: {
    backgroundColor: '#E8F5E9',
    borderColor: '#6B9B6E',
  },
  checkmarkContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  cardText: {
    fontSize: 16,
    color: '#1A1A1A',
    textAlign: 'center',
    fontWeight: '500',
    marginBottom: 8,
  },
  cardTextSelected: {
    color: '#2E7D32',
    fontWeight: '600',
  },
  quantityContainer: {
    marginVertical: 6,
    alignItems: 'center',
  },
  quantityInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#2E7D32',
  },
  quantityInput: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    minWidth: 40,
    textAlign: 'center',
    padding: 0,
  },
  unitText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  quantityDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  quantityDisplayText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginRight: 4,
  },
  editIcon: {
    marginLeft: 2,
  },
  pantryInfo: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  conversionNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
    backgroundColor: '#F0F0F0',
    borderRadius: 4,
    alignSelf: 'center',
  },
  conversionText: {
    fontSize: 10,
    color: '#6b7280',
    marginLeft: 3,
    fontWeight: '500',
  },
  footer: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    paddingVertical: 12,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#8B7355',
    fontStyle: 'italic',
  },
});

export default SubstituteSelector;
