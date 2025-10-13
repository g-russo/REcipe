import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { 
  scheduleLocalNotification, 
  sendLocalNotification,
  getNotificationPermissions,
  registerForPushNotificationsAsync,
} from '../services/notification-service';

export default function NotificationTest() {
  const handleTestImmediate = async () => {
    await sendLocalNotification(
      '🍳 SousChef Alert!',
      'Your pantry needs restocking!',
      { type: 'pantry_reminder', screen: 'pantry' }
    );
    Alert.alert('Success', 'Notification sent! Check your notification tray.');
  };

  const handleTestScheduled = async () => {
    await scheduleLocalNotification(
      '🔥 New Recipe Available!',
      'Check out this amazing pasta recipe',
      { type: 'new_recipe', recipeId: '123', screen: 'recipe-detail' },
      3 // 3 seconds
    );
    Alert.alert('Success', 'Notification scheduled for 3 seconds from now!');
  };

  const handleCheckPermissions = async () => {
    const status = await getNotificationPermissions();
    Alert.alert('Permission Status', status);
  };

  const handleRegisterToken = async () => {
    const token = await registerForPushNotificationsAsync();
    if (token) {
      Alert.alert('Push Token', token.substring(0, 50) + '...');
    } else {
      Alert.alert('Error', 'Failed to get push token');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔔 Notification Testing</Text>
      
      <TouchableOpacity style={styles.button} onPress={handleTestImmediate}>
        <Text style={styles.buttonText}>Send Immediate Notification</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={handleTestScheduled}>
        <Text style={styles.buttonText}>Schedule Notification (3s)</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={handleCheckPermissions}>
        <Text style={styles.buttonText}>Check Permissions</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={handleRegisterToken}>
        <Text style={styles.buttonText}>Get Push Token</Text>
      </TouchableOpacity>

      <Text style={styles.note}>
        📝 Note: Test on a physical device for best results
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#FF6B6B',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  note: {
    marginTop: 20,
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
  },
});
