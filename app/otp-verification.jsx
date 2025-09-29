import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useCustomAuth } from '../hooks/useCustomAuth';
import { globalStyles } from '../assets/css/globalStyles';
import { otpVerificationStyles } from '../assets/css/otpVerificationStyles';
import TopographicBackground from '../components/TopographicBackground';

const OTPVerification = () => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  const inputRefs = useRef([]);
  const { verifyOTP, resendOTP } = useCustomAuth();
  const { email } = useLocalSearchParams();

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  const handleOtpChange = (index, value) => {
    // Only allow numbers
    if (!/^\d*$/.test(value)) return;
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Move to next input if value is entered
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (index, key) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOTP = async () => {
    const otpString = otp.join('');
    
    if (otpString.length !== 6) {
      Alert.alert('Error', 'Please enter a valid 6-digit verification code');
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await verifyOTP(email, otpString, 'signup');

      if (error) {
        if (error.message.includes('expired')) {
          Alert.alert(
            'Code Expired',
            'Your verification code has expired. Please request a new one.',
            [
              {
                text: 'Resend Code',
                onPress: handleResendOTP
              },
              {
                text: 'Cancel',
                style: 'cancel'
              }
            ]
          );
        } else if (error.message.includes('invalid') || error.message.includes('Invalid')) {
          Alert.alert('Invalid Code', 'The verification code you entered is incorrect. Please try again.');
        } else {
          Alert.alert('Verification Failed', error.message);
        }
      } else {
        Alert.alert(
          'Success!',
          'Your email has been verified successfully! You can now sign in to your account.',
          [
            {
              text: 'Sign In Now',
              onPress: () => router.replace('/signin')
            }
          ]
        );
      }
    } catch (err) {
      console.error('OTP Verification error:', err);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    try {
      setResendLoading(true);
      const { error } = await resendOTP(email, 'signup');

      if (error) {
        Alert.alert('Error', error.message);
      } else {
        Alert.alert('Success', 'A new verification code has been sent to your email');
        setCountdown(60);
        setCanResend(false);
        setOtp(['', '', '', '', '', '']); // Clear current OTP input
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to resend code. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  const goBack = () => {
    router.back();
  };

  return (
    <TopographicBackground>
      {/* Back button */}
      <TouchableOpacity style={globalStyles.backButton} onPress={goBack}>
        <Text style={otpVerificationStyles.backArrow}>←</Text>
      </TouchableOpacity>
      
      <View style={globalStyles.card}>
        <View style={globalStyles.formContent}>
          <Text style={globalStyles.title}>Email Verification</Text>
          
          <Text style={globalStyles.subtitle}>
            Enter the verification code we just sent to your email address.
          </Text>
          
          {/* OTP Input Boxes */}
          <View style={globalStyles.otpContainer}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => inputRefs.current[index] = ref}
                style={[
                  globalStyles.otpBox,
                  digit && globalStyles.otpBoxFilled
                ]}
                value={digit}
                onChangeText={(value) => handleOtpChange(index, value)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
                keyboardType="numeric"
                maxLength={1}
                textAlign="center"
              />
            ))}
          </View>
        </View>
        
        <View style={globalStyles.formActions}>
          <TouchableOpacity
            style={globalStyles.primaryButton}
            onPress={handleVerifyOTP}
            disabled={loading || otp.join('').length !== 6}
          >
            <Text style={globalStyles.primaryButtonText}>
              {loading ? 'Verifying...' : 'Verify'}
            </Text>
          </TouchableOpacity>
          
          <View style={otpVerificationStyles.resendContainer}>
            {canResend ? (
              <TouchableOpacity
                onPress={handleResendOTP}
                disabled={resendLoading}
              >
                <Text style={globalStyles.linkText}>
                  {resendLoading ? 'Sending...' : 'Resend'}
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={globalStyles.grayText}>
                Didn't receive email? Resend
              </Text>
            )}
          </View>
        </View>
      </View>
    </TopographicBackground>
  );
};

export default OTPVerification;
