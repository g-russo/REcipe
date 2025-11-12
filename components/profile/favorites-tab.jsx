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

export default function FavoritesTab({
  recipes,
  loading,
  onRecipePress,
  onRemoveRecipe,
}) {
  // Debug: Log what we're receiving
  React.useEffect(() => {
    if (recipes.length > 0) {
      console.log('📋 FavoritesTab received recipes:', {
        count: recipes.length,
        firstRecipe: {
          hasRecipe: !!recipes[0].recipe,
          recipeKeys: recipes[0].recipe ? Object.keys(recipes[0].recipe) : [],
          recipeSource: recipes[0].recipeSource,
          topLevelKeys: Object.keys(recipes[0])
        }
      });
    }
  }, [recipes]);

  const renderRecipeCard = (item, index) => {
    // Debug: Log the actual item structure
    console.log('🎴 Rendering card for item:', {
      hasRecipe: !!item.recipe,
      hasRecipeData: !!item.recipeData,
      recipeSource: item.recipeSource,
      topLevelKeys: Object.keys(item),
      recipeKeys: item.recipe ? Object.keys(item.recipe).slice(0, 5) : [],
      recipeDataKeys: item.recipeData ? Object.keys(item.recipeData).slice(0, 5) : []
    });

    const recipe = item.recipe;
    const isAI = item.recipeSource === 'ai';
    const isLeftColumn = index % 2 === 0;

    // Get image URL - prioritize correct field based on source
    const imageUrl = isAI 
      ? (recipe?.recipeImage || recipe?.image)
      : (recipe?.image || recipe?.recipeImage);

    console.log('🖼️ Image extraction:', {
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
        key={item.recipeSource === 'ai' 
          ? `ai-${item.aiRecipeID}` 
          : `edamam-${item.edamamRecipeURI || item.favoriteID}`}
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
              console.error('❌ Favorites: Image load error for:', {
                recipeSource: item.recipeSource,
                recipeName: recipe?.label || recipe?.recipeName,
                imageUrl: imageUrl,
                error: error.nativeEvent?.error
              });
            }}
            onLoad={() => {
              console.log('✅ Favorites: Image loaded successfully for:', recipe?.label || recipe?.recipeName);
            }}
          />

          {/* AI Badge */}
          {isAI && (
            <View style={styles.aiBadge}>
              <Ionicons name="sparkles" size={10} color="#fff" />
              <Text style={styles.aiBadgeText}>AI</Text>
            </View>
          )}

          <View style={styles.recipeInfo}>
            <Text style={styles.recipeTitle} numberOfLines={2}>
              {recipe.recipeName || recipe.label}
            </Text>

            <View style={styles.recipeMeta}>
              <Ionicons name="time-outline" size={12} color="#999" />
              <Text style={styles.recipeMetaText}>
                {recipe.cookTime || recipe.totalTime || 'N/A'} min
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => onRemoveRecipe(item)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="heart" size={18} color="#FF6B6B" />
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B6B" />
        <Text style={styles.loadingText}>Loading favorites...</Text>
      </View>
    );
  }

  if (recipes.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="bookmark-outline" size={60} color="#ccc" />
        <Text style={styles.emptyText}>No favorites yet</Text>
        <Text style={styles.emptySubText}>
          Save recipes by tapping the heart icon
        </Text>
        <TouchableOpacity
          style={styles.searchButton}
          onPress={() => router.push('/recipe-search')}
        >
          <Text style={styles.searchButtonText}>Search Recipes</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Group recipes into rows of 2
  const renderRecipeGrid = () => {
    console.log('🏗️ Building grid with', recipes.length, 'recipes');
    const rows = [];
    for (let i = 0; i < recipes.length; i += 2) {
      rows.push(
        <View key={`row-${i}`} style={styles.recipeRow}>
          {renderRecipeCard(recipes[i], i)}
          {recipes[i + 1] && renderRecipeCard(recipes[i + 1], i + 1)}
        </View>
      );
    }
    console.log('✅ Grid built with', rows.length, 'rows');
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
    backgroundColor: '#FF6B6B',
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
    right: 8,
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
    color: '#999',
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
