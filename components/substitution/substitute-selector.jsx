import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';

/**
 * Substitute Selector Component
 * Shows suggested substitutes for the selected ingredient
 * Design: 2-column grid with selectable substitute cards
 */
const SubstituteSelector = ({ 
  originalIngredient, 
  substitutes, 
  selectedSubstitute, 
  onSelectSubstitute,
  pantryScanned = true 
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Replace {originalIngredient} with...</Text>
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.grid}>
        {substitutes.map((substitute, index) => {
          const isSelected = selectedSubstitute?.name === substitute.name;

          return (
            <TouchableOpacity
              key={index}
              style={[styles.card, isSelected && styles.cardSelected]}
              onPress={() => onSelectSubstitute(substitute)}
              activeOpacity={0.7}
            >
              <Text style={[styles.cardText, isSelected && styles.cardTextSelected]}>
                {substitute.name}
              </Text>
              {substitute.quantity && (
                <Text style={styles.quantityText}>
                  {substitute.quantity} {substitute.unit || ''}
                </Text>
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
  quantityText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
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
