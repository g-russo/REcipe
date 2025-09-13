import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import EdamamService from '../services/edamamService';

export function useRecipes() {
  const [favorites, setFavorites] = useState([]);
  const [myRecipes, setMyRecipes] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load user's favorite recipes from database
  const loadFavorites = async (userId) => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('tbl_favorites')
        .select('*')
        .eq('userID', userId);

      if (error) {
        console.error('Error loading favorites:', error);
        return;
      }

      setFavorites(data || []);
    } catch (err) {
      console.error('Failed to load favorites:', err);
    } finally {
      setLoading(false);
    }
  };

  // Add recipe to favorites
  const addToFavorites = async (userId, recipe) => {
    try {
      // Check if already favorited
      const { data: existing } = await supabase
        .from('tbl_favorites')
        .select('favoriteID')
        .eq('userID', userId)
        .eq('recipeURI', recipe.id)
        .single();

      if (existing) {
        console.log('Recipe already in favorites');
        return { success: false, message: 'Recipe is already in your favorites' };
      }

      // Add to favorites
      const { data, error } = await supabase
        .from('tbl_favorites')
        .insert({
          userID: userId,
          recipeURI: recipe.id,
          recipeTitle: recipe.label,
          recipeImage: recipe.image,
          recipeSource: recipe.source,
          recipeCalories: recipe.calories,
          recipeCookingTime: recipe.totalTime,
          recipeServings: recipe.yield,
          recipeData: JSON.stringify(recipe), // Store full recipe data
          dateAdded: new Date().toISOString()
        })
        .select();

      if (error) {
        console.error('Error adding to favorites:', error);
        return { success: false, message: 'Failed to add to favorites' };
      }

      // Update local state
      setFavorites(prev => [...prev, data[0]]);
      
      return { success: true, message: 'Added to favorites!' };
    } catch (err) {
      console.error('Failed to add to favorites:', err);
      return { success: false, message: 'Something went wrong' };
    }
  };

  // Remove recipe from favorites
  const removeFromFavorites = async (userId, recipeURI) => {
    try {
      const { error } = await supabase
        .from('tbl_favorites')
        .delete()
        .eq('userID', userId)
        .eq('recipeURI', recipeURI);

      if (error) {
        console.error('Error removing from favorites:', error);
        return { success: false, message: 'Failed to remove from favorites' };
      }

      // Update local state
      setFavorites(prev => prev.filter(fav => fav.recipeURI !== recipeURI));
      
      return { success: true, message: 'Removed from favorites!' };
    } catch (err) {
      console.error('Failed to remove from favorites:', err);
      return { success: false, message: 'Something went wrong' };
    }
  };

  // Check if recipe is favorited
  const isFavorited = (recipeURI) => {
    return favorites.some(fav => fav.recipeURI === recipeURI);
  };

  // Search recipes using Edamam API
  const searchRecipes = async (query, options = {}) => {
    try {
      setLoading(true);
      
      const result = await EdamamService.searchRecipes(query, options);
      
      if (result.success) {
        return {
          success: true,
          data: result.data.recipes,
          count: result.data.count,
          more: result.data.more
        };
      } else {
        return {
          success: false,
          error: result.error
        };
      }
    } catch (error) {
      console.error('Recipe search error:', error);
      return {
        success: false,
        error: error.message || 'Failed to search recipes'
      };
    } finally {
      setLoading(false);
    }
  };

  // Get recipe details by URI
  const getRecipeDetails = async (uri) => {
    try {
      setLoading(true);
      
      const result = await EdamamService.getRecipeByUri(uri);
      
      if (result.success) {
        return {
          success: true,
          data: result.data
        };
      } else {
        return {
          success: false,
          error: result.error
        };
      }
    } catch (error) {
      console.error('Get recipe details error:', error);
      return {
        success: false,
        error: error.message || 'Failed to get recipe details'
      };
    } finally {
      setLoading(false);
    }
  };

  // Save custom recipe
  const saveCustomRecipe = async (userId, recipeData) => {
    try {
      const { data, error } = await supabase
        .from('tbl_custom_recipes')
        .insert({
          userID: userId,
          recipeTitle: recipeData.title,
          recipeDescription: recipeData.description,
          recipeIngredients: JSON.stringify(recipeData.ingredients),
          recipeInstructions: JSON.stringify(recipeData.instructions),
          recipeCookingTime: recipeData.cookingTime,
          recipeServings: recipeData.servings,
          recipeImage: recipeData.image,
          recipeCategory: recipeData.category,
          dateCreated: new Date().toISOString(),
          isPublic: recipeData.isPublic || false
        })
        .select();

      if (error) {
        console.error('Error saving custom recipe:', error);
        return { success: false, message: 'Failed to save recipe' };
      }

      // Update local state
      setMyRecipes(prev => [...prev, data[0]]);
      
      return { success: true, message: 'Recipe saved successfully!', data: data[0] };
    } catch (err) {
      console.error('Failed to save custom recipe:', err);
      return { success: false, message: 'Something went wrong' };
    }
  };

  // Load user's custom recipes
  const loadMyRecipes = async (userId) => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('tbl_custom_recipes')
        .select('*')
        .eq('userID', userId)
        .order('dateCreated', { ascending: false });

      if (error) {
        console.error('Error loading custom recipes:', error);
        return;
      }

      setMyRecipes(data || []);
    } catch (err) {
      console.error('Failed to load custom recipes:', err);
    } finally {
      setLoading(false);
    }
  };

  return {
    favorites,
    myRecipes,
    loading,
    loadFavorites,
    addToFavorites,
    removeFromFavorites,
    isFavorited,
    searchRecipes,
    getRecipeDetails,
    saveCustomRecipe,
    loadMyRecipes
  };
}
