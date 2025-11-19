import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import RecipeSchedulingService from '../../services/recipe-scheduling-service';

const ScheduledTab = ({ scheduledRecipes, onDelete, onRefresh }) => {
  const handleRecipePress = (recipe) => {
    // Navigate to recipe details
    router.push({
      pathname: '/recipe-detail',
      params: {
        recipeData: JSON.stringify(recipe.recipeData)
      }
    });
  };

  const handleDeleteSchedule = (scheduleID, recipeName) => {
    Alert.alert(
      'Delete Scheduled Recipe',
      `Are you sure you want to delete "${recipeName}" from your schedule?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await RecipeSchedulingService.deleteScheduledRecipe(scheduleID);
            if (result.success) {
              Alert.alert('Success', 'Recipe removed from schedule');
              onRefresh();
            } else {
              Alert.alert('Error', 'Failed to delete scheduled recipe');
            }
          }
        }
      ]
    );
  };

  const handleMarkCompleted = async (scheduleID, recipeName) => {
    Alert.alert(
      'Mark as Completed',
      `Did you cook "${recipeName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, I cooked it',
          onPress: async () => {
            const result = await RecipeSchedulingService.markAsCompleted(scheduleID);
            if (result.success) {
              Alert.alert('Success', 'Recipe marked as completed!');
              onRefresh();
            } else {
              Alert.alert('Error', 'Failed to mark recipe as completed');
            }
          }
        }
      ]
    );
  };

  const formatScheduledDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const diffTime = date - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 7) return `In ${diffDays} days`;
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    });
  };

  const getDaysUntil = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const diffTime = date - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const renderScheduledRecipe = ({ item }) => {
    const recipe = item.recipeData;
    const imageUrl = recipe.image || recipe.images?.[0] || 'https://via.placeholder.com/150';
    const daysUntil = getDaysUntil(item.scheduledDate);
    const isToday = daysUntil === 0;
    const isPast = daysUntil < 0;

    return (
      <TouchableOpacity
        style={[
          styles.recipeCard,
          isToday && styles.recipeCardToday,
          isPast && styles.recipeCardPast
        ]}
        onPress={() => handleRecipePress(item)}
        activeOpacity={0.7}
      >
        <Image source={{ uri: imageUrl }} style={styles.recipeImage} />
        <View style={styles.recipeInfo}>
          <Text style={styles.recipeTitle} numberOfLines={2}>
            {item.recipeName}
          </Text>
          <View style={styles.scheduleDateContainer}>
            <Ionicons 
              name="calendar-outline" 
              size={14} 
              color={isToday ? '#FF6B6B' : isPast ? '#999' : '#6FA36D'} 
            />
            <Text style={[
              styles.scheduleDate,
              isToday && styles.scheduleDateToday,
              isPast && styles.scheduleDatePast
            ]}>
              {formatScheduledDate(item.scheduledDate)}
            </Text>
          </View>
          {isToday && (
            <View style={styles.todayBadge}>
              <Text style={styles.todayBadgeText}>COOK TODAY!</Text>
            </View>
          )}
          {isPast && (
            <View style={styles.pastBadge}>
              <Text style={styles.pastBadgeText}>Past Due</Text>
            </View>
          )}
        </View>
        <View style={styles.actions}>
          {!isPast && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleMarkCompleted(item.scheduleID, item.recipeName)}
            >
              <Ionicons name="checkmark-circle-outline" size={24} color="#6FA36D" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDeleteSchedule(item.scheduleID, item.recipeName)}
          >
            <Ionicons name="trash-outline" size={24} color="#FF6B6B" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (!scheduledRecipes || scheduledRecipes.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="calendar-outline" size={64} color="#ccc" />
        <Text style={styles.emptyTitle}>No Scheduled Recipes</Text>
        <Text style={styles.emptySubtitle}>
          Schedule recipes to get reminded when it's time to cook!
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.listContainer}>
      {scheduledRecipes.map((item) => (
        <View key={item.scheduleID}>
          {renderScheduledRecipe({ item })}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  listContainer: {
    paddingBottom: 20,
  },
  recipeCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    padding: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  recipeCardToday: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B6B',
  },
  recipeCardPast: {
    opacity: 0.6,
  },
  recipeImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  recipeInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  recipeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  scheduleDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  scheduleDate: {
    fontSize: 14,
    color: '#6FA36D',
    marginLeft: 4,
    fontWeight: '500',
  },
  scheduleDateToday: {
    color: '#FF6B6B',
    fontWeight: '700',
  },
  scheduleDatePast: {
    color: '#999',
  },
  todayBadge: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  todayBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  pastBadge: {
    backgroundColor: '#999',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  pastBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  actions: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});

export default ScheduledTab;
