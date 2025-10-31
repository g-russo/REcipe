import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Search and Filter Modal Component
 * Allows searching items by name/category and filtering by various criteria
 */
const SearchFilterModal = ({
  visible,
  onClose,
  items,
  inventories,
  onItemPress,
  onGroupPress,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // all, items, groups
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedInventory, setSelectedInventory] = useState(null);
  const [expiryFilter, setExpiryFilter] = useState(null); // null, 'expiring', 'expired'

  // Get unique categories from items
  const categories = [...new Set(items.map(item => item.itemCategory))].filter(Boolean);

  // Filter items based on search and filters
  const filterItems = () => {
    let filtered = items;

    // Search by name or category
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.itemName?.toLowerCase().includes(query) ||
        item.itemCategory?.toLowerCase().includes(query) ||
        item.itemDescription?.toLowerCase().includes(query)
      );
    }

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter(item => item.itemCategory === selectedCategory);
    }

    // Filter by inventory
    if (selectedInventory) {
      filtered = filtered.filter(item => item.inventoryID === selectedInventory);
    }

    // Filter by expiry
    if (expiryFilter === 'expiring') {
      filtered = filtered.filter(item => {
        if (!item.itemExpiration) return false;
        const expiryDate = new Date(item.itemExpiration);
        const today = new Date();
        const diffTime = expiryDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 7;
      });
    } else if (expiryFilter === 'expired') {
      filtered = filtered.filter(item => {
        if (!item.itemExpiration) return false;
        const expiryDate = new Date(item.itemExpiration);
        const today = new Date();
        return expiryDate < today;
      });
    }

    return filtered;
  };

  // Filter groups based on search
  const filterGroups = () => {
    if (!searchQuery.trim()) return inventories;
    
    const query = searchQuery.toLowerCase();
    return inventories.filter(inv => 
      inv.inventoryName?.toLowerCase().includes(query) ||
      inv.inventoryTags?.some(tag => tag.toLowerCase().includes(query))
    );
  };

  const filteredItems = filterItems();
  const filteredGroups = filterGroups();

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory(null);
    setSelectedInventory(null);
    setExpiryFilter(null);
  };

  // Check if any filter is active
  const hasActiveFilters = selectedCategory || selectedInventory || expiryFilter;

  // Format date for display
  const formatDate = (date) => {
    if (!date) return 'No expiry';
    const dateObj = new Date(date);
    return `${dateObj.getMonth() + 1}/${dateObj.getDate()}/${dateObj.getFullYear()}`;
  };

  // Check if item is expiring soon
  const isExpiringSoon = (date) => {
    if (!date) return false;
    const expiryDate = new Date(date);
    const today = new Date();
    const diffTime = expiryDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  };

  // Check if item is expired
  const isExpired = (date) => {
    if (!date) return false;
    const expiryDate = new Date(date);
    const today = new Date();
    return expiryDate < today;
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
            <Ionicons name="arrow-back" size={24} color="#555" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Search & Filter</Text>
          {hasActiveFilters && (
            <TouchableOpacity onPress={clearFilters} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search items or groups..."
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

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'all' && styles.activeTab]}
            onPress={() => setActiveTab('all')}
          >
            <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>
              All ({filteredItems.length + filteredGroups.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'items' && styles.activeTab]}
            onPress={() => setActiveTab('items')}
          >
            <Text style={[styles.tabText, activeTab === 'items' && styles.activeTabText]}>
              Items ({filteredItems.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'groups' && styles.activeTab]}
            onPress={() => setActiveTab('groups')}
          >
            <Text style={[styles.tabText, activeTab === 'groups' && styles.activeTabText]}>
              Groups ({filteredGroups.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Filters (only show for items) */}
        {activeTab !== 'groups' && (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.filtersScroll}
            contentContainerStyle={styles.filtersContainer}
          >
            {/* Category Filter */}
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.filterChipsScroll}
            >
              <TouchableOpacity
                style={[styles.filterChip, expiryFilter === 'expiring' && styles.activeFilterChip]}
                onPress={() => setExpiryFilter(expiryFilter === 'expiring' ? null : 'expiring')}
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
                onPress={() => setExpiryFilter(expiryFilter === 'expired' ? null : 'expired')}
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

              {categories.map(category => (
                <TouchableOpacity
                  key={category}
                  style={[styles.filterChip, selectedCategory === category && styles.activeFilterChip]}
                  onPress={() => setSelectedCategory(selectedCategory === category ? null : category)}
                >
                  <Text style={[styles.filterChipText, selectedCategory === category && styles.activeFilterChipText]}>
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}

              {inventories.map(inv => (
                <TouchableOpacity
                  key={inv.inventoryID}
                  style={[
                    styles.filterChip, 
                    selectedInventory === inv.inventoryID && styles.activeFilterChip,
                    selectedInventory === inv.inventoryID && { backgroundColor: inv.inventoryColor }
                  ]}
                  onPress={() => setSelectedInventory(selectedInventory === inv.inventoryID ? null : inv.inventoryID)}
                >
                  <Text style={[styles.filterChipText, selectedInventory === inv.inventoryID && styles.activeFilterChipText]}>
                    {inv.inventoryName || `Inventory #${inv.inventoryID}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </ScrollView>
        )}

        {/* Results */}
        <ScrollView style={styles.resultsContainer}>
          {/* Groups Results */}
          {(activeTab === 'all' || activeTab === 'groups') && filteredGroups.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Groups</Text>
              {filteredGroups.map(group => (
                <TouchableOpacity
                  key={group.inventoryID}
                  style={styles.resultItem}
                  onPress={() => {
                    onGroupPress(group);
                    onClose();
                  }}
                >
                  <View style={[styles.groupColorDot, { backgroundColor: group.inventoryColor }]} />
                  <View style={styles.resultTextContainer}>
                    <Text style={styles.resultTitle}>
                      {group.inventoryName || `Inventory #${group.inventoryID}`}
                    </Text>
                    <Text style={styles.resultSubtitle}>
                      {group.itemCount || 0} items • Max: {group.maxItems}
                    </Text>
                    {group.inventoryTags && group.inventoryTags.length > 0 && (
                      <View style={styles.tagsRow}>
                        {group.inventoryTags.map((tag, idx) => (
                          <View key={idx} style={styles.tagBadge}>
                            <Text style={styles.tagBadgeText}>{tag}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#ccc" />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Items Results */}
          {(activeTab === 'all' || activeTab === 'items') && filteredItems.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Items</Text>
              {filteredItems.map(item => (
                <TouchableOpacity
                  key={item.itemID}
                  style={styles.resultItem}
                  onPress={() => {
                    onItemPress(item);
                    onClose();
                  }}
                >
                  <View style={styles.itemIconContainer}>
                    <Ionicons name="cube-outline" size={22} color="#8BC34A" />
                  </View>
                  <View style={styles.resultTextContainer}>
                    <Text style={styles.resultTitle}>{item.itemName}</Text>
                    <Text style={styles.resultSubtitle}>
                      {item.quantity} {item.unit || 'unit(s)'} • {item.itemCategory}
                    </Text>
                    <Text style={[
                      styles.expiryText,
                      isExpired(item.itemExpiration) && styles.expiredText,
                      isExpiringSoon(item.itemExpiration) && styles.expiringSoonText
                    ]}>
                      {isExpired(item.itemExpiration) && '🔴 '}
                      {isExpiringSoon(item.itemExpiration) && !isExpired(item.itemExpiration) && '🟠 '}
                      Expires: {formatDate(item.itemExpiration)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#ccc" />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* No Results */}
          {filteredItems.length === 0 && filteredGroups.length === 0 && (
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={60} color="#ddd" />
              <Text style={styles.emptyTitle}>No results found</Text>
              <Text style={styles.emptySubtitle}>
                Try adjusting your search or filters
              </Text>
            </View>
          )}
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
    color: '#8BC34A',
    fontSize: 16,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    marginHorizontal: 20,
    marginVertical: 15,
    paddingHorizontal: 15,
    borderRadius: 10,
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
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#8BC34A',
  },
  tabText: {
    fontSize: 15,
    color: '#999',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#8BC34A',
    fontWeight: '600',
  },
  filtersScroll: {
    maxHeight: 50,
  },
  filtersContainer: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  filterChipsScroll: {
    flexDirection: 'row',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    gap: 5,
  },
  activeFilterChip: {
    backgroundColor: '#8BC34A',
  },
  filterChipText: {
    fontSize: 14,
    color: '#555',
    fontWeight: '500',
  },
  activeFilterChipText: {
    color: '#fff',
  },
  resultsContainer: {
    flex: 1,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  groupColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  itemIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  resultTextContainer: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  resultSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  expiryText: {
    fontSize: 12,
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
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 5,
  },
  tagBadge: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tagBadgeText: {
    fontSize: 11,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#555',
    marginTop: 15,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
  },
});

export default SearchFilterModal;
