import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function IngredientsTab({ 
  ingredients, 
  onSubstitutePress,
  hasSubstitutions = false 
}) {
  return (
    <View>
      <View style={styles.ingredientsHeader}>
        <Text style={styles.sectionTitle}>Ingredients</Text>
        <TouchableOpacity onPress={onSubstitutePress}>
          <Text style={styles.substituteText}>
            {hasSubstitutions ? '✓ Substituted' : 'Substitute'}
          </Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.itemCount}>{ingredients?.length || 0} Items</Text>
      
      <View style={styles.ingredientsGrid}>
        {ingredients?.map((ingredient, index) => {
          const ingredientText = typeof ingredient === 'string' 
            ? ingredient 
            : ingredient.text || ingredient;
          const isSubstituted = ingredient?.isSubstituted;
          const originalText = ingredient?.originalText;

          return (
            <View key={index} style={styles.ingredientRow}>
              <View style={styles.ingredientContent}>
                <Text style={[
                  styles.ingredientText,
                  isSubstituted && styles.substitutedText
                ]}>
                  {ingredientText}
                </Text>
                {isSubstituted && originalText && (
                  <Text style={styles.substitutionNote}>
                    (Replaces {originalText})
                  </Text>
                )}
              </View>
            </View>
          );
        })}
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
  ingredientContent: {
    flex: 1,
  },
  ingredientText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  substitutedText: {
    color: '#6FA36D',
    fontWeight: '500',
  },
  substitutionNote: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
    fontStyle: 'italic',
  },
});
