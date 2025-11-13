import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PantryService from '../../services/pantry-service';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MODAL_ITEM_WIDTH = (SCREEN_WIDTH - 60) / 2; // Account for padding and gap

/**
 * Group Items Modal Component
 * Displays all items within a group with images and details
 */
const GroupItemsModal = ({ 
  visible, 
  onClose, 
  group,
  onItemPress,
  onEditGroup,
  onDeleteGroup,
}) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load items when modal opens or group changes
  useEffect(() => {
    if (visible && group) {
      loadGroupItems();
    }
  }, [visible, group]);

  const loadGroupItems = async () => {
    try {
      setLoading(true);
      console.log('📦 Loading items for group:', group.groupID);
      const groupItems = await PantryService.getGroupItems(group.groupID);
      setItems(groupItems);
      console.log('✅ Loaded', groupItems.length, 'items');
    } catch (error) {
      console.error('Error loading group items:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!group) return null;

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={[styles.modalHeader, { backgroundColor: group.groupColor || '#8BC34A' }]}>
            <View style={styles.headerLeft}>
              <View style={styles.groupIconContainer}>
                <Text style={styles.groupIcon}>
                  {group.groupTitle?.charAt(0).toUpperCase() || 'G'}
                </Text>
              </View>
              <View>
                <Text style={styles.modalTitle}>{group.groupTitle}</Text>
                <Text style={styles.itemCount}>{items.length} items</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => {
                onClose();
                onEditGroup();
              }}
            >
              <Ionicons name="create-outline" size={20} color="#8BC34A" />
              <Text style={styles.actionButtonText}>Edit Group</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, styles.deleteButton]}
              onPress={() => {
                onClose();
                onDeleteGroup();
              }}
            >
              <Ionicons name="trash-outline" size={20} color="#ff4d4d" />
              <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Delete</Text>
            </TouchableOpacity>
          </View>

          {/* Items List */}
          <ScrollView 
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#8BC34A" />
                <Text style={styles.loadingText}>Loading items...</Text>
              </View>
            ) : items.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="cube-outline" size={80} color="#ccc" />
                <Text style={styles.emptyTitle}>No items yet</Text>
                <Text style={styles.emptySubtitle}>
                  Add items to this group to see them here
                </Text>
              </View>
            ) : (
              <View style={styles.itemsGrid}>
                {items.map((item) => (
                  <TouchableOpacity
                    key={item.itemID}
                    style={styles.itemCard}
                    onPress={() => {
                      onClose();
                      onItemPress(item);
                    }}
                    activeOpacity={0.7}
                  >
                    {/* Item Image */}
                    <View style={styles.itemImageContainer}>
                      {item.imageURL ? (
                        <Image 
                          source={{ uri: item.imageURL }} 
                          style={styles.itemImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.itemImagePlaceholder}>
                          <Ionicons name="image-outline" size={32} color="#ccc" />
                        </View>
                      )}
                    </View>

                    {/* Item Details */}
                    <View style={styles.itemDetails}>
                      <Text style={styles.itemName} numberOfLines={2}>
                        {item.itemName}
                      </Text>
                      
                      <View style={styles.itemMeta}>
                        <Text style={styles.itemQuantity}>
                          {item.quantity} {item.unit}
                        </Text>
                        {item.itemCategory && (
                          <Text style={styles.itemCategory} numberOfLines={1}>
                            {item.itemCategory}
                          </Text>
                        )}
                      </View>

                      {/* Expiration Badge */}
                      {item.itemExpiration && (
                        <View style={styles.expirationBadge}>
                          <Ionicons name="time-outline" size={12} color="#666" />
                          <Text style={styles.expirationText}>
                            {new Date(item.itemExpiration).toLocaleDateString()}
                          </Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    height: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  groupIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  groupIcon: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  itemCount: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    gap: 8,
  },
  deleteButton: {
    backgroundColor: '#fff0f0',
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#8BC34A',
  },
  deleteButtonText: {
    color: '#ff4d4d',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#999',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 30,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#555',
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#999',
    textAlign: 'center',
    lineHeight: 22,
  },
  itemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 15,
    gap: 15,
  },
  itemCard: {
    width: MODAL_ITEM_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  itemImageContainer: {
    width: '100%',
    height: MODAL_ITEM_WIDTH * 0.75,
    backgroundColor: '#f5f5f5',
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  itemImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
  },
  itemDetails: {
    padding: 12,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
    minHeight: 40,
  },
  itemMeta: {
    marginBottom: 8,
  },
  itemQuantity: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
    marginBottom: 3,
  },
  itemCategory: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  expirationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    gap: 4,
  },
  expirationText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
});

export default GroupItemsModal;
