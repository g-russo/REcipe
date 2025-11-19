import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Modal,
  Animated,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { router } from 'expo-router';
import RecipeSchedulingService from '../../services/recipe-scheduling-service';

const ScheduledTab = ({ scheduledRecipes, onDelete, onRefresh }) => {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCompletedModal, setShowCompletedModal] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Animation refs
  const deleteModalScale = useRef(new Animated.Value(0)).current;
  const deleteModalOpacity = useRef(new Animated.Value(0)).current;
  const completedModalScale = useRef(new Animated.Value(0)).current;
  const completedModalOpacity = useRef(new Animated.Value(0)).current;
  const handleRecipePress = (recipe) => {
    // Navigate to recipe details
    router.push({
      pathname: '/recipe-detail',
      params: {
        recipeData: JSON.stringify(recipe.recipeData)
      }
    });
  };

  const handleDeleteSchedule = (scheduleID, recipeName) => {
    setSelectedRecipe({ scheduleID, recipeName });
    setShowDeleteModal(true);
    
    // Animate modal entrance
    deleteModalScale.setValue(0.7);
    deleteModalOpacity.setValue(0);
    
    Animated.parallel([
      Animated.spring(deleteModalScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 10,
      }),
      Animated.timing(deleteModalOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeDeleteModal = () => {
    Animated.parallel([
      Animated.timing(deleteModalScale, {
        toValue: 0.7,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(deleteModalOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowDeleteModal(false);
      setSelectedRecipe(null);
    });
  };

  const confirmDelete = async () => {
    if (!selectedRecipe) return;
    
    setIsProcessing(true);
    const result = await RecipeSchedulingService.deleteScheduledRecipe(selectedRecipe.scheduleID);
    setIsProcessing(false);
    
    if (result.success) {
      closeDeleteModal();
      setTimeout(() => onRefresh(), 200);
    }
  };

  const handleMarkCompleted = async (scheduleID, recipeName) => {
    setSelectedRecipe({ scheduleID, recipeName });
    setShowCompletedModal(true);
    
    // Animate modal entrance
    completedModalScale.setValue(0.7);
    completedModalOpacity.setValue(0);
    
    Animated.parallel([
      Animated.spring(completedModalScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 10,
      }),
      Animated.timing(completedModalOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeCompletedModal = () => {
    Animated.parallel([
      Animated.timing(completedModalScale, {
        toValue: 0.7,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(completedModalOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowCompletedModal(false);
      setSelectedRecipe(null);
    });
  };

  const confirmCompleted = async () => {
    if (!selectedRecipe) return;
    
    setIsProcessing(true);
    const result = await RecipeSchedulingService.markAsCompleted(selectedRecipe.scheduleID);
    setIsProcessing(false);
    
    if (result.success) {
      closeCompletedModal();
      setTimeout(() => onRefresh(), 200);
    }
  };

  const formatScheduledDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const diffTime = date - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 7) return `In ${diffDays} days`;
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    });
  };

  const getDaysUntil = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const diffTime = date - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const renderScheduledRecipe = ({ item }) => {
    const recipe = item.recipeData;
    const imageUrl = recipe.image || recipe.images?.[0] || 'https://via.placeholder.com/150';
    const daysUntil = getDaysUntil(item.scheduledDate);
    const isToday = daysUntil === 0;
    const isPast = daysUntil < 0;

    return (
      <View style={styles.recipeCard}>
        <TouchableOpacity
          style={styles.recipeContent}
          onPress={() => handleRecipePress(item)}
          activeOpacity={0.8}
        >
          <View style={styles.recipeImageContainer}>
            <Image source={{ uri: imageUrl }} style={styles.recipeImage} />
            {isToday && (
              <View style={[styles.statusBadge, { backgroundColor: '#FF6B6B' }]}>
                <Text style={styles.statusBadgeText}>TODAY</Text>
              </View>
            )}
            {isPast && (
              <View style={[styles.statusBadge, { backgroundColor: '#999' }]}>
                <Text style={styles.statusBadgeText}>PAST</Text>
              </View>
            )}
          </View>

          <View style={styles.recipeInfo}>
            <Text style={styles.recipeName} numberOfLines={2}>
              {item.recipeName}
            </Text>
            
            <View style={styles.scheduleDateContainer}>
              <Ionicons 
                name="calendar" 
                size={wp('4%')} 
                color={isToday ? '#FF6B6B' : isPast ? '#999' : '#81A969'} 
              />
              <Text style={styles.scheduleDateText}>
                {formatScheduledDate(item.scheduledDate)}
              </Text>
            </View>

            {isToday && (
              <View style={styles.statusContainer}>
                <Ionicons name="flame" size={wp('4%')} color="#FF6B6B" />
                <Text style={[styles.statusText, { color: '#FF6B6B' }]}>Cook today!</Text>
              </View>
            )}
            {isPast && (
              <View style={styles.statusContainer}>
                <Ionicons name="time-outline" size={wp('4%')} color="#999" />
                <Text style={[styles.statusText, { color: '#999' }]}>Past due</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        <View style={styles.recipeActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonDivider]}
            onPress={(e) => {
              e.stopPropagation();
              handleDeleteSchedule(item.scheduleID, item.recipeName);
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: '#FFEBEE' }]}>
              <Ionicons name="trash" size={wp('4.5%')} color="#FF6B6B" />
            </View>
            <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Delete</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              handleMarkCompleted(item.scheduleID, item.recipeName);
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: '#E8F5E9' }]}>
              <Ionicons name="checkmark-circle" size={wp('4.5%')} color="#81A969" />
            </View>
            <Text style={[styles.actionButtonText, styles.completeButtonText]}>Mark as Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (!scheduledRecipes || scheduledRecipes.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="calendar-outline" size={64} color="#ccc" />
        <Text style={styles.emptyTitle}>No Scheduled Recipes</Text>
        <Text style={styles.emptySubtitle}>
          Schedule recipes to get reminded when it's time to cook!
        </Text>
      </View>
    );
  }

  return (
    <>
      <View style={styles.listContainer}>
        {scheduledRecipes.map((item) => (
          <View key={item.scheduleID}>
            {renderScheduledRecipe({ item })}
          </View>
        ))}
      </View>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        animationType="none"
        transparent={true}
        onRequestClose={closeDeleteModal}
      >
        <TouchableWithoutFeedback onPress={closeDeleteModal}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <Animated.View style={[
                styles.modalContent,
                {
                  opacity: deleteModalOpacity,
                  transform: [{ scale: deleteModalScale }]
                }
              ]}>
                <View style={styles.modalIconContainer}>
                  <View style={[styles.modalIconCircle, { backgroundColor: '#FFEBEE' }]}>
                    <Ionicons name="trash" size={40} color="#FF6B6B" />
                  </View>
                </View>

                <Text style={styles.modalTitle}>Delete Schedule?</Text>
                
                <Text style={styles.modalMessage}>
                  Are you sure you want to remove{'\n'}
                  <Text style={styles.modalRecipeName}>"{selectedRecipe?.recipeName}"</Text>
                  {'\n'}from your schedule?
                </Text>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalCancelButton}
                    onPress={closeDeleteModal}
                    activeOpacity={0.7}
                    disabled={isProcessing}
                  >
                    <Text style={styles.modalCancelButtonText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalDeleteButton, isProcessing && styles.modalButtonDisabled]}
                    onPress={confirmDelete}
                    activeOpacity={0.8}
                    disabled={isProcessing}
                  >
                    <Ionicons name="trash" size={20} color="#fff" />
                    <Text style={styles.modalDeleteButtonText}>
                      {isProcessing ? 'Deleting...' : 'Delete'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Mark Completed Modal */}
      <Modal
        visible={showCompletedModal}
        animationType="none"
        transparent={true}
        onRequestClose={closeCompletedModal}
      >
        <TouchableWithoutFeedback onPress={closeCompletedModal}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <Animated.View style={[
                styles.modalContent,
                {
                  opacity: completedModalOpacity,
                  transform: [{ scale: completedModalScale }]
                }
              ]}>
                <View style={styles.modalIconContainer}>
                  <View style={[styles.modalIconCircle, { backgroundColor: '#E8F5E9' }]}>
                    <Ionicons name="checkmark-circle" size={40} color="#81A969" />
                  </View>
                </View>

                <Text style={styles.modalTitle}>Mark as Completed?</Text>
                
                <Text style={styles.modalMessage}>
                  Did you cook{'\n'}
                  <Text style={styles.modalRecipeName}>"{selectedRecipe?.recipeName}"</Text>?
                </Text>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalCancelButton}
                    onPress={closeCompletedModal}
                    activeOpacity={0.7}
                    disabled={isProcessing}
                  >
                    <Text style={styles.modalCancelButtonText}>Not Yet</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalConfirmButton, isProcessing && styles.modalButtonDisabled]}
                    onPress={confirmCompleted}
                    activeOpacity={0.8}
                    disabled={isProcessing}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.modalConfirmButtonText}>
                      {isProcessing ? 'Processing...' : 'Yes, I Did!'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  listContainer: {
    padding: wp('4%'),
  },
  recipeCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: hp('2%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  recipeContent: {
    flexDirection: 'row',
    padding: wp('4%'),
  },
  recipeImageContainer: {
    position: 'relative',
    marginRight: wp('3%'),
  },
  recipeImage: {
    width: wp('24%'),
    height: wp('24%'),
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
  },
  statusBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#81A969',
    borderRadius: 12,
    paddingHorizontal: wp('2%'),
    paddingVertical: hp('0.3%'),
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: wp('2.8%'),
    fontWeight: 'bold',
  },
  recipeInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  recipeName: {
    fontSize: wp('4.2%'),
    fontWeight: 'bold',
    color: '#333',
    marginBottom: hp('0.5%'),
  },
  scheduleDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('0.5%'),
  },
  scheduleDateText: {
    fontSize: wp('3.5%'),
    color: '#666',
    marginLeft: wp('1%'),
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: wp('3.2%'),
    color: '#81A969',
    marginLeft: wp('1%'),
  },
  recipeActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('1.5%'),
  },
  actionButtonDivider: {
    borderRightWidth: 1,
    borderRightColor: '#f0f0f0',
  },
  actionIconCircle: {
    width: wp('8%'),
    height: wp('8%'),
    borderRadius: wp('4%'),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp('2%'),
  },
  actionButtonText: {
    fontSize: wp('3.5%'),
    fontWeight: '600',
  },
  deleteButtonText: {
    color: '#FF6B6B',
  },
  completeButtonText: {
    color: '#81A969',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('10%'),
  },
  emptyText: {
    fontSize: wp('4%'),
    color: '#999',
    marginTop: hp('2%'),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: wp('6%'),
    width: wp('85%'),
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  modalIconContainer: {
    alignItems: 'center',
    marginBottom: hp('2%'),
  },
  modalIconCircle: {
    width: wp('20%'),
    height: wp('20%'),
    borderRadius: wp('10%'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: wp('5.5%'),
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: hp('1.5%'),
  },
  modalMessage: {
    fontSize: wp('4%'),
    color: '#666',
    textAlign: 'center',
    lineHeight: wp('5.5%'),
    marginBottom: hp('3%'),
  },
  modalRecipeName: {
    fontWeight: 'bold',
    color: '#81A969',
  },
  modalActions: {
    flexDirection: 'row',
    gap: wp('3%'),
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: hp('1.8%'),
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelButtonText: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#666',
  },
  modalDeleteButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: hp('1.8%'),
    borderRadius: 12,
    backgroundColor: '#FF6B6B',
    alignItems: 'center',
    justifyContent: 'center',
    gap: wp('2%'),
  },
  modalDeleteButtonText: {
    fontSize: wp('4%'),
    fontWeight: 'bold',
    color: '#fff',
  },
  modalConfirmButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: hp('1.8%'),
    borderRadius: 12,
    backgroundColor: '#81A969',
    alignItems: 'center',
    justifyContent: 'center',
    gap: wp('2%'),
  },
  modalConfirmButtonText: {
    fontSize: wp('4%'),
    fontWeight: 'bold',
    color: '#fff',
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },
});

export default ScheduledTab;
