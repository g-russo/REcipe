import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';

/**
 * Ingredient Selector Component
 * Shows which ingredient the user wants to replace
 * Design: 2-column grid with selectable ingredient cards
 */
const IngredientSelector = ({ ingredients, selectedIngredient, onSelectIngredient }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Which ingredient do you want to replace?</Text>
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.grid}>
        {ingredients.map((ingredient, index) => {
          const ingredientText = ingredient.text || ingredient;
          const isSelected = selectedIngredient === ingredientText;

          return (
            <TouchableOpacity
              key={index}
              style={[styles.card, isSelected && styles.cardSelected]}
              onPress={() => onSelectIngredient(ingredientText)}
              activeOpacity={0.7}
            >
              <Text style={[styles.cardText, isSelected && styles.cardTextSelected]}>
                {ingredientText}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
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
    paddingBottom: 100, // Space for buttons
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
    minHeight: 60,
    justifyContent: 'center',
  },
  cardSelected: {
    backgroundColor: '#E8F5E9',
    borderColor: '#6B9B6E',
  },
  cardText: {
    fontSize: 16,
    color: '#1A1A1A',
    textAlign: 'center',
    fontWeight: '500',
  },
  cardTextSelected: {
    color: '#2E7D32',
    fontWeight: '600',
  },
});

export default IngredientSelector;
