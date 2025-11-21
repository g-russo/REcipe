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
 * Insufficient Pantry Modal
 * Shows when user tries to use more than available in pantry
 * Replaces native Alert.alert for "Not Enough in Pantry" scenarios
 */
const InsufficientPantryModal = ({
  visible,
  onClose,
  ingredientName = '',
  available = 0,
  availableUnit = '',
  needed = 0,
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
                <Ionicons name="warning" size={wp('12%')} color="#FF6B6B" />
              </View>

              {/* Title */}
              <Text style={styles.title}>Not Enough in Pantry</Text>

              {/* Ingredient Name */}
              <Text style={styles.ingredientName}>{ingredientName}</Text>

              {/* Comparison */}
              <View style={styles.comparisonContainer}>
                <View style={styles.comparisonBox}>
                  <Text style={styles.comparisonLabel}>You Have</Text>
                  <Text style={styles.comparisonValue}>
                    {available} {availableUnit}
                  </Text>
                </View>
                
                <Ionicons name="arrow-forward" size={20} color="#999" />
                
                <View style={styles.comparisonBox}>
                  <Text style={styles.comparisonLabel}>You Need</Text>
                  <Text style={[styles.comparisonValue, styles.neededValue]}>
                    {needed} {availableUnit}
                  </Text>
                </View>
              </View>

              {/* Suggestion */}
              <View style={styles.suggestionBox}>
                <Ionicons name="bulb-outline" size={20} color="#81A969" />
                <Text style={styles.suggestionText}>
                  Try using a smaller quantity or choose a different substitute
                </Text>
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
    borderRadius: 24,
    padding: wp('6%'),
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
  },
  iconCircle: {
    width: wp('24%'),
    height: wp('24%'),
    borderRadius: wp('12%'),
    backgroundColor: '#FFE5E5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp('2%'),
  },
  title: {
    fontSize: wp('5.5%'),
    fontWeight: 'bold',
    color: '#333',
    marginBottom: hp('1%'),
    textAlign: 'center',
  },
  ingredientName: {
    fontSize: wp('4.5%'),
    fontWeight: '600',
    color: '#FF6B6B',
    textAlign: 'center',
    marginBottom: hp('2.5%'),
  },
  comparisonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: hp('2.5%'),
    gap: wp('3%'),
  },
  comparisonBox: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    padding: wp('4%'),
    borderRadius: 12,
    alignItems: 'center',
  },
  comparisonLabel: {
    fontSize: wp('3.2%'),
    color: '#999',
    marginBottom: hp('0.5%'),
    fontWeight: '500',
  },
  comparisonValue: {
    fontSize: wp('4.5%'),
    fontWeight: 'bold',
    color: '#333',
  },
  neededValue: {
    color: '#FF6B6B',
  },
  suggestionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: wp('4%'),
    borderRadius: 12,
    marginBottom: hp('3%'),
    gap: wp('3%'),
  },
  suggestionText: {
    flex: 1,
    fontSize: wp('3.5%'),
    color: '#555',
    lineHeight: wp('5%'),
  },
  button: {
    width: '100%',
    backgroundColor: '#81A969',
    paddingVertical: hp('2%'),
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#81A969',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    fontSize: wp('4.5%'),
    fontWeight: 'bold',
    color: '#fff',
  },
});

export default InsufficientPantryModal;
