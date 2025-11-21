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
 * Error Modal
 * Shows when an error occurs during substitution operations
 * Replaces native Alert.alert for error scenarios
 */
const ErrorModal = ({
  visible,
  onClose,
  onRetry,
  title = 'Error',
  message = 'Something went wrong. Please try again.',
  showRetry = false,
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
                <Ionicons name="alert-circle" size={wp('12%')} color="#FF6B6B" />
              </View>

              {/* Title */}
              <Text style={styles.title}>{title}</Text>

              {/* Message */}
              <Text style={styles.message}>{message}</Text>

              {/* Suggestion */}
              <View style={styles.suggestionBox}>
                <Ionicons name="bulb-outline" size={18} color="#81A969" />
                <Text style={styles.suggestionText}>
                  Check your internet connection and try again
                </Text>
              </View>

              {/* Actions */}
              {showRetry ? (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={onClose}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.closeButtonText}>Close</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.retryButton}
                    onPress={onRetry}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="refresh" size={20} color="#fff" />
                    <Text style={styles.retryButtonText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.button}
                  onPress={onClose}
                  activeOpacity={0.7}
                >
                  <Text style={styles.buttonText}>Got It</Text>
                </TouchableOpacity>
              )}
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
    marginBottom: hp('1.5%'),
    textAlign: 'center',
  },
  message: {
    fontSize: wp('4%'),
    color: '#666',
    textAlign: 'center',
    lineHeight: wp('6%'),
    marginBottom: hp('2%'),
  },
  suggestionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: wp('3.5%'),
    borderRadius: 12,
    marginBottom: hp('3%'),
    gap: wp('2.5%'),
    width: '100%',
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
  actions: {
    flexDirection: 'row',
    gap: wp('3%'),
    width: '100%',
  },
  closeButton: {
    flex: 1,
    paddingVertical: hp('1.8%'),
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#666',
  },
  retryButton: {
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
  retryButtonText: {
    fontSize: wp('4%'),
    fontWeight: 'bold',
    color: '#fff',
  },
});

export default ErrorModal;
