import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

export default function HistoryTab({
  history,
  loading,
  onRecipePress,
  onRemoveHistory,
}) {
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
      <View 
        key={`history-${item.historyID}`}
        style={[
          styles.recipeCard,
          isLeftColumn ? styles.leftCard : styles.rightCard
        ]}
      >
        <TouchableOpacity
          style={styles.cardTouchable}
          onPress={() => onRecipePress(item)}
          activeOpacity={0.7}
        >
          <Image
            source={{ uri: imageUrl }}
            style={styles.recipeImage}
            resizeMode="cover"
            onError={(error) => {
              console.error('❌ History: Image load error for:', {
                recipeSource: item.recipeSource,
                recipeName: recipe?.label || recipe?.recipeName,
                imageUrl: imageUrl,
                error: error.nativeEvent?.error
              });
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

          <View style={styles.recipeInfo}>
            <Text style={styles.recipeTitle} numberOfLines={2}>
              {item.recipeName}
            </Text>

            <View style={styles.recipeMeta}>
              <Ionicons name="checkmark-circle" size={12} color="#4CAF50" />
              <Text style={styles.recipeMetaText}>
                {formatDate(item.completedAt)}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => onRemoveHistory(item)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="trash-outline" size={16} color="#999" />
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
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
    <View style={styles.container}>
      {renderRecipeGrid()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    backgroundColor: '#4CAF50',
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
  },
  leftCard: {
    marginRight: '2%',
  },
  rightCard: {
    marginLeft: '2%',
  },
  cardTouchable: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  recipeImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#f0f0f0',
  },
  aiBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(138, 43, 226, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 3,
  },
  aiBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '600',
  },
  substitutionBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 3,
  },
  substitutionBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '600',
  },
  recipeInfo: {
    padding: 12,
  },
  recipeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
    lineHeight: 18,
  },
  recipeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recipeMetaText: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: '500',
  },
  removeButton: {
    position: 'absolute',
    top: 128,
    right: 8,
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 6,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
});
