import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useCustomAuth } from '../hooks/use-custom-auth';

const OTPVerification = () => {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

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

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      Alert.alert('Error', 'Please enter a valid 6-digit OTP');
      return;
    }

    // Basic OTP format validation
    if (!/^\d{6}$/.test(otp)) {
      Alert.alert('Error', 'OTP must contain only numbers');
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await verifyOTP(email, otp, 'signup');

      if (error) {
        // Handle different types of OTP errors
        if (error.message.includes('expired')) {
          Alert.alert(
            'OTP Expired',
            'Your verification code has expired. Please request a new one.',
            [
              {
                text: 'Resend OTP',
                onPress: handleResendOTP
              },
              {
                text: 'Cancel',
                style: 'cancel'
              }
            ]
          );
        } else if (error.message.includes('invalid') || error.message.includes('Invalid')) {
          Alert.alert('Invalid OTP', 'The verification code you entered is incorrect. Please try again.');
        } else if (error.message.includes('too many')) {
          Alert.alert(
            'Too Many Attempts',
            'Too many failed attempts. Please wait before trying again or request a new code.',
            [
              {
                text: 'Resend OTP',
                onPress: handleResendOTP
              },
              {
                text: 'OK',
                style: 'cancel'
              }
            ]
          );
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
        setOtp(''); // Clear current OTP input
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to resend OTP. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  const formatOTP = (text) => {
    // Only allow numbers and limit to 6 digits
    const numbers = text.replace(/[^0-9]/g, '');
    return numbers.slice(0, 6);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verify Your Email</Text>

      <Text style={styles.subtitle}>
        We've sent a 6-digit verification code to:
      </Text>

      <Text style={styles.email}>{email}</Text>

      <Text style={styles.instruction}>
        Enter the verification code below:
      </Text>

      <TextInput
        style={styles.otpInput}
        placeholder="000000"
        value={otp}
        onChangeText={(text) => setOtp(formatOTP(text))}
        keyboardType="numeric"
        maxLength={6}
        textAlign="center"
        fontSize={24}
        letterSpacing={5}
      />

      <TouchableOpacity
        style={[styles.button, (!otp || otp.length !== 6) && styles.buttonDisabled]}
        onPress={handleVerifyOTP}
        disabled={loading || !otp || otp.length !== 6}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Verifying...' : 'Verify OTP'}
        </Text>
      </TouchableOpacity>

      <View style={styles.resendContainer}>
        {canResend ? (
          <TouchableOpacity
            onPress={handleResendOTP}
            disabled={resendLoading}
          >
            <Text style={styles.resendText}>
              {resendLoading ? 'Sending...' : 'Resend OTP'}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.countdownText}>
            Resend OTP in {countdown}s
          </Text>
        )}
      </View>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <Text style={styles.backButtonText}>Back to Sign Up</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 10,
  },
  email: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    color: '#007AFF',
    marginBottom: 30,
  },
  instruction: {
    fontSize: 16,
    textAlign: 'center',
    color: '#333',
    marginBottom: 30,
  },
  otpInput: {
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 10,
    padding: 20,
    marginBottom: 30,
    backgroundColor: '#f8f9fa',
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 18,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  resendContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  resendText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  countdownText: {
    color: '#666',
    fontSize: 16,
  },
  backButton: {
    alignItems: 'center',
    marginTop: 10,
  },
  backButtonText: {
    color: '#666',
    fontSize: 16,
  },
});

export default OTPVerification;
