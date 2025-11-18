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
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path } from 'react-native-svg';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { useCustomAuth } from '../hooks/use-custom-auth';
import { router, useLocalSearchParams } from 'expo-router';
import { globalStyles } from '../assets/css/globalStyles';
import { forgotPasswordStyles } from '../assets/css/forgotPasswordStyles';
import TopographicBackground from '../components/TopographicBackground';
import rateLimiterService from '../services/rate-limiter-service';
import AppAlert from '../components/common/app-alert';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [alert, setAlert] = useState({ visible: false, type: 'info', message: '', title: null });
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const translateY = useRef(new Animated.Value(0)).current;

  const { returnTo } = useLocalSearchParams();
  const { requestPasswordReset } = useCustomAuth();

  // Load cooldown on mount
  useEffect(() => {
    const loadCooldown = async () => {
      try {
        const cooldownData = await AsyncStorage.getItem('password_reset_cooldown');
        if (cooldownData) {
          const { timestamp, duration } = JSON.parse(cooldownData);
          const elapsed = Math.floor((Date.now() - timestamp) / 1000);
          const remaining = duration - elapsed;

          if (remaining > 0) {
            setCooldownSeconds(remaining);
          } else {
            // Cooldown expired, clear it
            await AsyncStorage.removeItem('password_reset_cooldown');
          }
        }
      } catch (error) {
        console.error('Error loading cooldown:', error);
      }
    };

    loadCooldown();
  }, []);

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

  // Cooldown timer effect
  useEffect(() => {
    let interval;
    if (cooldownSeconds > 0) {
      interval = setInterval(() => {
        setCooldownSeconds((prev) => {
          const newValue = prev - 1;

          // Clear AsyncStorage when cooldown reaches 0
          if (newValue <= 0) {
            AsyncStorage.removeItem('password_reset_cooldown').catch(console.error);
          }

          return newValue;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [cooldownSeconds]);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleForgotPassword = async () => {
    // Check if still in cooldown
    if (cooldownSeconds > 0) {
      setAlert({
        visible: true,
        type: 'info',
        message: `Please wait before requesting again.`,
        title: null
      });
      return;
    }

    // Check IP-based rate limiting first
    const clientIP = await rateLimiterService.getClientIP();
    const rateLimitCheck = rateLimiterService.checkRateLimit(clientIP);

    if (!rateLimitCheck.allowed) {
      if (rateLimitCheck.reason === 'IP_BLOCKED') {
        setAlert({ visible: true, type: 'error', message: 'Too many requests from this network. Please try again later.', title: null });
      } else if (rateLimitCheck.reason === 'RATE_LIMIT_EXCEEDED') {
        setAlert({ visible: true, type: 'error', message: 'Too many password reset attempts. Please try again in a few minutes.', title: null });
      }
      return;
    }

    if (!email) {
      setAlert({ visible: true, type: 'error', message: 'Please enter your email address', title: null });
      return;
    }

    if (!validateEmail(email)) {
      setAlert({ visible: true, type: 'error', message: 'Please enter a valid email address', title: null });
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await requestPasswordReset(email);

      // Start 60-second cooldown and persist to AsyncStorage
      const cooldownDuration = 60;
      setCooldownSeconds(cooldownDuration);

      await AsyncStorage.setItem('password_reset_cooldown', JSON.stringify({
        timestamp: Date.now(),
        duration: cooldownDuration
      }));

      // Always show success message regardless of whether email exists
      // This prevents email enumeration attacks
      setAlert({
        visible: true,
        type: 'success',
        message: "We've sent a link to your email. Please check your inbox and follow the instructions to reset your password.",
        title: 'Reset Code Sent!'
      });
    } catch (err) {
      setAlert({ visible: true, type: 'error', message: 'Something went wrong. Please try again.', title: null });
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
            Enter your email address so we can send you instructions to reset your password.
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
              minHeight: hp('5.5%'),
              opacity: (loading || cooldownSeconds > 0) ? 0.5 : 1
            }]}
            onPress={handleForgotPassword}
            disabled={loading || cooldownSeconds > 0}
          >
            <Text style={[globalStyles.primaryButtonText, { fontSize: wp('4.5%') }]}>
              {loading ? 'Sending...' : cooldownSeconds > 0 ? `Wait ${cooldownSeconds}s` : 'Confirm'}
            </Text>
          </TouchableOpacity>

          {cooldownSeconds > 0 && (
            <View style={[forgotPasswordStyles.resendContainer, { marginTop: hp('1.5%') }]}>
              <Text style={[globalStyles.grayText, { fontSize: wp('3.8%'), textAlign: 'center' }]}>
                Please wait before requesting again.
              </Text>
            </View>
          )}
        </View>
      </Animated.View>

      {/* AppAlert for all messages */}
      <AppAlert
        visible={alert.visible}
        type={alert.type}
        message={alert.message}
        title={alert.title}
        actionable={true}
        actionLabel="OK"
        onAction={() => {
          setAlert({ visible: false, type: 'info', message: '', title: null });
        }}
        onClose={() => {
          setAlert({ visible: false, type: 'info', message: '', title: null });
        }}
      />
    </TopographicBackground>
  );
};

export default ForgotPassword;
