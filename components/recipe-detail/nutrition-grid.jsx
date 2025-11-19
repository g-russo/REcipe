import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';

export default function NutritionGrid({ nutrition }) {
  if (!nutrition || !nutrition.nutrients) {
    return null;
  }

  // Ensure all values are properly rounded
  const calories = Math.round(nutrition.calories || 0);
  const carbs = Math.round(nutrition.nutrients.carbs?.amount || 0);
  const protein = Math.round(nutrition.nutrients.protein?.amount || 0);
  const fat = Math.round(nutrition.nutrients.fat?.amount || 0);

  return (
    <>
      <View style={styles.nutritionContainer}>
        <View style={styles.nutritionGrid}>
          <View style={styles.nutritionCard}>
            <View style={[styles.nutritionIcon, { backgroundColor: '#e8f5e9' }]}>
              <Ionicons name="nutrition-outline" size={wp('5.5%')} color="#81A969" />
            </View>
            <Text style={styles.nutritionValue}>{carbs}g</Text>
            <Text style={styles.nutritionLabel}>Carbs</Text>
          </View>

          <View style={styles.nutritionCard}>
            <View style={[styles.nutritionIcon, { backgroundColor: '#e3f2fd' }]}>
              <Ionicons name="fitness-outline" size={wp('5.5%')} color="#2196F3" />
            </View>
            <Text style={styles.nutritionValue}>{protein}g</Text>
            <Text style={styles.nutritionLabel}>Protein</Text>
          </View>

          <View style={styles.nutritionCard}>
            <View style={[styles.nutritionIcon, { backgroundColor: '#fff3e0' }]}>
              <Ionicons name="flame-outline" size={wp('5.5%')} color="#FF9800" />
            </View>
            <Text style={styles.nutritionValue}>{calories}</Text>
            <Text style={styles.nutritionLabel}>Kcal</Text>
          </View>

          <View style={styles.nutritionCard}>
            <View style={[styles.nutritionIcon, { backgroundColor: '#f3e5f5' }]}>
              <Ionicons name="water-outline" size={wp('5.5%')} color="#9C27B0" />
            </View>
            <Text style={styles.nutritionValue}>{fat}g</Text>
            <Text style={styles.nutritionLabel}>Fat</Text>
          </View>
        </View>

        {/* AI Nutrition Disclaimer */}
        {nutrition.isAIEstimate && (
          <View style={styles.aiDisclaimer}>
            <Ionicons name="information-circle-outline" size={wp('3.5%')} color="#7f8c8d" />
            <Text style={styles.aiDisclaimerText}>
              Nutritional values are AI estimates
            </Text>
          </View>
        )}

        {/* Per Serving Note */}
        <View style={styles.servingNote}>
          <Text style={styles.servingNoteText}>
            * Values shown are per serving
          </Text>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  nutritionContainer: {
    marginBottom: hp('3%'),
  },
  nutritionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: hp('1.5%'),
  },
  nutritionCard: {
    width: '23%',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: wp('3%'),
    paddingVertical: hp('1.5%'),
    paddingHorizontal: wp('1%'),
  },
  nutritionIcon: {
    width: wp('11%'),
    height: wp('11%'),
    borderRadius: wp('5.5%'),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: hp('1%'),
  },
  nutritionValue: {
    fontSize: wp('4%'),
    color: '#2c3e50',
    fontWeight: 'bold',
    marginBottom: hp('0.3%'),
  },
  nutritionLabel: {
    fontSize: wp('3%'),
    color: '#7f8c8d',
    fontWeight: '500',
  },
  aiDisclaimer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('2%'),
    marginBottom: hp('0.5%'),
  },
  aiDisclaimerText: {
    fontSize: wp('3%'),
    color: '#7f8c8d',
    marginLeft: wp('1.5%'),
    flex: 1,
  },
  servingNote: {
    paddingHorizontal: wp('2%'),
  },
  servingNoteText: {
    fontSize: wp('2.8%'),
    color: '#95a5a6',
    fontStyle: 'italic',
  },
});
