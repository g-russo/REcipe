import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  Platform,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCustomAuth } from '../hooks/use-custom-auth';
import PantryService from '../services/pantry-service';
import GroupItemsModal from '../components/pantry/group-items-modal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 60) / 2;

// Category icon mapping
const categoryIconMap = {
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

const AllGroupsScreen = () => {
  const router = useRouter();
  const { customUserData } = useCustomAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupModalVisible, setGroupModalVisible] = useState(false);

  useEffect(() => {
    loadGroups();
  }, [customUserData]);

  const loadGroups = async () => {
    if (!customUserData?.userID) return;
    
    try {
      setLoading(true);
      const groupsData = await PantryService.getUserGroups(customUserData.userID);
      setGroups(groupsData);
    } catch (error) {
      console.error('Error loading groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGroupPress = (group) => {
    setSelectedGroup(group);
    setGroupModalVisible(true);
  };

  const renderGroupIcon = (group) => {
    const iconName = categoryIconMap[group.groupCategory];

    if (iconName) {
      return (
        <MaterialCommunityIcons 
          name={iconName} 
          size={40} 
          color="#fff" 
        />
      );
    }

    return (
      <Text style={styles.groupLetter}>
        {group.groupTitle?.charAt(0).toUpperCase() || 'G'}
      </Text>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>All Groups</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading groups...</Text>
          </View>
        ) : groups.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="folder-outline" size={80} color="#ccc" />
            <Text style={styles.emptyTitle}>No Groups Yet</Text>
            <Text style={styles.emptySubtitle}>
              Create groups to organize your pantry items by category
            </Text>
            <TouchableOpacity 
              style={styles.createButton}
              onPress={() => router.back()}
            >
              <Text style={styles.createButtonText}>Go Back to Pantry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.countText}>
              {groups.length} {groups.length === 1 ? 'group' : 'groups'} total
            </Text>
            <View style={styles.groupsGrid}>
              {groups.map((group) => (
                <TouchableOpacity
                  key={group.groupID}
                  style={[styles.groupCard, { backgroundColor: group.groupColor || '#81A969' }]}
                  onPress={() => handleGroupPress(group)}
                  activeOpacity={0.8}
                >
                  <View style={styles.groupIconContainer}>
                    {renderGroupIcon(group)}
                  </View>
                  
                  <View style={styles.groupDetails}>
                    <Text style={styles.groupTitle} numberOfLines={2}>
                      {group.groupTitle || 'Untitled Group'}
                    </Text>
                    <Text style={styles.groupItemCount}>
                      {group.itemCount || 0} {(group.itemCount || 0) === 1 ? 'item' : 'items'}
                    </Text>
                    
                    {group.groupCategory && (
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryBadgeText} numberOfLines={1}>
                          {group.groupCategory}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.arrowContainer}>
                    <MaterialCommunityIcons name="chevron-right" size={24} color="#fff" />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* Group Items Modal */}
      <GroupItemsModal
        visible={groupModalVisible}
        onClose={() => {
          setGroupModalVisible(false);
          setSelectedGroup(null);
        }}
        group={selectedGroup}
        onItemPress={(item) => {
          setGroupModalVisible(false);
          router.back();
        }}
        onEditGroup={() => {
          setGroupModalVisible(false);
          router.back();
        }}
        onDeleteGroup={() => {
          setGroupModalVisible(false);
          loadGroups();
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  headerRight: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    color: '#999',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#999',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
  },
  createButton: {
    backgroundColor: '#81A969',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    shadowColor: '#81A969',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  countText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    fontWeight: '500',
  },
  groupsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  groupCard: {
    width: CARD_WIDTH,
    borderRadius: 16,
    padding: 16,
    minHeight: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    position: 'relative',
  },
  groupIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  groupLetter: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
  },
  groupDetails: {
    flex: 1,
  },
  groupTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    lineHeight: 24,
  },
  groupItemCount: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    marginBottom: 8,
  },
  categoryBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  categoryBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  arrowContainer: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default AllGroupsScreen;
