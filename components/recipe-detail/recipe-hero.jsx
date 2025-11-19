import React, { useState, useEffect } from 'react';
import { View, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { heightPercentageToDP as hp } from 'react-native-responsive-screen';
import recipeImageCacheService from '../../services/recipe-image-cache-service';

export default function RecipeHero({ image, recipeId = null, recipeName = null }) {
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
      const uri = await recipeImageCacheService.getCachedImageUrl(image, recipeId, recipeName);
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
          <ActivityIndicator size="large" color="#81A969" />
        </View>
      ) : (
        <Image
          source={{ uri: cachedImageUri || image }}
          style={styles.heroImage}
          resizeMode="cover"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  heroContainer: {
    position: 'relative',
    height: hp('35%'),
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
});
