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
import { useCustomAuth } from '../hooks/use-custom-auth';
import { router, useLocalSearchParams } from 'expo-router';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { returnTo } = useLocalSearchParams();
  const { requestPasswordReset } = useCustomAuth();

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await requestPasswordReset(email);
      
      if (error) {
        if (error.message.includes('not found') || error.message.includes('User not found')) {
          Alert.alert(
            'Email Not Found',
            'No account found with this email address. Please check your email or create a new account.'
          );
        } else {
          Alert.alert('Error', error.message);
        }
      } else {
        Alert.alert(
          'Reset Code Sent!',
          'We\'ve sent a 6-digit verification code to your email. Please check your inbox and enter the code on the next screen.',
          [
            {
              text: 'Continue',
              onPress: () => {
                router.push({
                  pathname: '/reset-password-otp',
                  params: { 
                    email: email,
                    returnTo: returnTo || '/signin'
                  }
                });
              }
            }
          ]
        );
      }
    } catch (err) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
      console.error('Forgot password error:', err);
    } finally {
      setLoading(false);
    }
  };

  const goToSignIn = () => {
    router.push(returnTo || '/signin');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Forgot Password?</Text>
      
      <Text style={styles.subtitle}>
        Don't worry! Enter your email address and we'll send you a verification code to reset your password.
      </Text>
      
      <TextInput
        style={styles.input}
        placeholder="Enter your email address"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!loading}
      />
      
      <TouchableOpacity 
        style={[styles.button, loading && styles.buttonDisabled]} 
        onPress={handleForgotPassword}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Sending Code...' : 'Send Reset Code'}
        </Text>
      </TouchableOpacity>
      
      <View style={styles.helpSection}>
        <Text style={styles.helpTitle}>💡 What happens next?</Text>
        <Text style={styles.helpText}>
          1. We'll send a 6-digit code to your email{'\n'}
          2. Enter the code on the verification screen{'\n'}
          3. Create a new secure password{'\n'}
          4. Sign in with your new password
        </Text>
      </View>
      
      <TouchableOpacity onPress={goToSignIn} style={styles.backToSignIn}>
        <Text style={styles.linkText}>
          Remember your password? Sign In
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
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 18,
    marginBottom: 25,
    borderRadius: 10,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 18,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 30,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  helpSection: {
    backgroundColor: '#f0f8ff',
    padding: 20,
    borderRadius: 10,
    marginBottom: 30,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  helpText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  backToSignIn: {
    alignItems: 'center',
    marginTop: 10,
  },
  linkText: {
    textAlign: 'center',
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default ForgotPassword;
