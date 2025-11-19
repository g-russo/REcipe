import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  Alert,
  Modal,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
  Platform
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCustomAuth } from '../hooks/use-custom-auth';
import NotificationDatabaseService from '../services/notification-database-service';

const { width } = Dimensions.get('window');

const Notifications = () => {
  const { user, customUserData } = useCustomAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // UI States
  const [menuVisible, setMenuVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  
  // Menu animation
  const menuScale = useRef(new Animated.Value(0)).current;
  const menuOpacity = useRef(new Animated.Value(0)).current;
  const menuItem1Opacity = useRef(new Animated.Value(0)).current;
  const menuItem1TranslateY = useRef(new Animated.Value(-10)).current;
  const menuItem2Opacity = useRef(new Animated.Value(0)).current;
  const menuItem2TranslateY = useRef(new Animated.Value(-10)).current;
  
  // Detail Modal animation
  const modalScale = useRef(new Animated.Value(0)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (customUserData?.userID) {
      loadNotifications();
      loadUnreadCount();

      const subscription = NotificationDatabaseService.subscribeToNotifications(
        customUserData.userID,
        (newNotification) => {
          setNotifications(prev => [newNotification, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      );

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [customUserData]);

  const loadNotifications = async () => {
    if (!customUserData?.userID) return;
    
    try {
      setLoading(true);
      const data = await NotificationDatabaseService.getUserNotifications(customUserData.userID);
      setNotifications(data);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    if (!customUserData?.userID) return;
    try {
      const count = await NotificationDatabaseService.getUnreadCount(customUserData.userID);
      setUnreadCount(count);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotifications();
    await loadUnreadCount();
    setRefreshing(false);
  }, [customUserData]);

  const handleNotificationPress = async (notification) => {
    // Mark as read immediately when opening
    if (!notification.isRead) {
      await NotificationDatabaseService.markAsRead(notification.notificationID);
      setNotifications(prev =>
        prev.map(n =>
          n.notificationID === notification.notificationID
            ? { ...n, isRead: true }
            : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }

    setSelectedNotification(notification);
    setDetailModalVisible(true);
    
    // Animate modal entrance
    modalScale.setValue(0.7);
    modalOpacity.setValue(0);
    
    Animated.parallel([
      Animated.spring(modalScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 10,
      }),
      Animated.timing(modalOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleDelete = async (notificationID) => {
    try {
      // Optimistic update
      setNotifications(prev => prev.filter(n => n.notificationID !== notificationID));
      
      await NotificationDatabaseService.deleteNotification(notificationID);
      
      const deletedNotif = notifications.find(n => n.notificationID === notificationID);
      if (deletedNotif && !deletedNotif.isRead) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      // Revert on error (could be improved with more robust state management)
      loadNotifications(); 
    }
  };

  const handleClearAll = () => {
    setMenuVisible(false);
    Animated.parallel([
      Animated.spring(menuScale, {
        toValue: 0,
        useNativeDriver: true,
        speed: 20,
        bounciness: 10,
      }),
      Animated.timing(menuOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
    
    Alert.alert(
      'Clear All',
      'Are you sure you want to delete all notifications?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await NotificationDatabaseService.clearAllNotifications(customUserData.userID);
              setNotifications([]);
              setUnreadCount(0);
            } catch (error) {
              console.error('Error clearing notifications:', error);
            }
          },
        },
      ]
    );
  };

  const handleMarkAllRead = async () => {
    setMenuVisible(false);
    Animated.parallel([
      Animated.spring(menuScale, {
        toValue: 0,
        useNativeDriver: true,
        speed: 20,
        bounciness: 10,
      }),
      Animated.timing(menuOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
    
    try {
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
      
      const unread = notifications.filter(n => !n.isRead);
      for (const n of unread) {
        await NotificationDatabaseService.markAsRead(n.notificationID);
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const closeDetailModal = () => {
    Animated.parallel([
      Animated.timing(modalScale, {
        toValue: 0.7,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(modalOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setDetailModalVisible(false);
    });
  };
  
  const handleModalAction = (action) => {
    closeDetailModal();
    if (selectedNotification) {
      if (action === 'pantry') {
        setTimeout(() => router.push('/(tabs)/pantry'), 200);
      } else if (action === 'scheduled') {
        setTimeout(() => router.push('/(tabs)/meal-planner'), 200);
      }
    }
  };
  
  const openMenu = () => {
    setMenuVisible(true);
    
    // Reset values
    menuScale.setValue(0);
    menuOpacity.setValue(0);
    menuItem1Opacity.setValue(0);
    menuItem1TranslateY.setValue(-10);
    menuItem2Opacity.setValue(0);
    menuItem2TranslateY.setValue(-10);
    
    // Container animation
    Animated.parallel([
      Animated.spring(menuScale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 12,
        bounciness: 12,
      }),
      Animated.timing(menuOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
    
    // Staggered item animations (top to bottom)
    Animated.sequence([
      Animated.delay(100),
      Animated.parallel([
        Animated.timing(menuItem1Opacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.spring(menuItem1TranslateY, {
          toValue: 0,
          useNativeDriver: true,
          speed: 14,
          bounciness: 8,
        }),
      ]),
    ]).start();
    
    Animated.sequence([
      Animated.delay(180),
      Animated.parallel([
        Animated.timing(menuItem2Opacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.spring(menuItem2TranslateY, {
          toValue: 0,
          useNativeDriver: true,
          speed: 14,
          bounciness: 8,
        }),
      ]),
    ]).start();
  };
  
  const closeMenu = () => {
    // Staggered close animations (bottom to top - reverse order)
    Animated.parallel([
      Animated.timing(menuItem2Opacity, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(menuItem2TranslateY, {
        toValue: -10,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    
    Animated.sequence([
      Animated.delay(80),
      Animated.parallel([
        Animated.timing(menuItem1Opacity, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(menuItem1TranslateY, {
          toValue: -10,
          duration: 100,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
    
    // Container close animation
    Animated.parallel([
      Animated.spring(menuScale, {
        toValue: 0,
        useNativeDriver: true,
        speed: 20,
        bounciness: 10,
      }),
      Animated.timing(menuOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setMenuVisible(false);
    });
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    const options = { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
    return date.toLocaleDateString('en-US', options);
  };

  const renderRightActions = (progress, dragX, notificationID) => {
    const scale = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });

    return (
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => handleDelete(notificationID)}
      >
        <Animated.View style={{ transform: [{ scale }] }}>
          <View style={styles.deleteIconContainer}>
            <Ionicons name="trash-outline" size={24} color="#FFF" />
            <Text style={styles.deleteText}>Clear</Text>
          </View>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const renderNotification = ({ item }) => {
    // Determine icon based on type or content
    let iconName = 'notifications-outline';
    let iconColor = '#81A969';
    
    if (item.title?.toLowerCase().includes('expire')) {
      iconName = 'alert-circle-outline';
      iconColor = '#FF6B6B';
    } else if (item.title?.toLowerCase().includes('schedule') || item.title?.toLowerCase().includes('cook')) {
      iconName = 'calendar-outline';
      iconColor = '#FF9800';
    }

    return (
      <Swipeable
        renderRightActions={(progress, dragX) => renderRightActions(progress, dragX, item.notificationID)}
        onSwipeableRightOpen={() => handleDelete(item.notificationID)} // Full swipe to delete
        overshootRight={false}
      >
        <TouchableOpacity
          style={[
            styles.notificationCard,
            !item.isRead && styles.unreadCard,
          ]}
          onPress={() => handleNotificationPress(item)}
          activeOpacity={0.9}
        >
          <View style={styles.iconContainer}>
            <View style={[styles.iconCircle, { backgroundColor: item.isRead ? '#F5F5F5' : '#E8F5E9' }]}>
              <Ionicons name={iconName} size={24} color={iconColor} />
            </View>
          </View>
          
          <View style={styles.contentContainer}>
            <View style={styles.headerRow}>
              <Text style={[styles.title, !item.isRead && styles.unreadText]} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
            </View>
            <Text style={styles.body} numberOfLines={2}>
              {item.body}
            </Text>
          </View>
          
          {!item.isRead && <View style={styles.unreadDot} />}
        </TouchableOpacity>
      </Swipeable>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="notifications-off-outline" size={64} color="#CCC" />
      <Text style={styles.emptyText}>No notifications yet</Text>
      <Text style={styles.emptySubtext}>You'll see updates here when you have them</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + hp('1%') }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={28} color="#333" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Notifications</Text>
        
        <TouchableOpacity
          style={styles.menuButton}
          onPress={openMenu}
        >
          <Ionicons name="ellipsis-vertical" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Dropdown Menu */}
      <Modal
        transparent={true}
        visible={menuVisible}
        animationType="none"
        onRequestClose={closeMenu}
      >
        <TouchableWithoutFeedback onPress={closeMenu}>
          <View style={styles.menuOverlay}>
            <Animated.View 
              style={[
                styles.menuContainer,
                {
                  opacity: menuOpacity,
                  transform: [{ scale: menuScale }]
                }
              ]}
            >
              <Animated.View 
                style={{
                  opacity: menuItem1Opacity,
                  transform: [{ translateY: menuItem1TranslateY }]
                }}
              >
                <TouchableOpacity style={styles.menuItem} onPress={handleMarkAllRead}>
                  <Ionicons name="checkmark-done-outline" size={20} color="#333" />
                  <Text style={styles.menuText}>Mark all as read</Text>
                </TouchableOpacity>
              </Animated.View>
              
              <View style={styles.menuDivider} />
              
              <Animated.View 
                style={{
                  opacity: menuItem2Opacity,
                  transform: [{ translateY: menuItem2TranslateY }]
                }}
              >
                <TouchableOpacity style={styles.menuItem} onPress={handleClearAll}>
                  <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
                  <Text style={[styles.menuText, { color: '#FF6B6B' }]}>Clear all</Text>
                </TouchableOpacity>
              </Animated.View>
            </Animated.View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Notifications List */}
      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.notificationID}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={!loading && renderEmpty()}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#81A969']} />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Detail Modal */}
      <Modal
        visible={detailModalVisible}
        animationType="none"
        transparent={true}
        onRequestClose={closeDetailModal}
      >
        <TouchableWithoutFeedback onPress={closeDetailModal}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <Animated.View style={[
                styles.modalContent,
                {
                  opacity: modalOpacity,
                  transform: [{ scale: modalScale }]
                }
              ]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Notification Details</Text>
            </View>

            {selectedNotification && (
              <View style={styles.modalBody}>
                <View style={styles.modalIconRow}>
                  <View style={[styles.modalIconCircle, { 
                    backgroundColor: selectedNotification.title?.toLowerCase().includes('expire') ? '#FFEBEE' : '#E8F5E9' 
                  }]}>
                    <Ionicons 
                      name={selectedNotification.title?.toLowerCase().includes('expire') ? 'alert-circle' : 'notifications'} 
                      size={32} 
                      color={selectedNotification.title?.toLowerCase().includes('expire') ? '#FF6B6B' : '#81A969'} 
                    />
                  </View>
                  <Text style={styles.modalTime}>{formatTime(selectedNotification.createdAt)}</Text>
                </View>

                <Text style={styles.modalNotificationTitle}>{selectedNotification.title}</Text>
                <Text style={styles.modalNotificationBody}>{selectedNotification.body}</Text>

                <View style={styles.modalActions}>
                  {(selectedNotification.title?.toLowerCase().includes('expire') || selectedNotification.body?.toLowerCase().includes('pantry')) && (
                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={() => handleModalAction('pantry')}
                    >
                      <Ionicons name="basket-outline" size={20} color="#FFF" />
                      <Text style={styles.actionButtonText}>View in Pantry</Text>
                    </TouchableOpacity>
                  )}

                  {(selectedNotification.title?.toLowerCase().includes('schedule') || selectedNotification.title?.toLowerCase().includes('cook')) && (
                    <TouchableOpacity 
                      style={[styles.actionButton, { backgroundColor: '#FF9800' }]}
                      onPress={() => handleModalAction('scheduled')}
                    >
                      <Ionicons name="calendar-outline" size={20} color="#FFF" />
                      <Text style={styles.actionButtonText}>View Schedule</Text>
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity 
                    style={styles.closeButton}
                    onPress={closeDetailModal}
                  >
                    <Text style={styles.closeButtonText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp('5%'),
    paddingBottom: hp('2%'),
    backgroundColor: '#fff',
    borderBottomWidth: 0,
    zIndex: 10,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: wp('5%'),
    fontWeight: 'bold',
    color: '#333',
  },
  menuButton: {
    padding: 5,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  menuContainer: {
    position: 'absolute',
    top: hp('8%'),
    right: wp('3%'),
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    minWidth: 180,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuText: {
    fontSize: wp('4%'),
    color: '#333',
    marginLeft: 12,
    fontWeight: '500',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 4,
  },
  listContainer: {
    padding: wp('4%'),
    paddingBottom: hp('10%'),
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: wp('4%'),
    marginBottom: hp('1.5%'),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  unreadCard: {
    backgroundColor: '#fff',
    borderLeftWidth: 4,
    borderLeftColor: '#81A969',
  },
  iconContainer: {
    marginRight: wp('3%'),
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  unreadText: {
    fontWeight: 'bold',
    color: '#000',
  },
  time: {
    fontSize: wp('3%'),
    color: '#999',
  },
  body: {
    fontSize: wp('3.5%'),
    color: '#666',
    lineHeight: wp('5%'),
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#81A969',
    marginLeft: 8,
  },
  deleteAction: {
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginBottom: hp('1.5%'),
    borderRadius: 16,
    flex: 1,
    paddingRight: 20,
  },
  deleteIconContainer: {
    alignItems: 'center',
  },
  deleteText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: hp('20%'),
  },
  emptyText: {
    fontSize: wp('5%'),
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: wp('4%'),
    color: '#999',
    marginTop: 8,
  },
  
  // Detail Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp('5%'),
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: wp('6%'),
    width: '100%',
    maxWidth: 500,
    maxHeight: hp('80%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
  },
  modalHeader: {
    marginBottom: hp('3%'),
  },
  modalTitle: {
    fontSize: wp('5%'),
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  modalBody: {
    flex: 0,
  },
  modalIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: hp('2%'),
  },
  modalIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTime: {
    fontSize: wp('3.5%'),
    color: '#999',
    fontWeight: '500',
  },
  modalNotificationTitle: {
    fontSize: wp('5.5%'),
    fontWeight: 'bold',
    color: '#333',
    marginBottom: hp('1.5%'),
  },
  modalNotificationBody: {
    fontSize: wp('4%'),
    color: '#555',
    lineHeight: wp('6%'),
    marginBottom: hp('4%'),
  },
  modalActions: {
    marginTop: hp('3%'),
    gap: hp('1.5%'),
  },
  actionButton: {
    backgroundColor: '#81A969',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('2%'),
    borderRadius: 12,
    shadowColor: '#81A969',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: wp('4%'),
    fontWeight: 'bold',
    marginLeft: 8,
  },
  closeButton: {
    paddingVertical: hp('2%'),
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#999',
    fontSize: wp('4%'),
    fontWeight: '600',
  },
});

export default Notifications;
