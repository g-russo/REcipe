import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  StatusBar,
  Platform,
  Animated,
  Keyboard
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { useLocalSearchParams, router } from 'expo-router';
import { useCustomAuth } from '../hooks/use-custom-auth';
import { globalStyles } from '../assets/css/globalStyles';
import { otpVerificationStyles } from '../assets/css/otpVerificationStyles';
import TopographicBackground from '../components/TopographicBackground';
import AppAlert from '../components/common/app-alert';
import rateLimiterService from '../services/rate-limiter-service';

const OTPVerification = () => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successAlert, setSuccessAlert] = useState({ visible: false, message: '' });
  const translateY = useRef(new Animated.Value(0)).current;

  const inputRefs = useRef([]);
  const { verifyOTP, resendOTP } = useCustomAuth();
  const { email } = useLocalSearchParams();

  const showStyledError = (message) => {
    setErrorMessage(message);
    setShowErrorModal(true);
  };

  const showStyledSuccess = () => {
    setShowSuccessModal(true);
  };

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        Animated.timing(translateY, {
          toValue: -e.endCoordinates.height / 2,
          duration: Platform.OS === 'ios' ? 250 : 200,
          useNativeDriver: true,
        }).start();
      }
    );

    const keyboardWillHide = Keyboard.addListener(
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
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

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
    // Check IP-based rate limiting first
    const clientIP = await rateLimiterService.getClientIP();
    const rateLimitCheck = rateLimiterService.checkRateLimit(clientIP);

    if (!rateLimitCheck.allowed) {
      if (rateLimitCheck.reason === 'IP_BLOCKED') {
        showStyledError('Too many requests from this network. Please try again later.');
      } else if (rateLimitCheck.reason === 'RATE_LIMIT_EXCEEDED') {
        showStyledError('Too many verification attempts. Please try again in a few minutes.');
      }
      return;
    }

    const otpString = otp.join('');

    if (otpString.length !== 6) {
      showStyledError('Please enter a valid 6-digit verification code');
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await verifyOTP(email, otpString, 'signup');

      if (error) {
        if (error.message.includes('expired')) {
          showStyledError('Your verification code has expired. Please request a new one.');
        } else if (error.message.includes('invalid') || error.message.includes('Invalid')) {
          showStyledError('The verification code you entered is incorrect. Please try again.');
        } else {
          showStyledError(error.message);
        }
      } else {
        showStyledSuccess();
      }
    } catch (err) {
      console.error('OTP Verification error:', err);
      showStyledError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    // Check IP-based rate limiting
    const clientIP = await rateLimiterService.getClientIP();
    const rateLimitCheck = rateLimiterService.checkRateLimit(clientIP);

    if (!rateLimitCheck.allowed) {
      if (rateLimitCheck.reason === 'IP_BLOCKED') {
        showStyledError('Too many requests from this network. Please try again later.');
      } else if (rateLimitCheck.reason === 'RATE_LIMIT_EXCEEDED') {
        showStyledError('Too many resend attempts. Please try again in a few minutes.');
      }
      return;
    }

    try {
      setResendLoading(true);
      const { error } = await resendOTP(email, 'signup');

      if (error) {
        showStyledError(error.message);
      } else {
        // Show success modal
        setSuccessAlert({ visible: true, message: 'A new verification code has been sent to your email' });
        setCountdown(60);
        setCanResend(false);
        setOtp(['', '', '', '', '', '']); // Clear current OTP input
      }
    } catch (err) {
      showStyledError('Failed to resend code. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  const goBack = () => {
    router.back();
  };

  return (
    <TopographicBackground>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      {/* Back button */}
      <TouchableOpacity style={[globalStyles.backButton, {
        top: Platform.OS === 'android' ? hp('5%') + (StatusBar.currentHeight || 0) : hp('5%'),
        left: wp('5%'),
        padding: wp('2%')
      }]} onPress={goBack}>
        <Svg width={wp('6%')} height={wp('6%')} viewBox="0 0 24 24" fill="none" stroke="#81A969" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <Path d="m15 18-6-6 6-6" />
        </Svg>
      </TouchableOpacity>

      <Animated.View style={[globalStyles.card, {
        paddingTop: hp('1.8%'),
        paddingBottom: hp('9%'),
        paddingHorizontal: wp('8%'),
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        transform: [{ translateY }]
      }]}>
        <View style={globalStyles.formContent}>
          <View style={{ position: 'relative', alignSelf: 'flex-start', marginBottom: hp('1.5%') }}>
            <Text style={[globalStyles.title, { marginBottom: hp('0.6%'), fontSize: wp('8%'), lineHeight: wp('9.5%') }]}>Email Verification</Text>
            <View
              style={{
                position: 'absolute',
                left: 0,
                bottom: 0,
                height: hp('0.4%'),
                width: wp('50%'),
                backgroundColor: '#97B88B',
                borderRadius: hp('0.4%'),
              }}
            />
          </View>

          <Text style={[globalStyles.subtitle, { marginLeft: 0, marginTop: hp('0.8%'), marginBottom: hp('2%'), fontSize: wp('3.8%'), lineHeight: wp('5%') }]}>
            Enter the verification code we just sent to your email address.
          </Text>

          {/* OTP Input Boxes */}
          <View style={[globalStyles.otpContainer, { marginTop: hp('2.5%'), justifyContent: 'center', alignItems: 'center' }]}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => inputRefs.current[index] = ref}
                style={[
                  globalStyles.otpBox,
                  digit && globalStyles.otpBoxFilled,
                  {
                    width: wp('12%'),
                    height: hp('7%'),
                    fontSize: wp('6%'),
                    borderRadius: wp('2%'),
                    marginHorizontal: wp('1%')
                  }
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

        <View style={[globalStyles.formActions, { marginTop: hp('3.5%') }]}>
          <TouchableOpacity
            style={[globalStyles.primaryButton, {
              paddingVertical: hp('1.6%'),
              paddingHorizontal: wp('8%'),
              borderRadius: wp('2.5%'),
              minHeight: hp('5.5%')
            }]}
            onPress={handleVerifyOTP}
            disabled={loading || otp.join('').length !== 6}
          >
            <Text style={[globalStyles.primaryButtonText, { fontSize: wp('4.5%') }]}>
              {loading ? 'Verifying...' : 'Verify'}
            </Text>
          </TouchableOpacity>

          <View style={[otpVerificationStyles.resendContainer, { marginTop: hp('2%') }]}>
            {canResend ? (
              <TouchableOpacity
                onPress={handleResendOTP}
                disabled={resendLoading}
              >
                <Text style={[globalStyles.linkText, { fontSize: wp('3.8%') }]}>
                  {resendLoading ? 'Sending...' : 'Resend'}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[globalStyles.grayText, { fontSize: wp('3.8%') }]}>
                  Didn't receive email? Resend in {countdown}s
                </Text>
              </View>
            )}
          </View>
        </View>
      </Animated.View>

      {/* Error Modal */}
      <AppAlert
        visible={showErrorModal}
        type="error"
        message={errorMessage}
        actionable={true}
        actionLabel="OK"
        onAction={() => setShowErrorModal(false)}
        onClose={() => setShowErrorModal(false)}
      />

      {/* Success Modal - Email Verified */}
      <AppAlert
        visible={showSuccessModal}
        type="success"
        title="Email Verified!"
        message="Your email has been verified successfully! You can now sign in to your account."
        actionable={true}
        actionLabel="Sign In Now"
        onAction={() => {
          setShowSuccessModal(false);
          router.replace('/signin');
        }}
        onClose={() => {
          setShowSuccessModal(false);
          router.replace('/signin');
        }}
      />

      {/* AppAlert for success messages */}
      <AppAlert
        visible={successAlert.visible}
        type="success"
        message={successAlert.message}
        actionable={true}
        actionLabel="OK"
        onAction={() => setSuccessAlert({ visible: false, message: '' })}
        onClose={() => setSuccessAlert({ visible: false, message: '' })}
      />
    </TopographicBackground>
  );
};

export default OTPVerification;
