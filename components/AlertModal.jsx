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
 * Reusable Alert Modal
 * Replaces native Alert.alert with a designed modal
 * Supports info, success, warning, and error types
 */
const AlertModal = ({
  visible,
  onClose,
  title = 'Alert',
  message = '',
  type = 'info', // 'info', 'success', 'warning', 'error'
  buttons = [], // Array of { text, onPress, style }
  icon = null, // Custom icon name
  accentColor = null, // Custom accent color
}) => {
  // Determine icon and color based on type
  const getTypeConfig = () => {
    if (icon && accentColor) {
      return { iconName: icon, color: accentColor };
    }

    switch (type) {
      case 'success':
        return { iconName: 'checkmark-circle', color: '#81A969' };
      case 'warning':
        return { iconName: 'warning', color: '#FF9800' };
      case 'error':
        return { iconName: 'alert-circle', color: '#FF6B6B' };
      case 'info':
      default:
        return { iconName: 'information-circle', color: '#2196F3' };
    }
  };

  const { iconName, color } = getTypeConfig();

  // Default button if none provided
  const displayButtons = buttons.length > 0 ? buttons : [{ text: 'OK', onPress: onClose }];

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
              <View style={[styles.iconCircle, { backgroundColor: color + '20' }]}>
                <Ionicons name={iconName} size={wp('12%')} color={color} />
              </View>

              {/* Title */}
              <Text style={styles.title}>{title}</Text>

              {/* Message */}
              {message ? <Text style={styles.message}>{message}</Text> : null}

              {/* Buttons */}
              <View style={styles.buttonContainer}>
                {displayButtons.map((button, index) => {
                  const isCancel = button.style === 'cancel';
                  const isDestructive = button.style === 'destructive';
                  
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.button,
                        displayButtons.length === 1 && styles.buttonFull,
                        displayButtons.length === 2 && styles.buttonHalf,
                        isCancel && styles.buttonCancel,
                        isDestructive && styles.buttonDestructive,
                        !isCancel && !isDestructive && { backgroundColor: color },
                      ]}
                      onPress={() => {
                        button.onPress?.();
                        if (!button.preventClose) {
                          onClose();
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.buttonText,
                          isCancel && styles.buttonTextCancel,
                          isDestructive && styles.buttonTextDestructive,
                        ]}
                      >
                        {button.text}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
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
  buttonContainer: {
    flexDirection: 'row',
    gap: wp('3%'),
    width: '100%',
  },
  button: {
    paddingVertical: hp('2%'),
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonFull: {
    flex: 1,
  },
  buttonHalf: {
    flex: 1,
  },
  buttonCancel: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonDestructive: {
    backgroundColor: '#FF6B6B',
  },
  buttonText: {
    fontSize: wp('4.5%'),
    fontWeight: 'bold',
    color: '#fff',
  },
  buttonTextCancel: {
    color: '#666',
  },
  buttonTextDestructive: {
    color: '#fff',
  },
});

export default AlertModal;
