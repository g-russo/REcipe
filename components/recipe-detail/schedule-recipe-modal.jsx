import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import RecipeSchedulingService from '../../services/recipe-scheduling-service';

const ScheduleRecipeModal = ({ visible, onClose, recipe, userID }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(Platform.OS === 'ios');
  const [isScheduling, setIsScheduling] = useState(false);

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
        Alert.alert(
          'Recipe Scheduled! 📅',
          `"${recipe.label || recipe.recipeName}" is scheduled for ${selectedDate.toLocaleDateString()}.\n\nYou'll receive daily reminders at 9:00 AM:\n• 1 week before\n• 3 days before\n• 2 days before\n• 1 day before\n• On cooking day`,
          [
            {
              text: 'OK',
              onPress: () => onClose(true) // Pass true to indicate success
            }
          ]
        );
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
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Schedule Recipe</Text>
            <TouchableOpacity onPress={() => onClose(false)} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          {/* Recipe Info */}
          <View style={styles.recipeInfo}>
            <Ionicons name="restaurant" size={24} color="#6FA36D" />
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
              >
                <Ionicons name="calendar-outline" size={20} color="#6FA36D" />
                <Text style={styles.dateButtonText}>{formatDate(selectedDate)}</Text>
              </TouchableOpacity>
            )}

            {showDatePicker && (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
                minimumDate={getMinDate()}
                style={styles.datePicker}
              />
            )}
          </View>

          {/* Notification Info */}
          <View style={styles.notificationInfo}>
            <Ionicons name="notifications-outline" size={20} color="#FF9800" />
            <View style={styles.notificationText}>
              <Text style={styles.notificationTitle}>You'll be notified:</Text>
              <Text style={styles.notificationItem}>🟡 1 week before</Text>
              <Text style={styles.notificationItem}>🟠 Daily from 3 days before</Text>
              <Text style={styles.notificationItem}>🔔 On cooking day</Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => onClose(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.scheduleButton, isScheduling && styles.scheduleButtonDisabled]}
              onPress={handleSchedule}
              disabled={isScheduling}
            >
              <Ionicons name="calendar" size={20} color="#fff" />
              <Text style={styles.scheduleButtonText}>
                {isScheduling ? 'Scheduling...' : 'Schedule'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  recipeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  recipeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12,
    flex: 1,
  },
  dateSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#6FA36D',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
    fontWeight: '500',
  },
  datePicker: {
    marginTop: 12,
  },
  notificationInfo: {
    flexDirection: 'row',
    backgroundColor: '#FFF3E0',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  notificationText: {
    marginLeft: 12,
    flex: 1,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  notificationItem: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  scheduleButton: {
    flex: 1,
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#6FA36D',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  scheduleButtonDisabled: {
    opacity: 0.6,
  },
  scheduleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default ScheduleRecipeModal;
