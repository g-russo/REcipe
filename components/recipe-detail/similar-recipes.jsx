import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function SimilarRecipes({ recipes, loading, onRecipePress }) {
  return (
    <View style={styles.moreLikeSection}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>More Like This</Text>
        <TouchableOpacity>
          <Text style={styles.seeAllText}>See All ({recipes.length})</Text>
        </TouchableOpacity>
      </View>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#4CAF50" />
          <Text style={styles.loadingText}>Finding great recipes...</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.similarRecipesContainer}>
          {recipes.map((recipe, index) => (
            <TouchableOpacity 
              key={`${recipe.id || recipe.uri}_${index}`} 
              style={styles.similarRecipeCard}
              onPress={() => onRecipePress(recipe)}
            >
              <Image source={{ uri: recipe.image }} style={styles.similarRecipeImage} />
              <View style={styles.similarRecipeInfo}>
                <Text style={styles.similarRecipeTitle} numberOfLines={2}>
                  {recipe.label}
                </Text>
                <View style={styles.similarRecipeMeta}>
                  <Ionicons name="time-outline" size={12} color="#666" />
                  <Text style={styles.similarRecipeTime}>
                    {recipe.totalTime || '30'} min
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
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
    marginBottom: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  seeAllText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
  },
  similarRecipesContainer: {
    marginLeft: -20,
  },
  similarRecipeCard: {
    marginLeft: 20,
    width: 140,
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 5,
    overflow: 'hidden',
  },
  similarRecipeImage: {
    width: '100%',
    height: 100,
    resizeMode: 'cover',
  },
  similarRecipeInfo: {
    padding: 8,
  },
  similarRecipeTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    lineHeight: 16,
  },
  similarRecipeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  similarRecipeTime: {
    fontSize: 10,
    color: '#666',
    marginLeft: 4,
  },
  noRecipesContainer: {
    marginLeft: 20,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noRecipesText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
});
