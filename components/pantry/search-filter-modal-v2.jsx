import React, { useState, useMemo, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Image,
  Dimensions,
  Animated,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 60) / 2;

/**
 * Search and Filter Modal Component - V2
 * Shows empty state by default, displays results only after filters are applied
 */
const SearchFilterModal = ({
  visible,
  onClose,
  items = [],
  groups = [],
  inventories = [],
  onItemPress,
  onGroupPress,
  userName = 'My',
}) => {
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [selectedInventory, setSelectedInventory] = useState(null);
  const [expiryFilter, setExpiryFilter] = useState(null); // null, 'expiring', 'expired', 'valid'
  
  // UI state
  const [categoriesExpanded, setCategoriesExpanded] = useState(true);
  const [groupsExpanded, setGroupsExpanded] = useState(false);
  
  // Debounce search
  const [debouncedQuery, setDebouncedQuery] = useState('');
  
  // Group items mapping (groupID -> itemIDs[])
  const [groupItemsMap, setGroupItemsMap] = useState({});
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load group items when modal opens
  useEffect(() => {
    const loadGroupItems = async () => {
      if (!visible || groups.length === 0) return;
      
      try {
        const PantryService = require('../../services/pantry-service').default;
        const map = {};
        
        for (const group of groups) {
          const groupItems = await PantryService.getGroupItems(group.groupID);
          map[group.groupID] = groupItems.map(item => item.itemID);
        }
        
        setGroupItemsMap(map);
      } catch (error) {
        console.error('Error loading group items:', error);
      }
    };
    
    loadGroupItems();
  }, [visible, groups]);

  // All available categories (predefined list)
  const categories = [
    // Cooked/Prepared Food
    'Rice', 'Soup', 'Leftovers', 'Kakanin',
    // Raw Ingredients
    'Baking', 'Beverages', 'Canned', 'Jarred', 'Condiments', 'Sauces', 'Dairy', 'Eggs',
    'Fruits', 'Frozen', 'Grains', 'Pasta', 'Noodles', 'Meat', 'Poultry', 'Seafood',
    'Snacks', 'Spices', 'Herbs', 'Vegetables', 'Other'
  ];

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return !!(
      debouncedQuery.trim() ||
      selectedCategories.length > 0 ||
      selectedGroups.length > 0 ||
      selectedInventory !== null ||
      expiryFilter !== null
    );
  }, [debouncedQuery, selectedCategories, selectedGroups, selectedInventory, expiryFilter]);

  // Calculate days until expiry
  const calculateDaysUntilExpiry = (expirationDate) => {
    if (!expirationDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expirationDate);
    expiry.setHours(0, 0, 0, 0);
    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Filter items based on active filters
  const filteredItems = useMemo(() => {
    if (!hasActiveFilters) return [];

    let filtered = [...items];

    // Search filter
    if (debouncedQuery.trim()) {
      const query = debouncedQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.itemName?.toLowerCase().includes(query) ||
        item.itemCategory?.toLowerCase().includes(query) ||
        item.itemDescription?.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (selectedCategories.length > 0) {
      filtered = filtered.filter(item => 
        selectedCategories.includes(item.itemCategory)
      );
    }

    // Group filter
    if (selectedGroups.length > 0) {
      filtered = filtered.filter(item => {
        // Check if item is in any of the selected groups
        return selectedGroups.some(groupId => {
          const itemIDs = groupItemsMap[groupId] || [];
          return itemIDs.includes(item.itemID);
        });
      });
    }

    // Inventory filter
    if (selectedInventory !== null) {
      filtered = filtered.filter(item => item.inventoryID === selectedInventory);
    }

    // Expiry filter
    if (expiryFilter === 'expiring') {
      filtered = filtered.filter(item => {
        const daysUntilExpiry = calculateDaysUntilExpiry(item.itemExpiration);
        return daysUntilExpiry !== null && daysUntilExpiry > 0 && daysUntilExpiry <= 3;
      });
    } else if (expiryFilter === 'expired') {
      filtered = filtered.filter(item => {
        const daysUntilExpiry = calculateDaysUntilExpiry(item.itemExpiration);
        return daysUntilExpiry !== null && daysUntilExpiry <= 0;
      });
    } else if (expiryFilter === 'valid') {
      filtered = filtered.filter(item => {
        const daysUntilExpiry = calculateDaysUntilExpiry(item.itemExpiration);
        return daysUntilExpiry === null || daysUntilExpiry > 3;
      });
    }

    return filtered;
  }, [items, debouncedQuery, selectedCategories, selectedGroups, selectedInventory, expiryFilter, hasActiveFilters, groups]);

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategories([]);
    setSelectedGroups([]);
    setSelectedInventory(null);
    setExpiryFilter(null);
  };

  // Toggle category selection
  const toggleCategory = (category) => {
    setSelectedCategories(prev => 
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  // Toggle group selection
  const toggleGroup = (groupId) => {
    setSelectedGroups(prev => 
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  // Toggle expiry filter
  const toggleExpiryFilter = (filter) => {
    setExpiryFilter(prev => prev === filter ? null : filter);
  };

  // Format date for display
  const formatDate = (date) => {
    if (!date) return 'No expiry';
    const dateObj = new Date(date);
    return `${dateObj.getMonth() + 1}/${dateObj.getDate()}/${dateObj.getFullYear()}`;
  };

  // Check if item is expiring soon
  const isExpiringSoon = (date) => {
    const daysUntilExpiry = calculateDaysUntilExpiry(date);
    return daysUntilExpiry !== null && daysUntilExpiry > 0 && daysUntilExpiry <= 3;
  };

  // Check if item is expired
  const isExpired = (date) => {
    const daysUntilExpiry = calculateDaysUntilExpiry(date);
    return daysUntilExpiry !== null && daysUntilExpiry <= 0;
  };

  // Get category icon
  const getCategoryIcon = (category) => {
    const iconMap = {
      // Cooked/Prepared Food
      'Rice': 'rice',
      'Soup': 'bowl-mix',
      'Leftovers': 'food-drumstick',
      'Kakanin': 'food',
      // Raw Ingredients
      'Baking': 'cake',
      'Beverages': 'coffee-outline',
      'Canned': 'canned-food',
      'Jarred': 'jar-outline',
      'Condiments': 'bottle-tonic',
      'Sauces': 'soy-sauce',
      'Dairy': 'cow',
      'Eggs': 'egg-outline',
      'Fruits': 'food-apple-outline',
      'Frozen': 'snowflake',
      'Grains': 'barley',
      'Pasta': 'pasta',
      'Noodles': 'noodles',
      'Meat': 'food-steak',
      'Poultry': 'food-drumstick-outline',
      'Seafood': 'fish',
      'Snacks': 'cookie-outline',
      'Spices': 'shaker-outline',
      'Herbs': 'leaf',
      'Vegetables': 'carrot',
      'Other': 'help-circle-outline',
    };
    return iconMap[category] || 'help-circle-outline';
  };

  // Render item card
  const renderItemCard = (item) => (
    <TouchableOpacity
      key={item.itemID}
      style={styles.itemCard}
      onPress={() => {
        onItemPress(item);
        onClose();
      }}
      activeOpacity={0.7}
    >
      {/* Item Image */}
      {item.imageURL ? (
        <Image 
          source={{ uri: item.imageURL }} 
          style={styles.itemImage}
        />
      ) : (
        <View style={styles.itemImagePlaceholder}>
          <MaterialCommunityIcons 
            name={getCategoryIcon(item.itemCategory)} 
            size={40} 
            color="#ccc" 
          />
        </View>
      )}

      {/* Expiry Badge */}
      {isExpired(item.itemExpiration) && (
        <View style={[styles.expiryBadge, styles.expiredBadge]}>
          <Text style={styles.expiryBadgeText}>Expired</Text>
        </View>
      )}
      {!isExpired(item.itemExpiration) && isExpiringSoon(item.itemExpiration) && (
        <View style={[styles.expiryBadge, styles.expiringSoonBadge]}>
          <Text style={styles.expiryBadgeText}>Expiring Soon</Text>
        </View>
      )}

      {/* Item Details */}
      <View style={styles.itemCardDetails}>
        <Text style={styles.itemCardName} numberOfLines={1}>
          {item.itemName}
        </Text>
        <Text style={styles.itemCardQuantity} numberOfLines={1}>
          {item.quantity} {item.unit || 'unit(s)'}
        </Text>
        {item.itemCategory && (
          <Text style={styles.itemCardCategory} numberOfLines={1}>
            {item.itemCategory}
          </Text>
        )}
        <View style={styles.itemCardFooter}>
          <Text style={[
            styles.itemCardExpiry,
            isExpired(item.itemExpiration) && styles.expiredText,
            isExpiringSoon(item.itemExpiration) && styles.expiringSoonText
          ]}>
            {formatDate(item.itemExpiration)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyStateContainer}>
      <Ionicons name="search-outline" size={80} color="#ddd" />
      <Text style={styles.emptyStateTitle}>Start Searching Your Pantry</Text>
      <Text style={styles.emptyStateSubtitle}>
        Use the search and filters below to find items in your pantry
      </Text>
    </View>
  );

  // Render no results state
  const renderNoResults = () => (
    <View style={styles.emptyStateContainer}>
      <Ionicons name="sad-outline" size={80} color="#ddd" />
      <Text style={styles.emptyStateTitle}>No Items Found</Text>
      <Text style={styles.emptyStateSubtitle}>
        Try adjusting your search or filters
      </Text>
    </View>
  );

  // Get active filters summary
  const getActiveFiltersSummary = () => {
    const parts = [];
    if (debouncedQuery.trim()) parts.push(`"${debouncedQuery}"`);
    if (expiryFilter === 'expiring') parts.push('Expiring Soon');
    if (expiryFilter === 'expired') parts.push('Expired');
    if (expiryFilter === 'valid') parts.push('Valid Items');
    if (selectedCategories.length > 0) {
      parts.push(selectedCategories.length === 1 
        ? selectedCategories[0] 
        : `${selectedCategories.length} categories`
      );
    }
    if (selectedGroups.length > 0) {
      parts.push(selectedGroups.length === 1
        ? groups.find(g => g.groupID === selectedGroups[0])?.groupTitle || 'Group'
        : `${selectedGroups.length} groups`
      );
    }
    return parts.join(' • ');
  };

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={visible}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Search & Filter</Text>
          {hasActiveFilters && (
            <TouchableOpacity onPress={clearFilters} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          )}
          {!hasActiveFilters && <View style={styles.headerSpacer} />}
        </View>

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or description..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus={false}
            returnKeyType="search"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Active Filters Summary */}
        {hasActiveFilters && (
          <View style={styles.activeFiltersContainer}>
            <Text style={styles.activeFiltersText} numberOfLines={1}>
              Active: {getActiveFiltersSummary()}
            </Text>
          </View>
        )}

        <ScrollView 
          style={styles.filtersScrollView}
          showsVerticalScrollIndicator={false}
        >
          {/* Quick Expiry Filters */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Quick Filters</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChipsContainer}
            >
              <TouchableOpacity
                style={[styles.filterChip, expiryFilter === 'expiring' && styles.activeFilterChip]}
                onPress={() => toggleExpiryFilter('expiring')}
              >
                <Ionicons 
                  name="time-outline" 
                  size={16} 
                  color={expiryFilter === 'expiring' ? '#fff' : '#FF9800'} 
                />
                <Text style={[styles.filterChipText, expiryFilter === 'expiring' && styles.activeFilterChipText]}>
                  Expiring Soon
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterChip, expiryFilter === 'expired' && styles.activeFilterChip]}
                onPress={() => toggleExpiryFilter('expired')}
              >
                <Ionicons 
                  name="alert-circle-outline" 
                  size={16} 
                  color={expiryFilter === 'expired' ? '#fff' : '#ff4d4d'} 
                />
                <Text style={[styles.filterChipText, expiryFilter === 'expired' && styles.activeFilterChipText]}>
                  Expired
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterChip, expiryFilter === 'valid' && styles.activeFilterChip]}
                onPress={() => toggleExpiryFilter('valid')}
              >
                <Ionicons 
                  name="checkmark-circle-outline" 
                  size={16} 
                  color={expiryFilter === 'valid' ? '#fff' : '#81A969'} 
                />
                <Text style={[styles.filterChipText, expiryFilter === 'valid' && styles.activeFilterChipText]}>
                  Valid Items
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Category Filters */}
          <View style={styles.filterSection}>
            <TouchableOpacity 
              style={styles.filterSectionHeader}
              onPress={() => setCategoriesExpanded(!categoriesExpanded)}
            >
              <Text style={styles.filterSectionTitle}>
                Categories {selectedCategories.length > 0 && `(${selectedCategories.length})`}
              </Text>
              <Ionicons 
                name={categoriesExpanded ? 'chevron-up' : 'chevron-down'} 
                size={20} 
                color="#666" 
              />
            </TouchableOpacity>
            
            {categoriesExpanded && (
              <View style={styles.categoryGrid}>
                {categories.map(category => (
                  <TouchableOpacity
                    key={category}
                    style={[
                      styles.categoryGridItem,
                      selectedCategories.includes(category) && styles.activeCategoryGridItem
                    ]}
                    onPress={() => toggleCategory(category)}
                  >
                    <MaterialCommunityIcons 
                      name={getCategoryIcon(category)} 
                      size={20} 
                      color={selectedCategories.includes(category) ? '#fff' : '#81A969'} 
                    />
                    <Text style={[
                      styles.categoryGridText,
                      selectedCategories.includes(category) && styles.activeCategoryGridText
                    ]}>
                      {category}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Group Filters */}
          {groups.length > 0 && (
            <View style={styles.filterSection}>
              <TouchableOpacity 
                style={styles.filterSectionHeader}
                onPress={() => setGroupsExpanded(!groupsExpanded)}
              >
                <Text style={styles.filterSectionTitle}>
                  Groups {selectedGroups.length > 0 && `(${selectedGroups.length})`}
                </Text>
                <Ionicons 
                  name={groupsExpanded ? 'chevron-up' : 'chevron-down'} 
                  size={20} 
                  color="#666" 
                />
              </TouchableOpacity>
              
              {groupsExpanded && (
                <View style={styles.categoryGrid}>
                  {groups.map(group => (
                    <TouchableOpacity
                      key={group.groupID}
                      style={[
                        styles.categoryGridItem,
                        selectedGroups.includes(group.groupID) && styles.activeCategoryGridItem
                      ]}
                      onPress={() => toggleGroup(group.groupID)}
                      activeOpacity={0.7}
                    >
                      <Ionicons 
                        name="folder-outline" 
                        size={20} 
                        color={selectedGroups.includes(group.groupID) ? '#fff' : '#81A969'} 
                      />
                      <Text style={[
                        styles.categoryGridText,
                        selectedGroups.includes(group.groupID) && styles.activeCategoryGridText
                      ]} numberOfLines={1}>
                        {group.groupTitle}
                      </Text>
                      <Text style={[
                        styles.groupItemCount,
                        selectedGroups.includes(group.groupID) && styles.activeGroupItemCount
                      ]}>
                        {group.itemCount || 0}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Results Section */}
          <View style={styles.resultsSection}>
            {!hasActiveFilters && renderEmptyState()}
            
            {hasActiveFilters && filteredItems.length === 0 && renderNoResults()}
            
            {hasActiveFilters && filteredItems.length > 0 && (
              <>
                <View style={styles.resultsHeader}>
                  <Text style={styles.resultsCount}>
                    {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'} found
                  </Text>
                </View>
                <View style={styles.itemsGrid}>
                  {filteredItems.map(item => renderItemCard(item))}
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 5,
    marginRight: 10,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  clearButton: {
    padding: 5,
  },
  clearButtonText: {
    color: '#81A969',
    fontSize: 16,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 50,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    marginHorizontal: 20,
    marginVertical: 15,
    paddingHorizontal: 15,
    borderRadius: 12,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  activeFiltersContainer: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  activeFiltersText: {
    fontSize: 13,
    color: '#81A969',
    fontWeight: '600',
  },
  filtersScrollView: {
    flex: 1,
  },
  filterSection: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  filterSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  filterChipsContainer: {
    paddingVertical: 5,
    gap: 8,
  },
  filterChipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 5,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  activeFilterChip: {
    backgroundColor: '#81A969',
  },
  filterChipText: {
    fontSize: 14,
    color: '#555',
    fontWeight: '500',
  },
  activeFilterChipText: {
    color: '#fff',
  },
  resultsSection: {
    paddingTop: 20,
    paddingBottom: 40,
  },
  resultsHeader: {
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  resultsCount: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  itemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    justifyContent: 'flex-start',
    gap: 15,
  },
  itemCard: {
    width: CARD_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  itemImage: {
    width: '100%',
    height: CARD_WIDTH * 0.6,
    borderRadius: 8,
    marginBottom: 10,
  },
  itemImagePlaceholder: {
    width: '100%',
    height: CARD_WIDTH * 0.6,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expiryBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    zIndex: 5,
  },
  expiredBadge: {
    backgroundColor: '#ff4d4d',
  },
  expiringSoonBadge: {
    backgroundColor: '#FF9800',
  },
  expiryBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  itemCardDetails: {
    flex: 1,
  },
  itemCardName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  itemCardQuantity: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  itemCardCategory: {
    fontSize: 11,
    color: '#81A969',
    fontWeight: '500',
    marginBottom: 8,
  },
  itemCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemCardExpiry: {
    fontSize: 11,
    color: '#999',
  },
  expiredText: {
    color: '#ff4d4d',
    fontWeight: '600',
  },
  expiringSoonText: {
    color: '#FF9800',
    fontWeight: '600',
  },
  emptyStateContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  categoryGridItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
    minWidth: '47%',
    flex: 1,
    maxWidth: '48%',
  },
  activeCategoryGridItem: {
    backgroundColor: '#81A969',
  },
  categoryGridText: {
    fontSize: 13,
    color: '#555',
    fontWeight: '500',
    flex: 1,
  },
  activeCategoryGridText: {
    color: '#fff',
  },
  groupItemCount: {
    fontSize: 12,
    color: '#999',
    fontWeight: '600',
    marginLeft: 'auto',
  },
  activeGroupItemCount: {
    color: '#fff',
  },
});

export default SearchFilterModal;
