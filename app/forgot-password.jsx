import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ScrollView,
  Animated,
  Keyboard,
  Platform,
  StatusBar
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { useCustomAuth } from '../hooks/use-custom-auth';
import { router, useLocalSearchParams } from 'expo-router';
import { globalStyles } from '../assets/css/globalStyles';
import { forgotPasswordStyles } from '../assets/css/forgotPasswordStyles';
import TopographicBackground from '../components/TopographicBackground';
import rateLimiterService from '../services/rate-limiter-service';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const translateY = useRef(new Animated.Value(0)).current;

  const { returnTo } = useLocalSearchParams();
  const { requestPasswordReset } = useCustomAuth();

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
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleForgotPassword = async () => {
    // Check IP-based rate limiting first
    const clientIP = await rateLimiterService.getClientIP();
    const rateLimitCheck = rateLimiterService.checkRateLimit(clientIP);

    if (!rateLimitCheck.allowed) {
      if (rateLimitCheck.reason === 'IP_BLOCKED') {
        Alert.alert('Error', 'Too many requests from this network. Please try again later.');
      } else if (rateLimitCheck.reason === 'RATE_LIMIT_EXCEEDED') {
        Alert.alert('Error', 'Too many password reset attempts. Please try again in a few minutes.');
      }
      return;
    }

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
          'We\'ve sent a link to your email. Please check your inbox and click the link on the next screen.',
          [
            {
              text: 'Continue',
              onPress: () => {
                router.push({
                  pathname: '/signin',
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
        marginTop: 0,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        transform: [{ translateY }]
      }]}>
        <View style={[globalStyles.formContent, { flex: 0 }]}>
          <View style={{ position: 'relative', alignSelf: 'flex-start', marginTop: 0, marginBottom: hp('1.5%') }}>
            <Text style={[globalStyles.title, { marginBottom: hp('0.6%'), paddingBottom: 0, fontSize: wp('8%'), lineHeight: wp('9.5%') }]}>Forgot Password</Text>
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
            Enter the email address so we can send you your 6-digit OTP
          </Text>

          <View style={[globalStyles.inputContainer, { marginBottom: hp('1.2%') }]}>
            <Text style={[globalStyles.inputLabel, { fontSize: wp('4.2%'), marginBottom: hp('0.6%') }]}>Email</Text>
            <TextInput
              style={[globalStyles.input, emailFocused && globalStyles.inputFocused, {
                paddingVertical: hp('1.3%'),
                paddingHorizontal: wp('4%'),
                fontSize: wp('4.2%'),
                borderRadius: wp('2%'),
                minHeight: hp('5.5%')
              }]}
              placeholder="demo@email.com"
              value={email}
              onChangeText={setEmail}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
              placeholderTextColor="#BDC3C7"
            />
          </View>
        </View>

        <View style={[globalStyles.formActions, { marginTop: hp('4.5%'), marginBottom: 0, paddingTop: 0 }]}>
          <TouchableOpacity
            style={[globalStyles.primaryButton, {
              paddingVertical: hp('1.6%'),
              paddingHorizontal: wp('8%'),
              borderRadius: wp('2.5%'),
              minHeight: hp('5.5%')
            }]}
            onPress={handleForgotPassword}
            disabled={loading}
          >
            <Text style={[globalStyles.primaryButtonText, { fontSize: wp('4.5%') }]}>
              {loading ? 'Sending...' : 'Send OTP'}
            </Text>
          </TouchableOpacity>

          <View style={[forgotPasswordStyles.resendContainer, { marginTop: hp('1.5%') }]}>
            <Text style={[globalStyles.grayText, { fontSize: wp('3.8%') }]}>Didn't receive email? </Text>
            <TouchableOpacity>
              <Text style={[globalStyles.linkText, { fontSize: wp('3.8%') }]}>Resend</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </TopographicBackground>
  );
};

export default ForgotPassword;
