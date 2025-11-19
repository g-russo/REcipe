import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';

/**
 * Available Ingredients Modal
 * Shows ingredients available in pantry that can be used for the recipe
 */
const AvailableIngredientsModal = ({ visible, availableIngredients, onYes, onNo }) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onNo}
    >
      <TouchableWithoutFeedback onPress={onNo}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              {/* Icon Header */}
              <View style={styles.iconContainer}>
                <View style={styles.iconCircle}>
                  <Ionicons name="checkmark-circle" size={wp('15%')} color="#81A969" />
                </View>
              </View>

              {/* Title */}
              <Text style={styles.title}>Available Ingredients</Text>

              {/* Description */}
              <Text style={styles.description}>
                The following ingredients are available in your pantry:
              </Text>

              {/* Ingredients List */}
              <ScrollView 
                style={styles.ingredientsList}
                contentContainerStyle={styles.ingredientsListContent}
                showsVerticalScrollIndicator={false}
              >
                {availableIngredients.map((ingredient, index) => {
                  const ingredientText = ingredient.text || ingredient;
                  return (
                    <View key={index} style={styles.ingredientItem}>
                      <View style={styles.bulletCircle}>
                        <Ionicons name="leaf" size={wp('4%')} color="#81A969" />
                      </View>
                      <Text style={styles.ingredientText}>{ingredientText}</Text>
                    </View>
                  );
                })}
              </ScrollView>

              {/* Question */}
              <Text style={styles.question}>
                Would you like to use them for this recipe?
              </Text>

              {/* Action Buttons */}
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.button, styles.noButton]}
                  onPress={onNo}
                  activeOpacity={0.7}
                >
                  <Text style={styles.noButtonText}>No</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.yesButton]}
                  onPress={onYes}
                  activeOpacity={0.8}
                >
                  <Text style={styles.yesButtonText}>Yes</Text>
                  <Ionicons name="checkmark" size={wp('5%')} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp('5%'),
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: wp('5%'),
    padding: wp('6%'),
    width: '100%',
    maxWidth: wp('90%'),
    maxHeight: hp('80%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: hp('2%'),
  },
  iconCircle: {
    width: wp('20%'),
    height: wp('20%'),
    borderRadius: wp('10%'),
    backgroundColor: '#F0F7ED',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#C8E0B8',
  },
  title: {
    fontSize: wp('6%'),
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: hp('1.5%'),
  },
  description: {
    fontSize: wp('4%'),
    color: '#666',
    textAlign: 'center',
    lineHeight: wp('6%'),
    marginBottom: hp('2%'),
  },
  ingredientsList: {
    maxHeight: hp('30%'),
    marginBottom: hp('2%'),
  },
  ingredientsListContent: {
    paddingVertical: hp('1%'),
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp('1%'),
    paddingHorizontal: wp('3%'),
    backgroundColor: '#F8FAF6',
    borderRadius: wp('2%'),
    marginBottom: hp('1%'),
    gap: wp('3%'),
  },
  bulletCircle: {
    width: wp('8%'),
    height: wp('8%'),
    borderRadius: wp('4%'),
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#C8E0B8',
  },
  ingredientText: {
    fontSize: wp('3.8%'),
    color: '#333',
    flex: 1,
    fontWeight: '500',
  },
  question: {
    fontSize: wp('4.2%'),
    color: '#444',
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: hp('2.5%'),
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: wp('3%'),
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: hp('1.8%'),
    borderRadius: wp('3%'),
    alignItems: 'center',
    justifyContent: 'center',
    gap: wp('2%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  noButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  noButtonText: {
    fontSize: wp('4%'),
    fontWeight: '700',
    color: '#666',
  },
  yesButton: {
    backgroundColor: '#81A969',
  },
  yesButtonText: {
    fontSize: wp('4%'),
    fontWeight: '700',
    color: '#fff',
  },
});

export default AvailableIngredientsModal;
