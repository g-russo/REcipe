import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';

/**
 * No Substitutes Found Modal
 * Shows when no suitable substitutes are available for the selected ingredient
 */
const NoSubstitutesModal = ({
  visible,
  onClose,
  ingredientName,
}) => {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              {/* Icon */}
              <View style={styles.iconCircle}>
                <Ionicons name="search-outline" size={wp('12%')} color="#999" />
              </View>

              {/* Title */}
              <Text style={styles.title}>No Substitutes Found</Text>

              {/* Message */}
              <Text style={styles.message}>
                We couldn't find any suitable substitutes for{' '}
                <Text style={styles.ingredientName}>{ingredientName}</Text>
                {' '}in your pantry.
              </Text>

              {/* Suggestions */}
              <View style={styles.suggestionsContainer}>
                <Text style={styles.suggestionsTitle}>Suggestions:</Text>
                <View style={styles.suggestionItem}>
                  <Ionicons name="cart-outline" size={wp('4.5%')} color="#81A969" />
                  <Text style={styles.suggestionText}>Add this ingredient to your shopping list</Text>
                </View>
                <View style={styles.suggestionItem}>
                  <Ionicons name="refresh-outline" size={wp('4.5%')} color="#81A969" />
                  <Text style={styles.suggestionText}>Try a different ingredient to substitute</Text>
                </View>
                <View style={styles.suggestionItem}>
                  <Ionicons name="cube-outline" size={wp('4.5%')} color="#81A969" />
                  <Text style={styles.suggestionText}>Update your pantry inventory</Text>
                </View>
              </View>

              {/* Action Button */}
              <TouchableOpacity
                style={styles.button}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={styles.buttonText}>Got It</Text>
              </TouchableOpacity>
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp('5%'),
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: wp('5%'),
    width: '100%',
    padding: wp('6%'),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  iconCircle: {
    width: wp('24%'),
    height: wp('24%'),
    borderRadius: wp('12%'),
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp('2%'),
  },
  title: {
    fontSize: wp('5.5%'),
    fontWeight: 'bold',
    color: '#333',
    marginBottom: hp('1.5%'),
    textAlign: 'center',
  },
  message: {
    fontSize: wp('4%'),
    color: '#666',
    textAlign: 'center',
    lineHeight: wp('6%'),
    marginBottom: hp('2.5%'),
  },
  ingredientName: {
    fontWeight: 'bold',
    color: '#333',
  },
  suggestionsContainer: {
    width: '100%',
    backgroundColor: '#F8F9FA',
    borderRadius: wp('3%'),
    padding: wp('4%'),
    marginBottom: hp('2.5%'),
  },
  suggestionsTitle: {
    fontSize: wp('3.8%'),
    fontWeight: '600',
    color: '#333',
    marginBottom: hp('1.5%'),
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('1%'),
    gap: wp('3%'),
  },
  suggestionText: {
    fontSize: wp('3.5%'),
    color: '#555',
    flex: 1,
    lineHeight: wp('5%'),
  },
  button: {
    width: '100%',
    paddingVertical: hp('1.8%'),
    borderRadius: wp('3%'),
    backgroundColor: '#81A969',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: wp('4.2%'),
    fontWeight: 'bold',
    color: '#fff',
  },
});

export default NoSubstitutesModal;
