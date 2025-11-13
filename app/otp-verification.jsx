import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  StatusBar,
  Platform
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { useLocalSearchParams, router } from 'expo-router';
import { useCustomAuth } from '../hooks/use-custom-auth';
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

      <View style={[globalStyles.card, {
        paddingTop: hp('1.5%'),
        paddingBottom: hp('1.5%'),
        paddingHorizontal: wp('6%')
      }]}>
        <View style={globalStyles.formContent}>
          <View style={{ position: 'relative', alignSelf: 'flex-start', marginBottom: hp('2%') }}>
            <Text style={[globalStyles.title, { marginBottom: hp('0.8%'), fontSize: wp('7.5%') }]}>Email Verification</Text>
            <View
              style={{
                position: 'absolute',
                left: 0,
                bottom: 0,
                height: hp('0.5%'),
                width: wp('50%'),
                backgroundColor: '#97B88B',
                borderRadius: hp('0.5%'),
              }}
            />
          </View>

          <Text style={[globalStyles.subtitle, { marginLeft: wp('2%'), marginTop: hp('2%'), marginBottom: hp('3%'), fontSize: wp('3.8%') }]}>
            Enter the verification code we just sent to your email address.
          </Text>

          {/* OTP Input Boxes */}
          <View style={[globalStyles.otpContainer, { marginTop: hp('3%') }]}>
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

        <View style={[globalStyles.formActions, { marginTop: hp('4%') }]}>
          <TouchableOpacity
            style={[globalStyles.primaryButton, {
              paddingVertical: hp('1.8%'),
              paddingHorizontal: wp('8%'),
              borderRadius: wp('3%')
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
      </View>
    </TopographicBackground>
  );
};

export default OTPVerification;
