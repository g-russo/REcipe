import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ScrollView
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useCustomAuth } from '../hooks/use-custom-auth';

const NewPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { resetPassword } = useCustomAuth();
  const { email, resetToken, returnTo } = useLocalSearchParams();

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

  const handleResetPassword = async () => {
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
      console.log('🔄 Starting password reset...');
      console.log('📧 Email:', email);
      
      // Add a timeout to prevent hanging (increased to 30 seconds for background operations)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Password reset timed out')), 30000)
      );
      
      const resetPromise = resetPassword(email, password, resetToken);
      
      const { data, error } = await Promise.race([resetPromise, timeoutPromise]);
      
      console.log('🔍 Reset password result:', { data: !!data, error: !!error });
      
      if (error) {
        console.error('❌ Password reset error:', error);
        if (error.message.includes('expired') || error.message.includes('invalid')) {
          Alert.alert(
            'Reset Session Expired',
            'Your password reset session has expired. Please start the process again.',
            [
              {
                text: 'Start Over',
                onPress: () => router.replace('/forgot-password')
              }
            ]
          );
        } else if (error.message.includes('No active session')) {
          Alert.alert(
            'Session Expired',
            'Your verification session has expired. Please start the password reset process again.',
            [
              {
                text: 'Start Over',
                onPress: () => router.replace('/forgot-password')
              }
            ]
          );
        } else if (error.message.includes('timed out')) {
          Alert.alert(
            'Request Timed Out',
            'The password reset is taking too long. Please try again.',
            [
              {
                text: 'Try Again',
                onPress: () => setLoading(false)
              },
              {
                text: 'Start Over',
                onPress: () => router.replace('/forgot-password')
              }
            ]
          );
        } else {
          Alert.alert('Error', error.message || 'Failed to reset password. Please try again.');
        }
      } else {
        console.log('✅ Password reset successful!');
        
        if (data.autoSignedIn) {
          // User is automatically signed in, redirect to home
          Alert.alert(
            'Password Reset Successful! 🎉',
            'Your password has been changed and you are now signed in. Welcome back!',
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
        } else if (data.requiresManualSignIn) {
          // Auto sign-in failed, redirect to sign-in page
          Alert.alert(
            'Password Reset Successful! 🎉',
            'Your password has been changed successfully. Please sign in with your new password.',
            [
              {
                text: 'Sign In Now',
                onPress: () => {
                  console.log('🚀 User clicked button, redirecting to sign in');
                  router.replace('/signin');
                }
              }
            ]
          );
        } else {
          // Fallback to sign-in redirect
          Alert.alert(
            'Password Reset Successful! 🎉',
            'Your password has been changed successfully. You can now sign in with your new password.',
            [
              {
                text: 'Sign In Now',
                onPress: () => {
                  console.log('🚀 User clicked button, redirecting to sign in');
                  router.replace('/signin');
                }
              }
            ]
          );
        }
      }
    } catch (err) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
      console.error('Reset password error:', err);
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = getPasswordStrength(password);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Create New Password</Text>
      
      <Text style={styles.subtitle}>
        Create a strong password for your REcipe account
      </Text>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>New Password</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your new password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          editable={!loading}
        />
        
        {password.length > 0 && (
          <View style={styles.strengthContainer}>
            <Text style={styles.strengthLabel}>Password Strength: </Text>
            <Text style={[styles.strengthValue, { color: passwordStrength.color }]}>
              {passwordStrength.level}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Confirm Password</Text>
        <TextInput
          style={styles.input}
          placeholder="Confirm your new password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          editable={!loading}
        />
        
        {confirmPassword.length > 0 && (
          <View style={styles.matchContainer}>
            <Text style={[
              styles.matchText,
              { color: password === confirmPassword ? '#2ed573' : '#ff4757' }
            ]}>
              {password === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
            </Text>
          </View>
        )}
      </View>

      <TouchableOpacity 
        style={styles.showPasswordButton}
        onPress={() => setShowPassword(!showPassword)}
      >
        <Text style={styles.showPasswordText}>
          {showPassword ? '👁️ Hide Passwords' : '👁️ Show Passwords'}
        </Text>
      </TouchableOpacity>

      <View style={styles.requirementsContainer}>
        <Text style={styles.requirementsTitle}>Password Requirements:</Text>
        <View style={styles.requirementsList}>
          <Text style={[styles.requirement, password.length >= 8 && styles.requirementMet]}>
            • At least 8 characters long
          </Text>
          <Text style={[styles.requirement, /[A-Z]/.test(password) && styles.requirementMet]}>
            • One uppercase letter (A-Z)
          </Text>
          <Text style={[styles.requirement, /[a-z]/.test(password) && styles.requirementMet]}>
            • One lowercase letter (a-z)
          </Text>
          <Text style={[styles.requirement, /\d/.test(password) && styles.requirementMet]}>
            • One number (0-9)
          </Text>
          <Text style={[styles.requirement, /[!@#$%^&*(),.?":{}|<>]/.test(password) && styles.requirementMet]}>
            • One special character (!@#$%^&*)
          </Text>
        </View>
      </View>
      
      <TouchableOpacity 
        style={[
          styles.button, 
          (loading || !password || !confirmPassword || !validatePassword(password) || password !== confirmPassword) && styles.buttonDisabled
        ]} 
        onPress={handleResetPassword}
        disabled={loading || !password || !confirmPassword || !validatePassword(password) || password !== confirmPassword}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Updating Password...' : 'Update Password'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => router.replace('/signin')}
      >
        <Text style={styles.cancelButtonText}>Cancel and Sign In</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 40,
    lineHeight: 24,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 18,
    borderRadius: 10,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
  },
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  strengthLabel: {
    fontSize: 14,
    color: '#666',
  },
  strengthValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  matchContainer: {
    marginTop: 8,
  },
  matchText: {
    fontSize: 14,
    fontWeight: '500',
  },
  showPasswordButton: {
    alignSelf: 'center',
    marginBottom: 20,
    padding: 10,
  },
  showPasswordText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
  requirementsContainer: {
    backgroundColor: '#f0f8ff',
    padding: 20,
    borderRadius: 10,
    marginBottom: 30,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  requirementsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  requirementsList: {
    gap: 5,
  },
  requirement: {
    fontSize: 14,
    color: '#666',
  },
  requirementMet: {
    color: '#2ed573',
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 18,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 15,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cancelButton: {
    alignItems: 'center',
    padding: 15,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
  },
});

export default NewPassword;
