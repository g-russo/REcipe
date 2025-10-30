import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function RecipeInfo({ recipe, onViewMore }) {
  return (
    <View>
      <Text style={styles.recipeTitle}>{recipe.label}</Text>
      
      <View style={styles.metaInfo}>
        <View style={styles.metaItem}>
          <Ionicons name="time-outline" size={16} color="#666" />
          <Text style={styles.metaText}>{recipe.totalTime || 30} Min</Text>
        </View>
        <Text style={styles.metaDivider}>•</Text>
        <Text style={styles.metaText}>Serving Size: {recipe.yield}</Text>
      </View>

      <Text style={styles.description}>
        {recipe.recipeDescription || `${recipe.label} is a delicious recipe perfect for any occasion...`}
        {recipe?.url && (
          <Text style={styles.viewMore} onPress={onViewMore}> View More</Text>
        )}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  recipeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  metaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  metaDivider: {
    fontSize: 14,
    color: '#666',
    marginHorizontal: 8,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 20,
  },
  viewMore: {
    color: '#4CAF50',
    fontWeight: '500',
  },
});
