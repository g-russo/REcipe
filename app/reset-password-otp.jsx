import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Animated,
  Keyboard,
  Platform
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useLocalSearchParams, router } from 'expo-router';
import { useCustomAuth } from '../hooks/use-custom-auth';
import { globalStyles } from '../assets/css/globalStyles';
import TopographicBackground from '../components/TopographicBackground';

const ResetPasswordOTP = () => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(null);
  const inputRefs = useRef([]);
  const translateY = useRef(new Animated.Value(0)).current;

  const { verifyPasswordResetOTP, resendPasswordResetOTP } = useCustomAuth();
  const { email, returnTo } = useLocalSearchParams();

  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        Animated.timing(translateY, {
          toValue: -e.endCoordinates.height / 2,
          duration: Platform.OS === 'ios' ? 250 : 200,
          useNativeDriver: true,
        }).start();
      }
    );

    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        Animated.timing(translateY, {
          toValue: 0,
          duration: Platform.OS === 'ios' ? 250 : 200,
          useNativeDriver: true,
        }).start();
      }
    );

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  const handleOtpChange = (text, index) => {
    // Handle paste - if text is longer than 1 character, it's likely a paste
    if (text.length > 1) {
      // Extract only numbers from pasted text
      const numbers = text.replace(/\D/g, '');
      
      if (numbers.length > 0) {
        const newOtp = [...otp];
        // Fill the OTP boxes starting from current index
        for (let i = 0; i < numbers.length && (index + i) < 6; i++) {
          newOtp[index + i] = numbers[i];
        }
        setOtp(newOtp);
        
        // Focus the next empty box or the last box
        const nextIndex = Math.min(index + numbers.length, 5);
        inputRefs.current[nextIndex]?.focus();
      }
      return;
    }

    // Single character input - only allow numbers
    if (text && !/^\d$/.test(text)) return;

    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    // Auto-focus next input
    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e, index) => {
    // Handle backspace
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOTP = async () => {
    const otpString = otp.join('');
    
    if (!otpString || otpString.length !== 6) {
      Alert.alert('Error', 'Please enter a valid 6-digit verification code');
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await verifyPasswordResetOTP(email, otpString);

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
        setOtp(['', '', '', '', '', '']); // Clear current OTP input
        inputRefs.current[0]?.focus();
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to resend verification code. Please try again.');
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
        <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#81A969" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <Path d="m15 18-6-6 6-6"/>
        </Svg>
      </TouchableOpacity>

      <Animated.View 
        style={[globalStyles.card, { 
          paddingTop: 8, 
          paddingBottom: 10, 
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          marginTop: 0,
          minHeight: '55%',
          borderBottomLeftRadius: 0, 
          borderBottomRightRadius: 0,
          transform: [{ translateY }]
        }]}
        pointerEvents="box-none"
      >
        <View style={[globalStyles.formContent, { flex: 0 }]}>
          <View style={{ position: 'relative', alignSelf: 'flex-start', marginTop: 0, marginBottom: 20 }}>
            <Text style={[globalStyles.title, { marginBottom: 6, paddingBottom: 0 }]}>Reset Password</Text>
            <View
              style={{
                position: 'absolute',
                left: 0,
                bottom: 0,
                height: 4,
                width: 160,
                backgroundColor: '#97B88B',
                borderRadius: 4,
              }}
            />
          </View>

          <Text style={[globalStyles.subtitle, { marginLeft: 8, marginTop: 18, marginBottom: 10 }]}>
            Enter the verification code we just sent to your email address.
          </Text>

          {/* OTP Input Boxes */}
          <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
              <View key={index} style={{ flex: 1, maxWidth: 50 }}>
                <TextInput
                  ref={(ref) => (inputRefs.current[index] = ref)}
                  style={[
                    globalStyles.otpBox,
                    digit && globalStyles.otpBoxFilled,
                    focusedIndex === index && {
                      borderColor: '#81A969',
                      borderWidth: 2,
                    }
                  ]}
                  value={digit}
                  onChangeText={(text) => handleOtpChange(text, index)}
                  onKeyPress={(e) => handleKeyPress(e, index)}
                  onFocus={() => {
                    console.log('Input focused:', index);
                    setFocusedIndex(index);
                  }}
                  onBlur={() => {
                    console.log('Input blurred');
                    setFocusedIndex(null);
                  }}
                  keyboardType="number-pad"
                  returnKeyType="next"
                  maxLength={1}
                  textAlign="center"
                  editable={!loading}
                  caretHidden={false}
                  selectTextOnFocus={true}
                  contextMenuHidden={false}
                />
              </View>
            ))}
          </View>
        </View>

        <View style={[globalStyles.formActions, { marginTop: 20, marginBottom: 0, paddingTop: 0 }]}>
          <TouchableOpacity
            style={globalStyles.primaryButton}
            onPress={handleVerifyOTP}
            disabled={loading || otp.join('').length !== 6}
          >
            <Text style={globalStyles.primaryButtonText}>
              {loading ? 'Verifying...' : 'Verify Code'}
            </Text>
          </TouchableOpacity>

          <View style={styles.resendContainer}>
            <Text style={globalStyles.grayText}>Didn't receive email? </Text>
            {canResend ? (
              <TouchableOpacity onPress={handleResendOTP} disabled={resendLoading}>
                <Text style={globalStyles.linkText}>
                  {resendLoading ? 'Sending...' : 'Resend'}
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={globalStyles.grayText}>
                Resend in {countdown}s
              </Text>
            )}
          </View>
        </View>
      </Animated.View>
    </TopographicBackground>
  );
};

const styles = StyleSheet.create({
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 32,
    paddingHorizontal: 4,
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
});

export default ResetPasswordOTP;
