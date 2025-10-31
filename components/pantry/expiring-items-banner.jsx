import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  badge: {
    backgroundColor: '#FF9800',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewAllText: {
    color: '#8BC34A',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
  },
  itemsContainer: {
    paddingHorizontal: 20,
  },
  itemCard: {
    width: 140,
    marginRight: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  urgencyText: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 5,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    minHeight: 36,
  },
  itemQuantity: {
    fontSize: 12,
    color: '#666',
  },
});

export default ExpiringItemsBanner;
