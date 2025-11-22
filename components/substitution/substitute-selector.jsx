import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
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

  // Simple substitute selection - just pass the ingredient name

  const handleSelectSubstitute = (substitute) => {
    // Simple name-only substitution - preserve original quantity/unit from recipe
    onSelectSubstitute({
      name: substitute.name,
      pantryItemId: substitute.pantryItemId,
      pantryItemName: substitute.name,
      reason: substitute.reason,
      confidence: substitute.confidence,
      // Preserve original recipe quantity/unit
      quantity: originalQuantity,
      unit: originalUnit
    });
  };
  return (
    <View style={styles.container}>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Replace {originalIngredient} with...</Text>
        {/* <View style={styles.quantityPreviewNotice}>
          <Ionicons name="information-circle-outline" size={16} color="#6B9B6E" />
          <Text style={styles.quantityPreviewText}>
            Recipe will show: {originalQuantity} {originalUnit} [substitute name]
          </Text>
        </View> */}
      </View>
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.grid}>
        {substitutes.map((substitute, index) => {
          const isSelected = selectedSubstitute?.name === substitute.name;

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

              {/* Result Preview
              <View style={styles.previewContainer}>
                <Text style={styles.previewText}>
                  {originalQuantity} {originalUnit} {substitute.name}
                </Text>
              </View> */}

              {/* Pantry Info
              <Text style={styles.pantryInfo} numberOfLines={1}>
                Available: {substitute.quantity} {substitute.unit || ''}
              </Text> */}

              {/* AI reasoning (if available) */}
              {substitute.reason && (
                <View style={styles.aiReasoningBadge}>
                  <Ionicons name="bulb" size={10} color="#8A2BE2" />
                  <Text style={styles.aiReasoningText} numberOfLines={2}>
                    {substitute.reason}
                  </Text>
                </View>
              )}

              {/* Confidence score (if AI-powered) */}
              {substitute.confidence && (
                <View style={styles.confidenceBadge}>
                  <Text style={styles.confidenceText}>
                    {Math.round(substitute.confidence * 100)}% match
                  </Text>
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
  titleContainer: {
    marginTop: 24,
    marginBottom: 16,
    marginHorizontal: 20,
  },
  quantityPreviewNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5E9',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#A5D6A7',
  },
  quantityPreviewText: {
    fontSize: 12,
    color: '#2E7D32',
    marginLeft: 8,
    flex: 1,
    fontWeight: '500',
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
  previewContainer: {
    marginVertical: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#F0F7F1',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  previewLabel: {
    fontSize: 9,
    color: '#558B2F',
    fontWeight: '600',
    marginBottom: 2,
    textAlign: 'center',
  },
  previewText: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '600',
    textAlign: 'center',
  },
  pantryInfo: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  aiReasoningBadge: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: '#F3E5F5',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#CE93D8',
  },
  aiReasoningText: {
    fontSize: 9,
    color: '#6A1B9A',
    marginLeft: 4,
    flex: 1,
    lineHeight: 12,
  },
  confidenceBadge: {
    marginTop: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
    backgroundColor: '#E8F5E9',
    borderRadius: 4,
    alignSelf: 'center',
  },
  confidenceText: {
    fontSize: 9,
    color: '#2E7D32',
    fontWeight: '600',
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
