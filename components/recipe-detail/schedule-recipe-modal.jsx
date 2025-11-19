import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  Animated,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import DateTimePicker from '@react-native-community/datetimepicker';
import RecipeSchedulingService from '../../services/recipe-scheduling-service';

const ScheduleRecipeModal = ({ visible, onClose, recipe, userID }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(Platform.OS === 'ios');
  const [isScheduling, setIsScheduling] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [scheduledRecipeName, setScheduledRecipeName] = useState('');
  const [scheduledDateStr, setScheduledDateStr] = useState('');
  
  // Animation refs
  const modalScale = useRef(new Animated.Value(0)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      // Entrance animation
      modalScale.setValue(0.7);
      modalOpacity.setValue(0);
      
      Animated.parallel([
        Animated.spring(modalScale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 10,
        }),
        Animated.timing(modalOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const closeModal = () => {
    Animated.parallel([
      Animated.timing(modalScale, {
        toValue: 0.7,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(modalOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose(false);
    });
  };

  const handleDateChange = (event, date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    
    if (date) {
      setSelectedDate(date);
    }
  };

  const handleSchedule = async () => {
    if (!recipe) {
      Alert.alert('Error', 'Recipe data is missing');
      return;
    }

    // Check if date is in the future
    const now = new Date();
    if (selectedDate <= now) {
      Alert.alert('Invalid Date', 'Please select a future date');
      return;
    }

    setIsScheduling(true);

    try {
      const result = await RecipeSchedulingService.scheduleRecipe(
        userID,
        recipe,
        selectedDate
      );

      if (result.success) {
        setScheduledRecipeName(recipe.label || recipe.recipeName);
        setScheduledDateStr(selectedDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }));
        
        // Close schedule modal first
        closeModal();
        
        // Show success modal after a delay
        setTimeout(() => {
          setShowSuccessModal(true);
          
          // Animate success modal entrance
          successScale.setValue(0.7);
          successOpacity.setValue(0);
          
          Animated.parallel([
            Animated.spring(successScale, {
              toValue: 1,
              useNativeDriver: true,
              tension: 100,
              friction: 10,
            }),
            Animated.timing(successOpacity, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start();
        }, 300);
      } else {
        Alert.alert('Error', result.error || 'Failed to schedule recipe');
      }
    } catch (error) {
      console.error('Error scheduling recipe:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsScheduling(false);
    }
  };

  const closeSuccessModal = () => {
    Animated.parallel([
      Animated.timing(successScale, {
        toValue: 0.7,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(successOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowSuccessModal(false);
      onClose(true);
    });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getMinDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  };

  return (
    <>
    <Modal
      visible={visible}
      animationType="none"
      transparent={true}
      onRequestClose={closeModal}
    >
      <TouchableWithoutFeedback onPress={closeModal}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <Animated.View style={[
              styles.modalContent,
              {
                opacity: modalOpacity,
                transform: [{ scale: modalScale }]
              }
            ]}>
              {/* Header with Icon */}
              <View style={styles.modalHeader}>
                <View style={styles.headerIconCircle}>
                  <Ionicons name="calendar" size={32} color="#81A969" />
                </View>
                <Text style={styles.modalTitle}>Schedule Recipe</Text>
              </View>

              {/* Recipe Info */}
              <View style={styles.recipeInfoBox}>
                <Ionicons name="restaurant" size={20} color="#81A969" />
                <Text style={styles.recipeName} numberOfLines={2}>
                  {recipe?.label || recipe?.recipeName || 'Recipe'}
                </Text>
              </View>

              {/* Date Selection */}
              <View style={styles.dateSection}>
                <Text style={styles.sectionTitle}>When do you want to cook this?</Text>
                
                {Platform.OS === 'android' && (
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowDatePicker(true)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.dateIconCircle}>
                      <Ionicons name="calendar-outline" size={20} color="#81A969" />
                    </View>
                    <Text style={styles.dateButtonText}>{formatDate(selectedDate)}</Text>
                    <Ionicons name="chevron-down" size={20} color="#81A969" />
                  </TouchableOpacity>
                )}

                {showDatePicker && (
                  <View style={styles.datePickerContainer}>
                    <DateTimePicker
                      value={selectedDate}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={handleDateChange}
                      minimumDate={getMinDate()}
                      style={styles.datePicker}
                      themeVariant="light"
                      accentColor="#81A969"
                    />
                  </View>
                )}
              </View>

              {/* Notification Info */}
              <View style={styles.notificationInfo}>
                <View style={styles.notificationHeader}>
                  <Ionicons name="notifications" size={20} color="#FF9800" />
                  <Text style={styles.notificationTitle}>You'll receive reminders at 9:00 AM</Text>
                </View>
                <View style={styles.notificationItems}>
                  <View style={styles.notificationItem}>
                    <View style={[styles.notificationDot, { backgroundColor: '#FFB74D' }]} />
                    <Text style={styles.notificationItemText}>1 week before</Text>
                  </View>
                  <View style={styles.notificationItem}>
                    <View style={[styles.notificationDot, { backgroundColor: '#FF9800' }]} />
                    <Text style={styles.notificationItemText}>Daily from 3 days before</Text>
                  </View>
                  <View style={styles.notificationItem}>
                    <View style={[styles.notificationDot, { backgroundColor: '#81A969' }]} />
                    <Text style={styles.notificationItemText}>On cooking day</Text>
                  </View>
                </View>
              </View>

              {/* Actions */}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={closeModal}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.scheduleButton, isScheduling && styles.scheduleButtonDisabled]}
                  onPress={handleSchedule}
                  disabled={isScheduling}
                  activeOpacity={0.8}
                >
                  {isScheduling ? (
                    <Text style={styles.scheduleButtonText}>Scheduling...</Text>
                  ) : (
                    <>
                      <Ionicons name="calendar-sharp" size={20} color="#fff" />
                      <Text style={styles.scheduleButtonText}>Schedule</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>

    {/* Success Modal */}
    <Modal
      visible={showSuccessModal}
      animationType="none"
      transparent={true}
      onRequestClose={closeSuccessModal}
    >
      <TouchableWithoutFeedback onPress={closeSuccessModal}>
        <View style={styles.successOverlay}>
          <TouchableWithoutFeedback>
            <Animated.View style={[
              styles.successContent,
              {
                opacity: successOpacity,
                transform: [{ scale: successScale }]
              }
            ]}>
              {/* Success Icon */}
              <View style={styles.successIconContainer}>
                <View style={styles.successIconCircle}>
                  <Ionicons name="checkmark-circle" size={64} color="#81A969" />
                </View>
              </View>

              <Text style={styles.successTitle}>Recipe Scheduled!</Text>
              
              <Text style={styles.successRecipeName}>{scheduledRecipeName}</Text>
              
              <View style={styles.successDateBox}>
                <Ionicons name="calendar" size={20} color="#81A969" />
                <Text style={styles.successDate}>{scheduledDateStr}</Text>
              </View>

              {/* OK Button */}
              <TouchableOpacity
                style={styles.successButton}
                onPress={closeSuccessModal}
                activeOpacity={0.8}
              >
                <Text style={styles.successButtonText}>Got It!</Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp('5%'),
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: wp('6%'),
    width: '100%',
    maxWidth: 500,
    maxHeight: hp('85%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: hp('2.5%'),
  },
  headerIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp('1.5%'),
  },
  modalTitle: {
    fontSize: wp('5.5%'),
    fontWeight: 'bold',
    color: '#333',
  },
  recipeInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: wp('4%'),
    borderRadius: 12,
    marginBottom: hp('2.5%'),
    borderLeftWidth: 3,
    borderLeftColor: '#81A969',
  },
  recipeName: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#333',
    marginLeft: wp('3%'),
    flex: 1,
  },
  dateSection: {
    marginBottom: hp('2.5%'),
  },
  sectionTitle: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#333',
    marginBottom: hp('1.5%'),
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: wp('4%'),
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#81A969',
  },
  dateIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp('3%'),
  },
  dateButtonText: {
    flex: 1,
    fontSize: wp('4%'),
    color: '#333',
    fontWeight: '500',
  },
  datePickerContainer: {
    marginTop: hp('1.5%'),
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: wp('2%'),
  },
  datePicker: {
    width: '100%',
  },
  notificationInfo: {
    backgroundColor: '#FFF3E0',
    padding: wp('4%'),
    borderRadius: 12,
    marginBottom: hp('2.5%'),
    borderLeftWidth: 3,
    borderLeftColor: '#FF9800',
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('1.5%'),
  },
  notificationTitle: {
    fontSize: wp('3.8%'),
    fontWeight: '600',
    color: '#333',
    marginLeft: wp('2%'),
  },
  notificationItems: {
    gap: hp('1%'),
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: wp('2.5%'),
  },
  notificationItemText: {
    fontSize: wp('3.5%'),
    color: '#666',
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: wp('3%'),
  },
  cancelButton: {
    flex: 1,
    padding: hp('1.8%'),
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#666',
  },
  scheduleButton: {
    flex: 1,
    flexDirection: 'row',
    padding: hp('1.8%'),
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
  scheduleButtonDisabled: {
    opacity: 0.6,
  },
  scheduleButtonText: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#fff',
  },
  // Success Modal Styles
  successOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp('5%'),
  },
  successContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: wp('6%'),
    width: '100%',
    maxWidth: 450,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
  },
  successIconContainer: {
    marginBottom: hp('2%'),
  },
  successIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: wp('6%'),
    fontWeight: 'bold',
    color: '#333',
    marginBottom: hp('1.5%'),
  },
  successRecipeName: {
    fontSize: wp('4.5%'),
    fontWeight: '600',
    color: '#81A969',
    textAlign: 'center',
    marginBottom: hp('2%'),
  },
  successDateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingVertical: hp('1.5%'),
    paddingHorizontal: wp('5%'),
    borderRadius: 12,
    marginBottom: hp('3%'),
  },
  successDate: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#81A969',
    marginLeft: wp('2%'),
  },
  successButton: {
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
  successButtonText: {
    fontSize: wp('4.5%'),
    fontWeight: 'bold',
    color: '#fff',
  },
});

export default ScheduleRecipeModal;
