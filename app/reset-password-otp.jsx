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
import { useCustomAuth } from '../hooks/useCustomAuth';

const ResetPasswordOTP = () => {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  const { verifyPasswordResetOTP, resendPasswordResetOTP } = useCustomAuth();
  const { email, returnTo } = useLocalSearchParams();

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
      Alert.alert('Error', 'Please enter a valid 6-digit verification code');
      return;
    }

    // Basic OTP format validation
    if (!/^\d{6}$/.test(otp)) {
      Alert.alert('Error', 'Verification code must contain only numbers');
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await verifyPasswordResetOTP(email, otp);

      if (error) {
        // Handle different types of OTP errors
        if (error.message.includes('expired')) {
          Alert.alert(
            'Code Expired',
            'Your verification code has expired. Please request a new one.',
            [
              {
                text: 'Send New Code',
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
        } else if (error.message.includes('too many')) {
          Alert.alert(
            'Too Many Attempts',
            'Too many failed attempts. Please wait before trying again or request a new code.',
            [
              {
                text: 'Send New Code',
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
        // OTP verified successfully
        if (data.autoSignedIn && data.mustChangePassword) {
          // User is automatically signed in but must change password
          Alert.alert(
            'Welcome Back! 🎉',
            'Your identity has been verified and you are now signed in. For security, please set a new password.',
            [
              {
                text: 'Set New Password',
                onPress: () => {
                  router.push({
                    pathname: '/force-password-change',
                    params: { 
                      email: email,
                      autoSignedIn: 'true'
                    }
                  });
                }
              }
            ]
          );
        } else {
          // Fallback to force password change flow
          router.push({
            pathname: '/force-password-change',
            params: { 
              email: email,
              autoSignedIn: 'true'
            }
          });
        }
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

      const { error } = await resendPasswordResetOTP(email);

      if (error) {
        Alert.alert('Error', error.message);
      } else {
        Alert.alert('Success', 'A new verification code has been sent to your email');
        setCountdown(60);
        setCanResend(false);
        setOtp(''); // Clear current OTP input
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to resend verification code. Please try again.');
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
      <Text style={styles.title}>Reset Password</Text>

      <Text style={styles.subtitle}>
        Enter the 6-digit verification code sent to:
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
        editable={!loading}
      />

      <TouchableOpacity
        style={[styles.button, (!otp || otp.length !== 6 || loading) && styles.buttonDisabled]}
        onPress={handleVerifyOTP}
        disabled={loading || !otp || otp.length !== 6}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Verifying...' : 'Verify Code'}
        </Text>
      </TouchableOpacity>

      <View style={styles.resendContainer}>
        {canResend ? (
          <TouchableOpacity
            onPress={handleResendOTP}
            disabled={resendLoading}
            style={styles.resendButton}
          >
            <Text style={styles.resendText}>
              {resendLoading ? 'Sending...' : 'Send New Code'}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.countdownText}>
            Send new code in {countdown}s
          </Text>
        )}
      </View>

      <View style={styles.helpSection}>
        <Text style={styles.helpTitle}>📧 Didn't receive the code?</Text>
        <Text style={styles.helpText}>
          • Check your spam/junk folder{'\n'}
          • Make sure you entered the correct email{'\n'}
          • Wait a few minutes and try resending{'\n'}
          • Contact support if issues persist
        </Text>
      </View>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <Text style={styles.backButtonText}>← Back to Email Entry</Text>
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
    marginBottom: 30,
  },
  resendButton: {
    padding: 10,
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
  helpSection: {
    backgroundColor: '#f0f8ff',
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
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
  backButton: {
    alignItems: 'center',
    marginTop: 10,
  },
  backButtonText: {
    color: '#666',
    fontSize: 16,
  },
});

export default ResetPasswordOTP;
