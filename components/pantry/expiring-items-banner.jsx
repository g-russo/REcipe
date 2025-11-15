import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ExpiringItemsBanner = ({ expiringItems, onItemPress, onViewAll, onDeleteAllExpired }) => {
  const [expanded, setExpanded] = useState(false);

  if (!expiringItems || expiringItems.length === 0) {
    return null;
  }

  // Group by urgency
  const expired = expiringItems.filter(item => item.daysUntilExpiry < 0);
  const today = expiringItems.filter(item => item.daysUntilExpiry === 0);
  const tomorrow = expiringItems.filter(item => item.daysUntilExpiry === 1);
  const soon = expiringItems.filter(item => item.daysUntilExpiry > 1 && item.daysUntilExpiry <= 3);

  // Get urgency level for styling
  const getUrgencyStyle = (days) => {
    if (days < 0) return { bg: '#ffcccc', border: '#cc0000', text: '#cc0000', icon: 'close-circle' };
    if (days === 0) return { bg: '#ffe5e5', border: '#ff4d4d', text: '#ff4d4d', icon: 'alert-circle' };
    if (days === 1) return { bg: '#fff3e0', border: '#FF9800', text: '#FF9800', icon: 'time' };
    return { bg: '#fff9e6', border: '#FFC107', text: '#F57C00', icon: 'notifications' };
  };

  const getDaysText = (days) => {
    if (days < 0) {
      const daysExpired = Math.abs(days);
      return daysExpired === 1 ? 'Expired Yesterday' : `Expired ${daysExpired} days ago`;
    }
    if (days === 0) return 'Expires Today';
    if (days === 1) return 'Expires Tomorrow';
    return `Expires in ${days} days`;
  };

  const getPillText = (days) => {
    if (days < 0) return 'Expired';
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `In ${days}d`;
  };

  const hasExpiredItems = expired.length > 0;

  return (
    <View style={styles.dropdownContainer}>
      {/* Header (toggle) */}
      <TouchableOpacity style={styles.dropdownHeader} activeOpacity={0.7} onPress={() => setExpanded(prev => !prev)}>
        <View style={styles.headerLeft}>
          <Ionicons name="warning-outline" size={20} color="#FF9800" />
          <Text style={styles.headerTitle}>{hasExpiredItems ? 'Expired & Expiring Soon' : 'Expiring Soon'}</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{expiringItems.length}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          {hasExpiredItems && onDeleteAllExpired && (
            <TouchableOpacity onPress={onDeleteAllExpired} style={styles.deleteExpiredBtn}>
              <Ionicons name="trash-outline" size={14} color="#ff4d4d" />
              <Text style={styles.deleteExpiredText}>Delete Expired</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => { onViewAll && onViewAll(); setExpanded(false); }} style={styles.viewAllSimpleBtn}>
            <Text style={styles.viewAllSimpleText}>View All</Text>
          </TouchableOpacity>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="#999" />
        </View>
      </TouchableOpacity>

      {/* Dropdown content */}
      {expanded && (
        <View style={styles.listCard}>
          {[...expired, ...today, ...tomorrow, ...soon].map(item => {
            const pillStyleData = getUrgencyStyle(item.daysUntilExpiry);
            return (
              <TouchableOpacity
                key={item.itemID}
                style={styles.row}
                activeOpacity={0.7}
                onPress={() => onItemPress(item)}
              >
                <View style={styles.rowIconBox}>
                  <Ionicons name="time-outline" size={20} color="#FF9800" />
                </View>
                <View style={styles.rowTextWrap}>
                  <Text style={styles.rowName} numberOfLines={1}>{item.itemName}</Text>
                  <Text style={styles.rowSub}>{item.quantity} {item.unit || 'unit'}</Text>
                </View>
                <View style={[styles.expiryPill, { backgroundColor: pillStyleData.bg }]}>
                  <Text style={[styles.expiryPillText, { color: pillStyleData.text }]}>{getPillText(item.daysUntilExpiry)}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  dropdownContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 4,
    backgroundColor: '#fff',
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  countBadge: {
    backgroundColor: '#FF9800',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  countBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  deleteExpiredBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffe5e5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  deleteExpiredText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ff4d4d',
  },
  viewAllSimpleBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  viewAllSimpleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8ac551',
  },
  listCard: {
    marginTop: 6,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9e9e9',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f2f2',
  },
  rowIconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#fff9e6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#FFE5AA',
  },
  rowTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
    marginBottom: 2,
  },
  rowSub: {
    fontSize: 12,
    color: '#666',
  },
  expiryPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    minWidth: 70,
    alignItems: 'center',
  },
  expiryPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
});

export default ExpiringItemsBanner;
