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
import { useCustomAuth } from '../hooks/useCustomAuth';

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
      console.log('🔙 Return to:', returnTo);
      
      const { data, error } = await resetPassword(email, password, resetToken);
      
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
                onPress: () => router.replace({
                  pathname: '/forgot-password',
                  params: { returnTo: returnTo || '/signin' }
                })
              }
            ]
          );
        } else {
          Alert.alert('Error', error.message);
        }
      } else {
        console.log('✅ Password reset successful!');
        const redirectPath = returnTo || '/signin';
        console.log('🎯 Redirecting to:', redirectPath);
        
        const redirectMessage = returnTo && returnTo !== '/signin' 
          ? 'You can now continue where you left off.' 
          : 'You can now sign in with your new password.';
          
        Alert.alert(
          'Password Reset Successful! 🎉',
          `Your password has been changed successfully. ${redirectMessage}`,
          [
            {
              text: returnTo && returnTo !== '/signin' ? 'Continue' : 'Sign In Now',
              onPress: () => {
                console.log('🚀 User clicked button, redirecting to:', redirectPath);
                router.replace(redirectPath);
              }
            }
          ]
        );
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
        onPress={() => router.replace(returnTo || '/signin')}
      >
        <Text style={styles.cancelButtonText}>
          {returnTo && returnTo !== '/signin' ? 'Cancel and Go Back' : 'Cancel and Sign In'}
        </Text>
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
