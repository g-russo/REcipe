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
 * Continue Substituting Modal
 * Shows after successful substitution to ask if user wants to continue
 * Replaces native Alert.alert for "Continue Substituting?" scenarios
 */
const ContinueSubstitutingModal = ({
  visible,
  onDone,
  onContinue,
  remainingCount = 0,
}) => {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onDone}
    >
      <TouchableWithoutFeedback onPress={onDone}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              {/* Icon */}
              <View style={styles.iconCircle}>
                <Ionicons name="checkmark-circle" size={wp('15%')} color="#81A969" />
              </View>

              {/* Title */}
              <Text style={styles.title}>Substitution Added!</Text>

              {/* Remaining Count */}
              <View style={styles.remainingBox}>
                <Ionicons name="list" size={20} color="#FF9800" />
                <Text style={styles.remainingText}>
                  {remainingCount} more ingredient{remainingCount !== 1 ? 's' : ''} remaining
                </Text>
              </View>

              {/* Question */}
              <Text style={styles.question}>
                Would you like to substitute another ingredient?
              </Text>

              {/* Actions */}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.doneButton}
                  onPress={onDone}
                  activeOpacity={0.7}
                >
                  <Text style={styles.doneButtonText}>Done</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.continueButton}
                  onPress={onContinue}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add-circle" size={20} color="#fff" />
                  <Text style={styles.continueButtonText}>Yes, Continue</Text>
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
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp('2%'),
  },
  title: {
    fontSize: wp('6%'),
    fontWeight: 'bold',
    color: '#333',
    marginBottom: hp('2%'),
    textAlign: 'center',
  },
  remainingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingVertical: hp('1.5%'),
    paddingHorizontal: wp('5%'),
    borderRadius: 12,
    marginBottom: hp('2%'),
    gap: wp('2%'),
  },
  remainingText: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#E65100',
  },
  question: {
    fontSize: wp('4.2%'),
    color: '#555',
    textAlign: 'center',
    marginBottom: hp('3%'),
    lineHeight: wp('6%'),
  },
  actions: {
    flexDirection: 'row',
    gap: wp('3%'),
    width: '100%',
  },
  doneButton: {
    flex: 1,
    paddingVertical: hp('1.8%'),
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#666',
  },
  continueButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: hp('1.8%'),
    borderRadius: 12,
    backgroundColor: '#81A969',
    alignItems: 'center',
    justifyContent: 'center',
    gap: wp('2%'),
    shadowColor: '#81A969',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  continueButtonText: {
    fontSize: wp('4%'),
    fontWeight: 'bold',
    color: '#fff',
  },
});

export default ContinueSubstitutingModal;
