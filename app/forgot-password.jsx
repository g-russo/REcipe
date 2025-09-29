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
import { globalStyles } from '../assets/css/globalStyles';
import { forgotPasswordStyles } from '../assets/css/forgotPasswordStyles';
import TopographicBackground from '../components/TopographicBackground';

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

  const goBack = () => {
    router.back();
  };

  return (
    <TopographicBackground>
      {/* Back button */}
      <TouchableOpacity style={globalStyles.backButton} onPress={goBack}>
        <Text style={forgotPasswordStyles.backArrow}>←</Text>
      </TouchableOpacity>
      
      <View style={globalStyles.card}>
        <View style={globalStyles.formContent}>
          <Text style={globalStyles.title}>Forgot Password</Text>
          
          <Text style={globalStyles.subtitle}>
            Enter the email address so we can send you your 6-digit OTP
          </Text>
          
          <View style={globalStyles.inputContainer}>
            <Text style={globalStyles.inputLabel}>Email</Text>
            <TextInput
              style={globalStyles.input}
              placeholder="demo@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
              placeholderTextColor="#BDC3C7"
            />
          </View>
        </View>
        
        <View style={globalStyles.formActions}>
          <TouchableOpacity 
            style={globalStyles.primaryButton} 
            onPress={handleForgotPassword}
            disabled={loading}
          >
            <Text style={globalStyles.primaryButtonText}>
              {loading ? 'Sending...' : 'Send OTP'}
            </Text>
          </TouchableOpacity>
          
          <View style={forgotPasswordStyles.resendContainer}>
            <Text style={globalStyles.grayText}>Didn't receive email? </Text>
            <TouchableOpacity>
              <Text style={globalStyles.linkText}>Resend</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TopographicBackground>
  );
};

export default ForgotPassword;
