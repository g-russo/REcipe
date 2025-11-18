/**
 * CachedImage Component
 * 
 * Automatically uses Supabase Storage cached images for faster loading
 * Falls back to original URL if caching fails
 */

import React, { useState, useEffect } from 'react';
import { Image, ActivityIndicator, View } from 'react-native';
import recipeImageCacheService from '../../services/recipe-image-cache-service';

export default function CachedImage({ 
  uri, 
  style, 
  resizeMode = 'cover',
  showLoader = true,
  fallbackIcon = null,
  ...props 
}) {
  const [cachedUri, setCachedUri] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadImage();
  }, [uri]);

  const loadImage = async () => {
    if (!uri) {
      setLoading(false);
      setError(true);
      return;
    }

    try {
      // Get Supabase-cached image URL
      const cached = await recipeImageCacheService.getCachedImageUrl(uri);
      setCachedUri(cached);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load cached image:', err);
      setCachedUri(uri); // Fallback to original
      setLoading(false);
    }
  };

  const handleError = () => {
    setError(true);
    setLoading(false);
  };

  const handleLoadEnd = () => {
    setLoading(false);
  };

  if (error && fallbackIcon) {
    return (
      <View style={[style, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f0f0' }]}>
        {fallbackIcon}
      </View>
    );
  }

  return (
    <>
      {loading && showLoader && (
        <View style={[style, { position: 'absolute', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f0f0' }]}>
          <ActivityIndicator size="small" color="#4CAF50" />
        </View>
      )}
      <Image
        source={{ uri: cachedUri || uri }}
        style={style}
        resizeMode={resizeMode}
        onError={handleError}
        onLoadEnd={handleLoadEnd}
        {...props}
      />
    </>
  );
}
