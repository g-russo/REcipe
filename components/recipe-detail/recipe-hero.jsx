import React, { useState, useEffect } from 'react';
import { View, Image, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import recipeImageCacheService from '../../services/recipe-image-cache-service';

export default function RecipeHero({ image, onBack, onToggleFavorite, isFavorite, savingFavorite }) {
  const [cachedImageUri, setCachedImageUri] = useState(null);
  const [imageLoading, setImageLoading] = useState(true);

  useEffect(() => {
    loadCachedImage();
  }, [image]);

  const loadCachedImage = async () => {
    if (!image) {
      setImageLoading(false);
      return;
    }

    try {
      const uri = await recipeImageCacheService.getCachedImageUrl(image);
      setCachedImageUri(uri);
    } catch (error) {
      console.error('Error loading cached image:', error);
      setCachedImageUri(image); // Fallback to original
    } finally {
      setImageLoading(false);
    }
  };

  return (
    <View style={styles.heroContainer}>
      {imageLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
        </View>
      ) : (
        <Image 
          source={{ uri: cachedImageUri || image }} 
          style={styles.heroImage}
          resizeMode="cover"
        />
      )}
      
      {/* Header Overlay */}
      <View style={styles.headerOverlay}>
        <TouchableOpacity style={styles.headerButton} onPress={onBack}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.headerButton} 
          onPress={onToggleFavorite}
          disabled={savingFavorite}
        >
          <Ionicons 
            name={isFavorite ? "heart" : "heart-outline"} 
            size={24} 
            color={isFavorite ? "#ff4757" : "#fff"} 
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroContainer: {
    position: 'relative',
    height: 300,
  },
  loadingContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  headerOverlay: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
