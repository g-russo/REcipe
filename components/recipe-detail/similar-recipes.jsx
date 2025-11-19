import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';

// Cache for similar recipe images with 5 minute TTL
const imageCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

const SimilarRecipeCard = ({ recipe, onRecipePress }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Check cache first
  const cacheKey = recipe.image;
  const cached = imageCache.get(cacheKey);
  const now = Date.now();

  // Use cached image if valid
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    // Cache is still valid
  } else if (cached) {
    // Cache expired, remove it
    imageCache.delete(cacheKey);
  }

  const handleImageLoad = () => {
    setImageLoaded(true);
    // Cache the successfully loaded image
    imageCache.set(cacheKey, {
      uri: recipe.image,
      timestamp: Date.now(),
    });
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoaded(true);
  };

  return (
    <TouchableOpacity
      style={styles.similarRecipeCard}
      onPress={() => onRecipePress(recipe)}
      activeOpacity={0.9}
    >
      <View style={styles.imageContainer}>
        {!imageLoaded && !imageError && (
          <View style={styles.imagePlaceholder}>
            <ActivityIndicator size="small" color="#81A969" />
          </View>
        )}
        <Image 
          source={{ uri: recipe.image }} 
          style={[
            styles.similarRecipeImage,
            { opacity: imageLoaded ? 1 : 0 }
          ]}
          onLoad={handleImageLoad}
          onError={handleImageError}
        />
      </View>
      <View style={styles.similarRecipeInfo}>
        <Text style={styles.similarRecipeTitle} numberOfLines={2}>
          {recipe.label}
        </Text>
        <View style={styles.similarRecipeMeta}>
          <Ionicons name="time-outline" size={wp('3.5%')} color="#7f8c8d" />
          <Text style={styles.similarRecipeTime}>
            {recipe.totalTime || '30'} min
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default function SimilarRecipes({ recipes, loading, onRecipePress }) {
  return (
    <View style={styles.moreLikeSection}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>More Like This</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#81A969" />
          <Text style={styles.loadingText}>Finding great recipes...</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.similarRecipesContainer}
          contentContainerStyle={styles.similarRecipesContent}
        >
          {recipes.map((recipe, index) => (
            <SimilarRecipeCard
              key={`${recipe.id || recipe.uri}_${index}`}
              recipe={recipe}
              onRecipePress={onRecipePress}
            />
          ))}

          {/* Show message if no similar recipes found */}
          {recipes.length === 0 && (
            <View style={styles.noRecipesContainer}>
              <Text style={styles.noRecipesText}>No similar recipes found. Try searching for more!</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  moreLikeSection: {
    marginBottom: 0,
    paddingBottom: hp('2%'),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp('2%'),
  },
  sectionTitle: {
    fontSize: wp('5%'),
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  seeAllText: {
    fontSize: wp('3.5%'),
    color: '#81A969',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: hp('3%'),
  },
  loadingText: {
    fontSize: wp('3.8%'),
    color: '#7f8c8d',
    marginTop: hp('1.5%'),
    fontWeight: '500',
  },
  similarRecipesContainer: {
    marginLeft: wp('-5%'),
  },
  similarRecipesContent: {
    paddingRight: wp('5%'),
    paddingBottom: hp('2%'),
  },
  similarRecipeCard: {
    marginLeft: wp('5%'),
    width: wp('35%'),
    backgroundColor: '#fff',
    borderRadius: wp('4%'),
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    marginBottom: hp('1%'),
  },
  imageContainer: {
    margin: wp('2.5%'),
    borderRadius: wp('3%'),
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    position: 'relative',
  },
  imagePlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    zIndex: 1,
  },
  similarRecipeImage: {
    width: '100%',
    height: hp('12%'),
    resizeMode: 'cover',
    backgroundColor: '#e0e0e0',
  },
  similarRecipeInfo: {
    paddingHorizontal: wp('3%'),
    paddingBottom: wp('3%'),
    paddingTop: 0,
  },
  similarRecipeTitle: {
    fontSize: wp('3.5%'),
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: hp('0.8%'),
    lineHeight: wp('4.5%'),
  },
  similarRecipeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  similarRecipeTime: {
    fontSize: wp('3%'),
    color: '#7f8c8d',
    marginLeft: wp('1.5%'),
    fontWeight: '500',
  },
  noRecipesContainer: {
    marginLeft: wp('5%'),
    padding: wp('5%'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  noRecipesText: {
    fontSize: wp('3.5%'),
    color: '#7f8c8d',
    fontStyle: 'italic',
  },
});
