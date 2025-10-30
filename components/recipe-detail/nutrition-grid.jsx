import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function NutritionGrid({ nutrition }) {
  if (!nutrition || !nutrition.nutrients) {
    return null;
  }

  // Ensure all values are properly rounded
  const calories = Math.round(nutrition.calories || 0);
  const carbs = Math.round(nutrition.nutrients.carbs?.amount || 0);
  const protein = Math.round(nutrition.nutrients.protein?.amount || 0);
  const fat = Math.round(nutrition.nutrients.fat?.amount || 0);

  return (
    <>
      <View style={styles.nutritionGrid}>
        <View style={styles.nutritionItem}>
          <View style={[styles.nutritionIcon, { backgroundColor: '#e8f5e8' }]}>
            <Ionicons name="leaf-outline" size={20} color="#4CAF50" />
          </View>
          <Text style={styles.nutritionValue}>
            {carbs}g carbs
          </Text>
        </View>
        
        <View style={styles.nutritionItem}>
          <View style={[styles.nutritionIcon, { backgroundColor: '#e3f2fd' }]}>
            <Ionicons name="fitness-outline" size={20} color="#2196F3" />
          </View>
          <Text style={styles.nutritionValue}>
            {protein}g protein
          </Text>
        </View>
        
        <View style={styles.nutritionItem}>
          <View style={[styles.nutritionIcon, { backgroundColor: '#fff3e0' }]}>
            <Ionicons name="flame-outline" size={20} color="#FF9800" />
          </View>
          <Text style={styles.nutritionValue}>
            {calories} kcal
          </Text>
        </View>
        
        <View style={styles.nutritionItem}>
          <View style={[styles.nutritionIcon, { backgroundColor: '#f3e5f5' }]}>
            <Ionicons name="water-outline" size={20} color="#9C27B0" />
          </View>
          <Text style={styles.nutritionValue}>
            {fat}g fat
          </Text>
        </View>
      </View>

      {/* AI Nutrition Disclaimer */}
      {nutrition.isAIEstimate && (
        <View style={styles.aiDisclaimer}>
          <Ionicons name="information-circle-outline" size={14} color="#666" />
          <Text style={styles.aiDisclaimerText}>
            Nutritional values are AI estimates based on USDA standard ingredient values
          </Text>
        </View>
      )}

      {/* Per Serving Note */}
      <View style={styles.servingNote}>
        <Text style={styles.servingNoteText}>
          * Values shown are per serving
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 25,
  },
  nutritionItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  nutritionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  nutritionValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  aiDisclaimer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: '#9C27B0',
  },
  aiDisclaimerText: {
    fontSize: 11,
    color: '#666',
    fontStyle: 'italic',
    marginLeft: 6,
    flex: 1,
  },
  servingNote: {
    alignItems: 'center',
    marginTop: -10,
    marginBottom: 15,
  },
  servingNoteText: {
    fontSize: 10,
    color: '#999',
    fontStyle: 'italic',
  },
});
