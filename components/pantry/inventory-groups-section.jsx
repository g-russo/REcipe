import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions } from 'react-native';
// MODIFIED: Use a more direct import for MaterialCommunityIcons
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
// We also need Ionicons for the original fallback (just in case)
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';


const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GROUP_CARD_WIDTH = Math.min(SCREEN_WIDTH * 0.5, 200);

// MODIFIED: Updated map with 'soy-sauce'
const categoryIconMap = {
  'Fruits': 'food-apple-outline',
  'Vegetables': 'carrot',
  'Meat & Poultry': 'food-drumstick-outline',
  'Seafood': 'fish',
  'Dairy & Eggs': 'egg-outline',
  'Grains & Pasta': 'pasta',
  'Canned & Jarred': 'canned-food',
  'Condiments & Sauces': 'soy-sauce', // CHANGED
  'Spices & Herbs': 'mortar-pestle',
  'Snacks': 'cookie-outline',
  'Beverages': 'coffee-outline',
  'Frozen': 'snowflake',
  'Baking': 'cake',
  'Other': 'help-circle-outline',
};

/**
 * Inventory Groups Section Component
 * Displays horizontal scrollable list of inventory groups
 */
const InventoryGroupsSection = forwardRef(({
  groups,
  onGroupPress,
  onCreateGroup,
  userName = 'My'
}, ref) => {
  const router = useRouter();
  const scrollViewRef = useRef(null);

  useImperativeHandle(ref, () => ({
    scrollToStart: () => {
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollTo({ x: 0, animated: true });
      }
    }
  }));

  // Helper function to render icon or letter
  const renderGroupIcon = (group) => {
    const iconName = categoryIconMap[group.groupCategory];

    if (iconName) {
      // Render MaterialCommunityIcons
      return (
        <MaterialCommunityIcons
          name={iconName}
          size={28}
          color="#fff"
        />
      );
    }

    // Fallback to the letter
    return (
      <Text style={styles.categoryLetter}>
        {group.groupTitle?.charAt(0).toUpperCase() || 'G'}
      </Text>
    );
  };

  if (groups.length === 0) {
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Groups</Text>
        </View>
        <View style={styles.emptyStateContainer}>
          <View style={styles.emptyIconContainer}>
            {/* Use folder-outline from MaterialCommunityIcons now */}
            <MaterialCommunityIcons name="folder-outline" size={70} color="#ccc" />
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
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Groups</Text>
        <TouchableOpacity
          style={styles.viewAllButton}
          onPress={() => router.push('/all-groups')}
        >
          <Text style={styles.viewAllText}>View All</Text>
          <MaterialCommunityIcons name="chevron-right" size={16} color="#81A969" />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesScrollView}
      >
        {groups.map((group) => (
          <TouchableOpacity
            key={group.groupID}
            style={[styles.categoryCard, { backgroundColor: group.groupColor || '#8BC34A' }]}
            onPress={() => onGroupPress(group)}
          >
            <View style={styles.categoryLetterContainer}>
              {renderGroupIcon(group)}
            </View>

            <View style={styles.categoryDetails}>
              <View style={styles.categoryHeaderRow}>
                <Text style={styles.categoryName}>
                  {group.groupTitle || 'Untitled Group'}
                </Text>
                <View style={styles.arrowContainer}>
                  <MaterialCommunityIcons name="chevron-right" size={18} color="#fff" />
                </View>
              </View>
              <Text style={styles.itemCount}>{group.itemCount || 0} {(group.itemCount || 0) === 1 ? 'item' : 'items'}</Text>

              {group.groupCategory && (
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>
                    <MaterialCommunityIcons name="folder-open-outline" size={10} color="#fff" /> {group.groupCategory}
                  </Text>
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
              <MaterialCommunityIcons name="plus-circle-outline" size={40} color="#777" />
            </View>
            <Text style={styles.addNewText}>Add New Group</Text>
            <Text style={styles.addNewSubtext}>Organize your ingredients</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
});

// ... (Styles are unchanged)
const styles = StyleSheet.create({
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
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
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(129, 169, 105, 0.1)',
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#81A969',
    marginRight: 2,
  },
  categoriesScrollView: {
    paddingLeft: 20,
  },
  categoryCard: {
    width: GROUP_CARD_WIDTH,
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
  categoryBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  categoryBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
});

export default InventoryGroupsSection;