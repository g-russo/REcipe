import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  Modal,
  Animated,
  TouchableWithoutFeedback,
  ScrollView,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import EdamamService from '../../services/edamam-service';
import ImageGenerationService from '../../services/image-generation-service';

export default function HistoryTab({
  history,
  loading,
  onRecipePress,
  onRemoveHistory,
  onRefresh,
}) {
  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    if (onRefresh) {
      await onRefresh();
    }
    setRefreshing(false);
  };
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays - 1} days ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const [showRemoveModal, setShowRemoveModal] = React.useState(false);
  const [selectedRecipe, setSelectedRecipe] = React.useState(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const removeModalScale = React.useRef(new Animated.Value(0)).current;
  const removeModalOpacity = React.useRef(new Animated.Value(0)).current;
  
  // Track failed images and their fresh URLs
  const [imageRetries, setImageRetries] = React.useState({});
  const [freshImageUrls, setFreshImageUrls] = React.useState({});

  const openRemoveModal = (item) => {
    setSelectedRecipe(item);
    setShowRemoveModal(true);
    removeModalScale.setValue(0.7);
    removeModalOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(removeModalScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 10,
      }),
      Animated.timing(removeModalOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeRemoveModal = () => {
    Animated.parallel([
      Animated.timing(removeModalScale, {
        toValue: 0.7,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(removeModalOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowRemoveModal(false);
      setSelectedRecipe(null);
    });
  };

  const confirmRemove = async () => {
    if (!selectedRecipe) return;
    setIsProcessing(true);
    await onRemoveHistory(selectedRecipe);
    setIsProcessing(false);
    closeRemoveModal();
  };

  const renderRecipeCard = (item, index) => {
    console.log('🎴 History: Rendering card for item:', {
      hasRecipe: !!item.recipe,
      recipeSource: item.recipeSource,
      topLevelKeys: Object.keys(item),
      recipeKeys: item.recipe ? Object.keys(item.recipe).slice(0, 5) : []
    });

    const recipe = item.recipe;
    const isAI = item.recipeSource === 'ai';
    const isLeftColumn = index % 2 === 0;

    // Get image URL - prioritize correct field based on source
    const imageUrl = isAI 
      ? (recipe?.recipeImage || recipe?.image)
      : (recipe?.image || recipe?.recipeImage);

    console.log('🖼️ History: Image extraction:', {
      index,
      isAI,
      recipeSource: item.recipeSource,
      hasRecipe: !!recipe,
      'recipe?.image': recipe?.image,
      'recipe?.recipeImage': recipe?.recipeImage,
      finalImageUrl: imageUrl
    });

    // Debug logging for image issues
    if (!imageUrl) {
      console.log('⚠️ Missing image for recipe:', {
        source: item.recipeSource,
        label: recipe?.label || recipe?.recipeName,
        hasRecipe: !!recipe,
        hasImage: !!recipe?.image,
        hasRecipeImage: !!recipe?.recipeImage,
        recipeKeys: recipe ? Object.keys(recipe) : []
      });
    }

    return (
      <View key={`history-${item.historyID}`}
        style={styles.recipeCard}
      >
        <TouchableOpacity
          style={styles.cardTouchable}
          onPress={() => onRecipePress(item)}
          activeOpacity={0.7}
        >
          {/* Image Container with inset rounded rectangle */}
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: freshImageUrls[item.historyID] || imageUrl }}
              style={styles.recipeImage}
              resizeMode="cover"
              onError={async (error) => {
                console.error('❌ History: Image load error for:', {
                  recipeSource: item.recipeSource,
                  recipeName: recipe?.label || recipe?.recipeName,
                  imageUrl: freshImageUrls[item.historyID] || imageUrl,
                  error: error.nativeEvent?.error,
                  retryCount: imageRetries[item.historyID] || 0
                });
                
                // Only retry once per item
                const retryCount = imageRetries[item.historyID] || 0;
                if (retryCount < 1 && recipe?.uri) {
                  console.log('🔄 Attempting to fetch fresh image URL from Edamam API...');
                  setImageRetries(prev => ({ ...prev, [item.historyID]: retryCount + 1 }));
                  
                  try {
                    // Get fresh recipe data from Edamam API with new AWS signature
                    const result = await EdamamService.getRecipeByUri(recipe.uri);
                    
                    if (result.success && result.recipe?.image) {
                      console.log('✅ Got fresh image URL from Edamam API');
                      
                      // Download and store the fresh image permanently
                      const permanentUrl = await ImageGenerationService.downloadAndStoreEdamamImage(
                        result.recipe.image,
                        recipe.uri
                      );
                      
                      if (permanentUrl) {
                        console.log('✅ Fresh image stored permanently:', permanentUrl);
                        setFreshImageUrls(prev => ({ ...prev, [item.historyID]: permanentUrl }));
                      } else {
                        // Use fresh URL from API even if storage fails
                        console.log('⚠️ Storage failed, using fresh API URL:', result.recipe.image);
                        setFreshImageUrls(prev => ({ ...prev, [item.historyID]: result.recipe.image }));
                      }
                    } else {
                      console.warn('⚠️ Could not get fresh image from API');
                    }
                  } catch (retryError) {
                    console.error('❌ Failed to fetch fresh image:', retryError);
                  }
                }
              }}
              onLoad={() => {
                console.log('✅ History: Image loaded successfully for:', recipe?.label || recipe?.recipeName);
              }}
            />

            {/* AI Badge */}
            {isAI && (
              <View style={styles.aiBadge}>
                <Ionicons name="sparkles" size={10} color="#fff" />
                <Text style={styles.aiBadgeText}>AI</Text>
              </View>
            )}

            {/* Substitution Badge */}
            {item.hasSubstitutions && (
              <View style={styles.substitutionBadge}>
                <Ionicons name="swap-horizontal" size={10} color="#fff" />
                <Text style={styles.substitutionBadgeText}>SUB</Text>
              </View>
            )}
          </View>

          <View style={styles.recipeInfo}>
            <Text style={styles.recipeTitle} numberOfLines={2}>
              {item.recipeName}
            </Text>

            <View style={styles.recipeMeta}>
              <Ionicons name="checkmark-circle" size={12} color="#81A969" />
              <Text style={styles.recipeMetaText}>
                {formatDate(item.completedAt)}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => openRemoveModal(item)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="trash-outline" size={18} color="#666" />
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#81A969" />
        <Text style={styles.loadingText}>Loading history...</Text>
      </View>
    );
  }

  if (history.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="time-outline" size={60} color="#ccc" />
        <Text style={styles.emptyText}>No cooking history</Text>
        <Text style={styles.emptySubText}>
          Completed recipes will appear here
        </Text>
        <TouchableOpacity
          style={styles.searchButton}
          onPress={() => router.push('/recipe-search')}
        >
          <Text style={styles.searchButtonText}>Find Recipes</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Group recipes into rows of 2
  const renderRecipeGrid = () => {
    const rows = [];
    for (let i = 0; i < history.length; i += 2) {
      rows.push(
        <View key={`row-${i}`} style={styles.recipeRow}>
          {renderRecipeCard(history[i], i)}
          {history[i + 1] && renderRecipeCard(history[i + 1], i + 1)}
        </View>
      );
    }
    return rows;
  };

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#81A969']}
            tintColor="#81A969"
          />
        }
      >
        {renderRecipeGrid()}
      </ScrollView>

      <Modal
        visible={showRemoveModal}
        animationType="none"
        transparent={true}
        onRequestClose={closeRemoveModal}
      >
        <TouchableWithoutFeedback onPress={closeRemoveModal}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <Animated.View style={[
                styles.modalContent,
                {
                  opacity: removeModalOpacity,
                  transform: [{ scale: removeModalScale }]
                }
              ]}>
                <View style={styles.modalIconContainer}>
                  <View style={[styles.modalIconCircle, { backgroundColor: '#FFEBEE' }]}>
                    <Ionicons name="trash" size={40} color="#FF6B6B" />
                  </View>
                </View>
                <Text style={styles.modalTitle}>Remove History?</Text>
                <Text style={styles.modalMessage}>
                  Are you sure you want to remove
                  <Text style={styles.modalRecipeName}> "{selectedRecipe?.recipe?.label || selectedRecipe?.recipe?.recipeName}"</Text>
                  from your history?
                </Text>
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalCancelButton}
                    onPress={closeRemoveModal}
                    activeOpacity={0.7}
                    disabled={isProcessing}
                  >
                    <Text style={styles.modalCancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalDeleteButton, isProcessing && styles.modalButtonDisabled]}
                    onPress={confirmRemove}
                    activeOpacity={0.8}
                    disabled={isProcessing}
                  >
                    <Ionicons name="trash" size={20} color="#fff" />
                    <Text style={styles.modalDeleteButtonText}>
                      {isProcessing ? 'Removing...' : 'Remove'}
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
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#555',
    marginTop: 16,
  },
  emptySubText: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
  },
  searchButton: {
    backgroundColor: '#81A969',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 16,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  recipeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  recipeCard: {
    width: '48%',
    height: 220, // Fixed height for consistency
  },
  leftCard: {
    marginRight: '2%',
  },
  rightCard: {
    marginLeft: '2%',
  },
  cardTouchable: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  imageContainer: {
    margin: 10,
    borderRadius: 12,
    overflow: 'hidden',
    height: 120,
    backgroundColor: '#f0f0f0',
  },
  recipeImage: {
    width: '100%',
    height: '100%',
  },
  aiBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(138, 43, 226, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 3,
  },
  aiBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  substitutionBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 3,
  },
  substitutionBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  recipeInfo: {
    padding: 12,
    paddingTop: 8,
    flex: 1,
  },
  recipeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
    lineHeight: 18,
    height: 36, // Fixed height for 2 lines
  },
  recipeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 'auto',
  },
  recipeMetaText: {
    fontSize: 11,
    color: '#81A969',
    fontWeight: '500',
  },
  removeButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 18,
    padding: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
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
    padding: 32,
    width: '85%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  modalIconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  modalIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  modalRecipeName: {
    fontWeight: 'bold',
    color: '#81A969',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 16,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  modalDeleteButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#FF6B6B',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  modalDeleteButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },
});
