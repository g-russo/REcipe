import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  ScrollView,
  SafeAreaView,
  ActivityIndicator
} from 'react-native';
import EdamamService from '../services/edamamService';

const RecipeSearch = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    cuisineType: '',
    mealType: '',
    dishType: '',
    health: [],
    diet: []
  });
  const [showFilters, setShowFilters] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    // Load some popular recipes on component mount
    handleSearch('popular dinner recipes');
  }, []);

  const handleSearch = async (query = searchQuery) => {
    if (!query.trim()) {
      Alert.alert('Search Required', 'Please enter a recipe name or ingredient to search for.');
      return;
    }

    setLoading(true);
    setHasSearched(true);

    try {
      console.log('🔍 Searching for recipes:', query);
      
      const searchOptions = {
        from: 0,
        to: 20,
        ...filters
      };

      const result = await EdamamService.searchRecipes(query, searchOptions);

      if (result.success) {
        setRecipes(result.data.recipes);
        console.log(`✅ Found ${result.data.recipes.length} recipes`);
      } else {
        Alert.alert('Search Error', result.error || 'Failed to search recipes. Please try again.');
        setRecipes([]);
      }
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('Error', 'Something went wrong while searching. Please try again.');
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSearch = (query) => {
    setSearchQuery(query);
    handleSearch(query);
  };

  const renderRecipeCard = ({ item }) => (
    <TouchableOpacity style={styles.recipeCard} onPress={() => handleRecipePress(item)}>
      <Image 
        source={{ uri: item.image }} 
        style={styles.recipeImage}
        resizeMode="cover"
      />
      <View style={styles.recipeInfo}>
        <Text style={styles.recipeTitle} numberOfLines={2}>{item.label}</Text>
        <Text style={styles.recipeSource}>by {item.source}</Text>
        
        <View style={styles.recipeStats}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>⏱️ {item.totalTime || 'N/A'}min</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>🔥 {item.calories} cal</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>👥 {item.yield} servings</Text>
          </View>
        </View>

        {item.dietLabels.length > 0 && (
          <View style={styles.labelsContainer}>
            {item.dietLabels.slice(0, 2).map((label, index) => (
              <View key={index} style={styles.dietLabel}>
                <Text style={styles.labelText}>{label}</Text>
              </View>
            ))}
          </View>
        )}

        {item.healthLabels.length > 0 && (
          <View style={styles.labelsContainer}>
            {item.healthLabels.slice(0, 3).map((label, index) => (
              <View key={index} style={styles.healthLabel}>
                <Text style={styles.labelText}>{label}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const handleRecipePress = (recipe) => {
    // For now, show basic recipe info - you can navigate to a detailed view later
    Alert.alert(
      recipe.label,
      `Source: ${recipe.source}\nCooking Time: ${recipe.totalTime || 'N/A'} minutes\nCalories: ${recipe.calories}\nServings: ${recipe.yield}\n\nIngredients:\n${recipe.ingredientLines.slice(0, 5).join('\n')}${recipe.ingredientLines.length > 5 ? '\n...' : ''}`,
      [
        { text: 'Close', style: 'cancel' },
        { text: 'View Full Recipe', onPress: () => console.log('Navigate to full recipe:', recipe.url) }
      ]
    );
  };

  const quickSearches = EdamamService.getPopularSearches();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Recipe Search</Text>
        <Text style={styles.headerSubtitle}>Discover curated recipes from top sources</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search for recipes or ingredients..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={() => handleSearch()}
          returnKeyType="search"
        />
        <TouchableOpacity 
          style={styles.searchButton} 
          onPress={() => handleSearch()}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.searchButtonText}>🔍</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Curated Sources Info */}
      <View style={styles.curatedInfo}>
        <Text style={styles.curatedText}>
          ✨ Showing curated recipes from Food Network, BBC Good Food, Epicurious & more
        </Text>
      </View>

      {/* Quick Search Suggestions */}
      {!hasSearched && (
        <View style={styles.quickSearchContainer}>
          <Text style={styles.sectionTitle}>Popular Searches</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {quickSearches.map((query, index) => (
              <TouchableOpacity
                key={index}
                style={styles.quickSearchChip}
                onPress={() => handleQuickSearch(query)}
              >
                <Text style={styles.quickSearchText}>{query}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Results */}
      {hasSearched && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsText}>
            {loading ? 'Searching...' : `Found ${recipes.length} recipes`}
          </Text>
        </View>
      )}

      {/* Recipe List */}
      <FlatList
        data={recipes}
        renderItem={renderRecipeCard}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.recipeList}
        numColumns={1}
        ListEmptyComponent={
          !loading && hasSearched ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No recipes found</Text>
              <Text style={styles.emptySubtext}>Try a different search term</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchInput: {
    flex: 1,
    height: 45,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 25,
    paddingHorizontal: 20,
    marginRight: 10,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
  },
  searchButton: {
    width: 45,
    height: 45,
    backgroundColor: '#3498db',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonText: {
    fontSize: 18,
    color: '#fff',
  },
  quickSearchContainer: {
    backgroundColor: '#fff',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  quickSearchChip: {
    backgroundColor: '#ecf0f1',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginLeft: 10,
    marginRight: 5,
  },
  quickSearchText: {
    fontSize: 14,
    color: '#2c3e50',
  },
  resultsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  resultsText: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  recipeList: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  recipeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: 'hidden',
  },
  recipeImage: {
    width: '100%',
    height: 200,
  },
  recipeInfo: {
    padding: 15,
  },
  recipeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 5,
  },
  recipeSource: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 10,
  },
  recipeStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  labelsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 5,
  },
  dietLabel: {
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 5,
    marginBottom: 5,
  },
  healthLabel: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 5,
    marginBottom: 5,
  },
  labelText: {
    fontSize: 10,
    color: '#2c3e50',
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    fontSize: 18,
    color: '#7f8c8d',
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#bdc3c7',
    marginTop: 5,
  },
  curatedInfo: {
    backgroundColor: '#f8f9fa',
    borderLeftWidth: 3,
    borderLeftColor: '#3498db',
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginHorizontal: 20,
    marginBottom: 15,
    borderRadius: 5,
  },
  curatedText: {
    fontSize: 12,
    color: '#34495e',
    fontStyle: 'italic',
  },
});

export default RecipeSearch;
