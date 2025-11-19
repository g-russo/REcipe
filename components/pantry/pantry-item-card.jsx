import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 60) / 2; // 20px padding on each side + 20px gap

/**
 * Pantry Item Card Component
 * Displays a single pantry item with image, name, and expiration date
 */
const PantryItemCard = ({ 
  item, 
  onPress, 
  onLongPress, 
  onMenuPress,
  selectionMode = false,
  isSelected = false,
  isHighlighted = false,
}) => {
  // Format expiration date
  const formatDate = (date) => {
    if (!date) return 'No expiry';
    const dateObj = new Date(date);
    return `${dateObj.getMonth() + 1}/${dateObj.getDate()}/${dateObj.getFullYear()}`;
  };

  // Check if item is expiring soon (within 7 days)
  const isExpiringSoon = () => {
    if (!item.itemExpiration) return false;
    const expiryDate = new Date(item.itemExpiration);
    const today = new Date();
    const diffTime = expiryDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  };

  // Check if item is expired
  const isExpired = () => {
    if (!item.itemExpiration) return false;
    const expiryDate = new Date(item.itemExpiration);
    const today = new Date();
    return expiryDate < today;
  };

  return (
    <TouchableOpacity
      style={[
        styles.itemCard,
        isHighlighted && styles.highlightedCard
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={300}
    >
      {/* Selection Checkbox */}
      {selectionMode && (
        <View style={styles.checkboxContainer}>
          <View style={[
            styles.checkbox,
            isSelected && styles.checkboxSelected
          ]}>
            {isSelected && (
              <Ionicons name="checkmark" size={16} color="#fff" />
            )}
          </View>
        </View>
      )}
      
      {/* Item Image */}
      {item.imageURL ? (
        <Image 
          source={{ uri: item.imageURL }} 
          style={styles.itemImagePlaceholder}
        />
      ) : (
        <View style={styles.itemImagePlaceholder}>
          <Ionicons name="cube-outline" size={32} color="#ccc" />
        </View>
      )}

      {/* Expiry Badge */}
      {isExpired() && (
        <View style={[styles.expiryBadge, styles.expiredBadge]}>
          <Text style={styles.expiryBadgeText}>Expired</Text>
        </View>
      )}
      {!isExpired() && isExpiringSoon() && (
        <View style={[styles.expiryBadge, styles.expiringSoonBadge]}>
          <Text style={styles.expiryBadgeText}>Expiring Soon</Text>
        </View>
      )}

      <View style={styles.itemDetails}>
        <Text style={styles.itemName} numberOfLines={1}>
          {item.itemName}
        </Text>
        <Text style={styles.itemQuantity} numberOfLines={1}>
          {item.quantity} {item.unit || 'unit(s)'}
        </Text>
        <View style={styles.itemFooter}>
          <Text style={[
            styles.expDate,
            isExpired() && styles.expiredText,
            isExpiringSoon() && styles.expiringSoonText
          ]}>
            {formatDate(item.itemExpiration)}
          </Text>
          {!selectionMode && (
            <TouchableOpacity onPress={onMenuPress}>
              <Ionicons name="ellipsis-vertical" size={16} color="#aaa" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  itemCard: {
    width: CARD_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  highlightedCard: {
    backgroundColor: '#FFF9C4',
    borderWidth: 2,
    borderColor: '#FFD54F',
    shadowColor: '#FFD54F',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  checkboxContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ccc',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#81A969',
    borderColor: '#81A969',
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
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  itemQuantity: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expDate: {
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
});

export default PantryItemCard;
