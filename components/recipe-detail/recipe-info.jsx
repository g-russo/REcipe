import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';

export default function RecipeInfo({ recipe, onViewMore }) {
  return (
    <View style={styles.container}>
      <Text style={styles.recipeTitle}>{recipe.label}</Text>

      <View style={styles.metaInfo}>
        <View style={styles.metaItem}>
          <Ionicons name="time-outline" size={wp('4.5%')} color="#81A969" />
          <Text style={styles.metaText}>{recipe.totalTime || 30} Min</Text>
        </View>
        <Text style={styles.metaDivider}>•</Text>
        <View style={styles.metaItem}>
          <Ionicons name="people-outline" size={wp('4.5%')} color="#81A969" />
          <Text style={styles.metaText}>{recipe.yield} Servings</Text>
        </View>
      </View>

      <Text style={styles.description}>
        {recipe.recipeDescription || `${recipe.label} is a delicious recipe perfect for any occasion...`}
        {recipe?.url && (
          <Text style={styles.viewMore} onPress={onViewMore}> View More</Text>
        )}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: hp('2%'),
  },
  recipeTitle: {
    fontSize: wp('6.5%'),
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: hp('1.5%'),
    lineHeight: wp('8%'),
  },
  metaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('2%'),
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: wp('3.8%'),
    color: '#7f8c8d',
    marginLeft: wp('1.5%'),
    fontWeight: '500',
  },
  metaDivider: {
    fontSize: wp('4%'),
    color: '#bdc3c7',
    marginHorizontal: wp('3%'),
  },
  description: {
    fontSize: wp('4%'),
    color: '#7f8c8d',
    lineHeight: wp('6%'),
  },
  viewMore: {
    color: '#81A969',
    fontWeight: '600',
  },
});
