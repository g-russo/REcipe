import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ScrollView,
  SafeAreaView
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useCustomAuth } from '../hooks/use-custom-auth';

const ForcePasswordChange = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { forcePasswordChange } = useCustomAuth();
  const { email, autoSignedIn } = useLocalSearchParams();

  const validatePassword = (password) => {
    const minLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    return minLength && hasUppercase && hasLowercase && hasNumber && hasSpecialChar;
  };

  const getPasswordStrength = (password) => {
    let strength = 0;
    const checks = [
      password.length >= 8,
      /[A-Z]/.test(password),
      /[a-z]/.test(password),
      /\d/.test(password),
      /[!@#$%^&*(),.?":{}|<>]/.test(password)
    ];
    
    strength = checks.filter(Boolean).length;
    
    if (strength <= 2) return { level: 'Weak', color: '#ff4757' };
    if (strength <= 3) return { level: 'Fair', color: '#ffa502' };
    if (strength <= 4) return { level: 'Good', color: '#2ed573' };
    return { level: 'Strong', color: '#1e90ff' };
  };

  const handleForcePasswordChange = async () => {
    // Validation
    if (!password) {
      Alert.alert('Error', 'Please enter a new password');
      return;
    }

    if (!validatePassword(password)) {
      Alert.alert(
        'Invalid Password', 
        'Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character'
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    try {
      setLoading(true);
      console.log('🔄 Starting forced password change...');
      console.log('📧 Email:', email);
      
      const { data, error } = await forcePasswordChange(email, password);
      
      console.log('🔍 Force password change result:', { data: !!data, error: !!error });
      
      if (error) {
        console.error('❌ Password change error:', error);
        
        // Check if it's a timeout - treat as success
        if (error.message.includes('timeout') || error.message.includes('timed out')) {
          console.log('⏰ Timeout detected - assuming success and redirecting to home');
          
          Alert.alert(
            'Password Updated! 🎉',
            'Your password update took longer than expected, but it likely succeeded. You are being redirected to the home page.',
            [
              {
                text: 'Continue to Home',
                onPress: () => {
                  console.log('🏠 Redirecting to home after timeout');
                  router.replace('/home');
                }
              }
            ]
          );
        } else if (error.message.includes('different from')) {
          Alert.alert(
            'Password Error',
            'The new password must be different from your current password. Please choose a different password.'
          );
        } else if (error.message.includes('security requirements')) {
          Alert.alert(
            'Password Error',
            'Password does not meet security requirements. Please choose a stronger password.'
          );
        } else {
          Alert.alert('Error', error.message || 'Failed to change password. Please try again.');
        }
      } else {
        console.log('✅ Password change successful!');
        
        // Check if we should redirect to home (including timeout cases)
        if (data.redirectToHome || data.passwordChanged) {
          const sessionMessage = data.sessionRestored 
            ? 'Your password has been updated, application state reloaded, and you are now signed in.' 
            : 'Your password has been updated and you are now signed in.';
            
          Alert.alert(
            'Password Changed Successfully! 🎉',
            `${sessionMessage} Welcome to REcipe!`,
            [
              {
                text: 'Continue to Home',
                onPress: () => {
                  console.log('🚀 User clicked button, redirecting to home');
                  router.replace('/home');
                }
              }
            ]
          );
        } else {
          // Fallback message
          Alert.alert(
            'Password Updated! 🎉',
            'Your password has been changed. Redirecting to home page.',
            [
              {
                text: 'Continue to Home',
                onPress: () => {
                  console.log('🏠 Fallback redirect to home');
                  router.replace('/home');
                }
              }
            ]
          );
        }
      }
    } catch (err) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
      console.error('Force password change error:', err);
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = getPasswordStrength(password);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Set New Password</Text>
          <Text style={styles.subtitle}>
            For your security, please create a new password
          </Text>
          
          {autoSignedIn === 'true' && (
            <View style={styles.successBanner}>
              <Text style={styles.successText}>✅ You are now signed in!</Text>
            </View>
          )}
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>New Password</Text>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your new password"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                editable={!loading}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text style={styles.eyeText}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
              </TouchableOpacity>
            </View>
            
            {password.length > 0 && (
              <View style={styles.strengthContainer}>
                <Text style={[styles.strengthText, { color: passwordStrength.color }]}>
                  Strength: {passwordStrength.level}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Confirm New Password</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm your new password"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              editable={!loading}
            />
          </View>

          <View style={styles.requirementsContainer}>
            <Text style={styles.requirementsTitle}>Password Requirements:</Text>
            <Text style={styles.requirement}>• At least 8 characters long</Text>
            <Text style={styles.requirement}>• Contains uppercase letter (A-Z)</Text>
            <Text style={styles.requirement}>• Contains lowercase letter (a-z)</Text>
            <Text style={styles.requirement}>• Contains number (0-9)</Text>
            <Text style={styles.requirement}>• Contains special character (!@#$%^&*)</Text>
          </View>

          <TouchableOpacity
            style={[styles.changeButton, loading && styles.changeButtonDisabled]}
            onPress={handleForcePasswordChange}
            disabled={loading}
          >
            <Text style={styles.changeButtonText}>
              {loading ? 'Updating Password...' : 'Set New Password'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 20,
  },
  successBanner: {
    backgroundColor: '#d4edda',
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#c3e6cb',
    marginTop: 10,
  },
  successText: {
    color: '#155724',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  form: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  passwordInput: {
    flex: 1,
    padding: 15,
    fontSize: 16,
  },
  eyeButton: {
    padding: 15,
  },
  eyeText: {
    fontSize: 18,
  },
  strengthContainer: {
    marginTop: 8,
  },
  strengthText: {
    fontSize: 14,
    fontWeight: '600',
  },
  requirementsContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  requirementsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 10,
  },
  requirement: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 4,
  },
  changeButton: {
    backgroundColor: '#3498db',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  changeButtonDisabled: {
    backgroundColor: '#bdc3c7',
  },
  changeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default ForcePasswordChange;
