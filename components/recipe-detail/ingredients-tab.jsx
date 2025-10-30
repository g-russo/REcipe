import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function IngredientsTab({ ingredients }) {
  return (
    <View>
      <View style={styles.ingredientsHeader}>
        <Text style={styles.sectionTitle}>Ingredients</Text>
        <TouchableOpacity>
          <Text style={styles.substituteText}>Substitute</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.itemCount}>{ingredients?.length || 0} Items</Text>
      
      <View style={styles.ingredientsGrid}>
        {ingredients?.map((ingredient, index) => (
          <View key={index} style={styles.ingredientRow}>
            <Text style={styles.ingredientText}>{ingredient}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  ingredientsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  substituteText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
  },
  itemCount: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  ingredientsGrid: {
    gap: 10,
  },
  ingredientRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f0f0f0',
  },
  ingredientText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
});
