import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_CARD_WIDTH = Math.min(SCREEN_WIDTH * 0.3, 120);

/**
 * Expiring Items Banner Component
 * Shows items expiring within 3 days at the top of pantry
 */
const ExpiringItemsBanner = ({ expiringItems, onItemPress, onViewAll }) => {
  if (!expiringItems || expiringItems.length === 0) {
    return null;
  }

  // Group by urgency
  const today = expiringItems.filter(item => item.daysUntilExpiry === 0);
  const tomorrow = expiringItems.filter(item => item.daysUntilExpiry === 1);
  const soon = expiringItems.filter(item => item.daysUntilExpiry > 1 && item.daysUntilExpiry <= 3);

  // Get urgency level for styling
  const getUrgencyStyle = (days) => {
    if (days === 0) return { bg: '#ffe5e5', border: '#ff4d4d', text: '#ff4d4d', icon: 'alert-circle' };
    if (days === 1) return { bg: '#fff3e0', border: '#FF9800', text: '#FF9800', icon: 'time' };
    return { bg: '#fff9e6', border: '#FFC107', text: '#F57C00', icon: 'notifications' };
  };

  const getDaysText = (days) => {
    if (days === 0) return 'Expires Today';
    if (days === 1) return 'Expires Tomorrow';
    return `Expires in ${days} days`;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="warning" size={20} color="#FF9800" />
          <Text style={styles.headerTitle}>Expiring Soon</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{expiringItems.length}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onViewAll} style={styles.viewAllButton}>
          <Text style={styles.viewAllText}>View All</Text>
          <Ionicons name="chevron-forward" size={16} color="#8BC34A" />
        </TouchableOpacity>
      </View>

      {/* Items List */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.itemsContainer}
      >
        {/* Today */}
        {today.map(item => {
          const style = getUrgencyStyle(0);
          return (
            <TouchableOpacity
              key={item.itemID}
              style={[styles.itemCard, { backgroundColor: style.bg, borderColor: style.border }]}
              onPress={() => onItemPress(item)}
            >
              <View style={styles.itemHeader}>
                <Ionicons name={style.icon} size={18} color={style.text} />
                <Text style={[styles.urgencyText, { color: style.text }]}>
                  {getDaysText(0)}
                </Text>
              </View>
              <Text style={styles.itemName} numberOfLines={2}>
                {item.itemName}
              </Text>
              <Text style={styles.itemQuantity}>
                {item.quantity} {item.unit || 'unit(s)'}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Tomorrow */}
        {tomorrow.map(item => {
          const style = getUrgencyStyle(1);
          return (
            <TouchableOpacity
              key={item.itemID}
              style={[styles.itemCard, { backgroundColor: style.bg, borderColor: style.border }]}
              onPress={() => onItemPress(item)}
            >
              <View style={styles.itemHeader}>
                <Ionicons name={style.icon} size={18} color={style.text} />
                <Text style={[styles.urgencyText, { color: style.text }]}>
                  {getDaysText(1)}
                </Text>
              </View>
              <Text style={styles.itemName} numberOfLines={2}>
                {item.itemName}
              </Text>
              <Text style={styles.itemQuantity}>
                {item.quantity} {item.unit || 'unit(s)'}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Soon (2-3 days) */}
        {soon.map(item => {
          const style = getUrgencyStyle(item.daysUntilExpiry);
          return (
            <TouchableOpacity
              key={item.itemID}
              style={[styles.itemCard, { backgroundColor: style.bg, borderColor: style.border }]}
              onPress={() => onItemPress(item)}
            >
              <View style={styles.itemHeader}>
                <Ionicons name={style.icon} size={18} color={style.text} />
                <Text style={[styles.urgencyText, { color: style.text }]}>
                  {getDaysText(item.daysUntilExpiry)}
                </Text>
              </View>
              <Text style={styles.itemName} numberOfLines={2}>
                {item.itemName}
              </Text>
              <Text style={styles.itemQuantity}>
                {item.quantity} {item.unit || 'unit(s)'}
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
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  badge: {
    backgroundColor: '#FF9800',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewAllText: {
    color: '#8BC34A',
    fontSize: 13,
    fontWeight: '600',
    marginRight: 4,
  },
  itemsContainer: {
    paddingHorizontal: 20,
  },
  itemCard: {
    width: BANNER_CARD_WIDTH,
    marginRight: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  urgencyText: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 3,
    minHeight: 32,
  },
  itemQuantity: {
    fontSize: 11,
    color: '#666',
  },
});

export default ExpiringItemsBanner;
