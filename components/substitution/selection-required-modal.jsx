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
 * Selection Required Modal
 * Shows when user hasn't selected an ingredient or substitute
 * Replaces native Alert.alert for "No Selection" scenarios
 */
const SelectionRequiredModal = ({
  visible,
  onClose,
  type = 'ingredient', // 'ingredient' or 'substitute'
}) => {
  const title = type === 'ingredient' 
    ? 'Select an Ingredient' 
    : 'Select a Substitute';
  
  const message = type === 'ingredient'
    ? 'Please select an ingredient you want to replace before continuing.'
    : 'Please select a substitute ingredient before confirming.';

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
                <Ionicons name="hand-left-outline" size={wp('10%')} color="#FF9800" />
              </View>

              {/* Title */}
              <Text style={styles.title}>{title}</Text>

              {/* Message */}
              <Text style={styles.message}>{message}</Text>

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
    width: wp('20%'),
    height: wp('20%'),
    borderRadius: wp('10%'),
    backgroundColor: '#FFF3E0',
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
    marginBottom: hp('3%'),
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

export default SelectionRequiredModal;
