import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PantryItemCard from './pantry-item-card';

/**
 * Pantry Items Grid Section Component
 * Displays grid of pantry items
 */
const PantryItemsGrid = ({ 
  items, 
  onAddItem,
  onItemPress,
  onItemLongPress,
  onItemMenuPress,
  selectionMode = false,
  selectedItems = [],
  highlightedItemId = null,
}) => {
  if (items.length === 0) {
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>My Items</Text>
          <TouchableOpacity 
            style={styles.sectionAddButton}
            onPress={onAddItem}
          >
            <Ionicons name="add-circle" size={28} color="#8BC34A" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.emptyStateContainer}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="cube-outline" size={80} color="#ccc" />
          </View>
          <Text style={styles.emptyTitle}>Your pantry is empty</Text>
          <Text style={styles.emptySubtitle}>Add items to keep track of your ingredients</Text>
          <TouchableOpacity 
            style={styles.addItemButton}
            onPress={onAddItem}
          >
            <Text style={styles.addItemButtonText}>Add Item</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>My Items</Text>
        <TouchableOpacity 
          style={styles.sectionAddButton}
          onPress={onAddItem}
        >
          <Ionicons name="add-circle" size={28} color="#8BC34A" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.itemsGrid}>
        {items.map((item) => (
          <PantryItemCard
            key={item.itemID}
            item={item}
            onPress={() => onItemPress(item)}
            onLongPress={() => onItemLongPress(item)}
            onMenuPress={(e) => onItemMenuPress(e, item)}
            selectionMode={selectionMode}
            isSelected={selectedItems.includes(item.itemID)}
            isHighlighted={highlightedItemId === item.itemID}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  sectionAddButton: {
    padding: 5,
  },
  itemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  emptyStateContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyIconContainer: {
    marginBottom: 15,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 20,
  },
  addItemButton: {
    backgroundColor: '#8BC34A',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  addItemButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PantryItemsGrid;
