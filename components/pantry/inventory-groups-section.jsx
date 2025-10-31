import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Inventory Groups Section Component
 * Displays horizontal scrollable list of inventory groups
 */
const InventoryGroupsSection = ({ 
  inventories, 
  onGroupPress, 
  onCreateGroup 
}) => {
  if (inventories.length === 0) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Groups</Text>
        <View style={styles.emptyStateContainer}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="folder-outline" size={70} color="#ccc" />
          </View>
          <Text style={styles.emptyTitle}>No groups created yet</Text>
          <Text style={styles.emptySubtitle}>Create groups to organize your pantry items</Text>
          <TouchableOpacity 
            style={styles.addItemButton}
            onPress={onCreateGroup}
          >
            <Text style={styles.addItemButtonText}>Create Group</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Groups</Text>
      
      <ScrollView 
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesScrollView}
      >
        {inventories.map((inventory) => (
          <TouchableOpacity 
            key={inventory.inventoryID} 
            style={[styles.categoryCard, { backgroundColor: inventory.inventoryColor || '#8BC34A' }]}
            onPress={() => onGroupPress(inventory)}
          >
            <View style={styles.categoryLetterContainer}>
              <Text style={styles.categoryLetter}>
                {inventory.inventoryName?.charAt(0).toUpperCase() || 'P'}
              </Text>
            </View>
            <View style={styles.categoryDetails}>
              <View style={styles.categoryHeaderRow}>
                <Text style={styles.categoryName}>
                  {inventory.inventoryName || `Inventory #${inventory.inventoryID}`}
                </Text>
                <View style={styles.arrowContainer}>
                  <Ionicons name="chevron-forward" size={18} color="#fff" />
                </View>
              </View>
              <Text style={styles.itemCount}>{inventory.itemCount || 0} items</Text>
              
              {inventory.inventoryTags && inventory.inventoryTags.length > 0 && (
                <View style={styles.tagsContainer}>
                  {inventory.inventoryTags.map((tag, index) => (
                    <View key={index} style={styles.tagPill}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              )}
              
              {inventory.isFull && (
                <View style={styles.fullBadge}>
                  <Text style={styles.fullBadgeText}>Full</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}
        
        {/* Add New Group Card */}
        <TouchableOpacity 
          style={[styles.categoryCard, styles.emptyCard, styles.addNewCard]} 
          onPress={onCreateGroup}
        >
          <View style={styles.addNewContent}>
            <View style={styles.addIconContainer}>
              <Ionicons name="add-circle-outline" size={40} color="#777" />
            </View>
            <Text style={styles.addNewText}>Add New Group</Text>
            <Text style={styles.addNewSubtext}>Organize your ingredients</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  categoriesScrollView: {
    paddingLeft: 20,
  },
  categoryCard: {
    width: 200,
    marginRight: 15,
    borderRadius: 12,
    padding: 15,
    minHeight: 120,
  },
  categoryLetterContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryLetter: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  categoryDetails: {
    flex: 1,
  },
  categoryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  arrowContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemCount: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 5,
  },
  tagPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  tagText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
  },
  fullBadge: {
    backgroundColor: '#ff4d4d',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 5,
  },
  fullBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: '#f9f9f9',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
  },
  addNewCard: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  addNewContent: {
    alignItems: 'center',
  },
  addIconContainer: {
    marginBottom: 10,
  },
  addNewText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555',
    marginBottom: 5,
  },
  addNewSubtext: {
    fontSize: 12,
    color: '#999',
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

export default InventoryGroupsSection;
