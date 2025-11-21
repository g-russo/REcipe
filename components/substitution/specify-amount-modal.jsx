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
 * Specify Amount Modal
 * Shows when user needs to specify amount for vague unit measurements
 * Replaces native Alert.alert for "Specify Amount" scenarios
 */
const SpecifyAmountModal = ({
  visible,
  onClose,
  originalQuantity = '',
  originalUnit = '',
  substituteName = '',
  substituteUnit = '',
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
                <Ionicons name="help-circle" size={wp('12%')} color="#FF9800" />
              </View>

              {/* Title */}
              <Text style={styles.title}>Specify Amount</Text>

              {/* Vague Unit Explanation */}
              <View style={styles.vagueUnitBox}>
                <Ionicons name="information-circle" size={20} color="#FF9800" />
                <View style={styles.vagueUnitContent}>
                  <Text style={styles.vagueUnitTitle}>Vague Measurement</Text>
                  <Text style={styles.vagueUnitText}>
                    "{originalQuantity} {originalUnit}" is not a precise measurement
                  </Text>
                </View>
              </View>

              {/* Instruction */}
              <Text style={styles.instruction}>
                Please tap the quantity field to specify how much{' '}
                <Text style={styles.highlight}>{substituteUnit}</Text> of{' '}
                <Text style={styles.highlight}>{substituteName}</Text> you want to use.
              </Text>

              {/* Visual Guide */}
              <View style={styles.guideBox}>
                <Ionicons name="hand-left" size={16} color="#81A969" />
                <Text style={styles.guideText}>Tap the quantity to edit</Text>
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
    maxWidth: 420,
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
    backgroundColor: '#FFF3E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp('2%'),
  },
  title: {
    fontSize: wp('5.5%'),
    fontWeight: 'bold',
    color: '#333',
    marginBottom: hp('2%'),
    textAlign: 'center',
  },
  vagueUnitBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF3E0',
    padding: wp('4%'),
    borderRadius: 12,
    marginBottom: hp('2%'),
    borderLeftWidth: 3,
    borderLeftColor: '#FF9800',
    gap: wp('3%'),
    width: '100%',
  },
  vagueUnitContent: {
    flex: 1,
  },
  vagueUnitTitle: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#333',
    marginBottom: hp('0.5%'),
  },
  vagueUnitText: {
    fontSize: wp('3.5%'),
    color: '#666',
    lineHeight: wp('5%'),
  },
  instruction: {
    fontSize: wp('4%'),
    color: '#666',
    textAlign: 'center',
    lineHeight: wp('6%'),
    marginBottom: hp('2%'),
  },
  highlight: {
    fontWeight: '600',
    color: '#81A969',
  },
  guideBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingVertical: hp('1.5%'),
    paddingHorizontal: wp('4%'),
    borderRadius: 8,
    marginBottom: hp('3%'),
    gap: wp('2%'),
  },
  guideText: {
    fontSize: wp('3.5%'),
    color: '#81A969',
    fontWeight: '600',
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

export default SpecifyAmountModal;
