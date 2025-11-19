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
  Platform,
  StatusBar
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path } from 'react-native-svg';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { useCustomAuth } from '../hooks/use-custom-auth';
import { Link, useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { globalStyles } from '../assets/css/globalStyles';
import { signinStyles } from '../assets/css/signinStyles';
import TopographicBackground from '../components/TopographicBackground';
import SurveyService from '../services/survey-service';
import AppAlert from '../components/common/app-alert';
import { setSuppressRedirect } from '../lib/auth-redirect-controller';
import rateLimiterService from '../services/rate-limiter-service';

const SignIn = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockEndTime, setLockEndTime] = useState(null);
  const [remainingTime, setRemainingTime] = useState(0);
  const translateY = useRef(new Animated.Value(0)).current;

  const { signIn, resendOTP } = useCustomAuth();
  const router = useRouter();
  const [alert, setAlert] = useState({ visible: false, type: 'info', message: '' });
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');

  useEffect(() => {
    // Check for existing lock on mount
    checkAccountLock();

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

  // Check account lock status
  const checkAccountLock = async () => {
    try {
      const lockData = await AsyncStorage.getItem('accountLock');
      if (lockData) {
        const { endTime, attempts } = JSON.parse(lockData);
        const now = Date.now();

        if (now < endTime) {
          // Account is still locked
          setIsLocked(true);
          setLockEndTime(endTime);
          setFailedAttempts(attempts);
          startCountdown(endTime);
        } else {
          // Lock has expired, clear it
          await AsyncStorage.removeItem('accountLock');
          setIsLocked(false);
          setFailedAttempts(0);
        }
      }
    } catch (error) {
      console.error('Error checking account lock:', error);
    }
  };

  // Countdown timer for locked account
  const startCountdown = (endTime) => {
    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((endTime - now) / 1000));

      setRemainingTime(remaining);

      if (remaining === 0) {
        clearInterval(interval);
        unlockAccount();
      }
    }, 1000);

    return () => clearInterval(interval);
  };

  // Unlock account
  const unlockAccount = async () => {
    try {
      await AsyncStorage.removeItem('accountLock');
      setIsLocked(false);
      setFailedAttempts(0);
      setLockEndTime(null);
      setRemainingTime(0);
      Alert.alert('Account Unlocked', 'You can now try signing in again.');
    } catch (error) {
      console.error('Error unlocking account:', error);
    }
  };

  // Lock account for 15 minutes
  const lockAccount = async (attempts) => {
    try {
      const lockDuration = 15 * 60 * 1000; // 15 minutes in milliseconds
      const endTime = Date.now() + lockDuration;

      await AsyncStorage.setItem('accountLock', JSON.stringify({
        endTime,
        attempts
      }));

      setIsLocked(true);
      setLockEndTime(endTime);
      setRemainingTime(900); // 15 minutes in seconds

      startCountdown(endTime);

      setAlert({
        visible: true,
        type: 'error',
        message: 'Too many failed login attempts. Your account has been temporarily locked for security purposes. Please try again later.',
        actionable: true
      });
    } catch (error) {
      console.error('Error locking account:', error);
    }
  };

  // Format remaining time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSignIn = async () => {
    // Check IP-based rate limiting first (prevents spam/DoS)
    const clientIP = await rateLimiterService.getClientIP();
    const rateLimitCheck = rateLimiterService.checkRateLimit(clientIP);

    if (!rateLimitCheck.allowed) {
      if (rateLimitCheck.reason === 'IP_BLOCKED') {
        setAlert({
          visible: true,
          type: 'error',
          message: 'Too many requests from this network. Please try again later.',
          actionable: true
        });
      } else if (rateLimitCheck.reason === 'RATE_LIMIT_EXCEEDED') {
        setAlert({
          visible: true,
          type: 'error',
          message: 'Too many login attempts. Please try again in a few minutes.',
          actionable: true
        });
      }
      return;
    }

    // Check if account is locked (user-specific)
    if (isLocked) {
      setAlert({
        visible: true,
        type: 'error',
        message: 'Your account is temporarily locked due to multiple failed login attempts. Please try again later.',
        actionable: true
      });
      return;
    }

    if (!email || !password) {
      setAlert({ visible: true, type: 'error', message: 'Please fill in all fields', actionable: true });
      return;
    }

    try {
      setLoading(true);

      // Attempt sign-in first (validates both email AND password)
      const { data, error } = await signIn(email, password, rememberMe);

      // Always reset loading state immediately after sign-in attempt
      setLoading(false);

      if (error) {
        // On auth error, we need to check if this is an unverified account
        // BUT we must verify the password is correct first to prevent email enumeration

        // Get user from database along with hashed password
        const { data: dbUser, error: dbError } = await supabase
          .from('tbl_users')
          .select('isVerified, userName, userPassword')
          .eq('userEmail', email)
          .single();

        // If user exists and is not verified, we need to verify the password
        if (dbUser && !dbError && dbUser.isVerified === false) {
          // Import crypto for password verification
          const Crypto = await import('expo-crypto');
          const hashedPassword = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            password,
            { encoding: Crypto.CryptoEncoding.HEX }
          );

          // Only show verification modal if password is correct
          if (hashedPassword === dbUser.userPassword) {
            setLoading(false);
            setUnverifiedEmail(email);
            setShowVerificationModal(true);
            return;
          }
        }

        // If we reach here, it's a legitimate failed login attempt
        // (either wrong email, wrong password, or already verified account with wrong password)
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);

        // Lock account after 3 failed attempts
        if (newAttempts >= 3) {
          await lockAccount(newAttempts);
          return;
        }

        // Provide generic error messages (WITHOUT revealing attempts remaining)
        let errorMessage = 'Invalid email or password. Please check your credentials and try again.';

        setAlert({ visible: true, type: 'error', message: errorMessage, actionable: true });
      } else {
        // Reset failed attempts on successful login
        setFailedAttempts(0);
        await AsyncStorage.removeItem('accountLock');

        // Reset rate limit for this IP after successful login
        rateLimiterService.resetRateLimit(clientIP);

        // Prevent AuthGuard from auto-redirecting immediately after auth state change
        setSuppressRedirect(true);

        // Show actionable success toast on sign-in screen; navigate when user presses OK
        setAlert({ visible: true, type: 'success', message: 'Signed in successfully!', actionable: true });

        // Check for surveys after successful sign-in (fire-and-forget)
        setTimeout(async () => {
          try {
            if (email) {
              console.log('📋 Checking for surveys after sign-in...');
              await SurveyService.checkAndShowSurvey(email);
            }
          } catch (error) {
            console.error('Error checking surveys:', error);
          }
        }, 2000);
      }
    } catch (err) {
      setLoading(false);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  };

  const goToForgotPassword = () => {
    console.log('Navigating to forgot-password...');
    router.navigate('forgot-password');
  };

  return (
    <TopographicBackground>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <Animated.View style={[
        globalStyles.card,
        {
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
        }
      ]}>
        <View style={[globalStyles.formContent, { flex: 0 }]}>
          <View style={{ position: 'relative', alignSelf: 'flex-start', marginTop: 0, marginBottom: hp('1.5%') }}>
            <Text style={[globalStyles.title, { marginBottom: hp('0.6%'), paddingBottom: 0, fontSize: wp('8.5%'), lineHeight: wp('10%') }]}>Sign in</Text>
            <View
              style={{
                position: 'absolute',
                left: 0,
                bottom: 0,
                height: hp('0.4%'),
                width: wp('20%'),
                backgroundColor: '#97B88B',
                borderRadius: hp('0.4%'),
              }}
            />
          </View>

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
              placeholderTextColor="#BDC3C7"
            />
          </View>

          <View style={[globalStyles.inputContainer, { marginBottom: hp('0.8%') }]}>
            <Text style={[globalStyles.inputLabel, { fontSize: wp('4.2%'), marginBottom: hp('0.6%') }]}>Password</Text>
            <View style={{ position: 'relative' }}>
              <TextInput
                style={[globalStyles.input, passwordFocused && globalStyles.inputFocused, {
                  paddingRight: wp('12%'),
                  paddingVertical: hp('1.3%'),
                  paddingHorizontal: wp('4%'),
                  fontSize: wp('4.2%'),
                  borderRadius: wp('2%'),
                  minHeight: hp('5.5%')
                }]}
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                placeholderTextColor="#BDC3C7"
              />
              <TouchableOpacity
                style={{
                  position: 'absolute',
                  right: wp('3%'),
                  top: '50%',
                  transform: [{ translateY: -hp('1.5%') }],
                  padding: hp('0.5%'),
                }}
                onPress={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <Svg width={wp('6%')} height={wp('6%')} viewBox="0 0 24 24" fill="none" stroke="#7F8C8D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <Path d="M1 1l22 22" />
                  </Svg>
                ) : (
                  <Svg width={wp('6%')} height={wp('6%')} viewBox="0 0 24 24" fill="none" stroke="#7F8C8D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <Path d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
                  </Svg>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={[signinStyles.optionsContainer, { marginVertical: 0, marginTop: hp('0.8%') }]}>
            <TouchableOpacity
              style={globalStyles.checkboxContainer}
              onPress={() => setRememberMe(!rememberMe)}
            >
              <View style={[
                globalStyles.checkbox,
                rememberMe && globalStyles.checkboxChecked,
                { width: wp('5%'), height: wp('5%'), borderRadius: wp('1%') }
              ]}>
                {rememberMe && <Text style={[signinStyles.checkmark, { fontSize: wp('3.5%') }]}>✓</Text>}
              </View>
              <Text style={[globalStyles.checkboxText, { fontSize: wp('3.5%'), marginLeft: wp('2%') }]}>Keep me logged in</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={goToForgotPassword}>
              <Text style={[globalStyles.linkText, { fontSize: wp('3.5%') }]}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Account Locked Warning - Generic message without time */}
        {isLocked && (
          <View style={{
            backgroundColor: '#FFF3CD',
            borderRadius: wp('2%'),
            padding: wp('4%'),
            marginTop: hp('2%'),
          }}>
            <Text style={{
              fontSize: wp('3.8%'),
              color: '#856404',
              fontWeight: '600',
              marginBottom: hp('0.5%')
            }}>
              🔒 Account Locked
            </Text>
            <Text style={{
              fontSize: wp('3.5%'),
              color: '#856404',
              lineHeight: wp('5%')
            }}>
              Your account is temporarily locked due to multiple failed login attempts. Please try again later.
            </Text>
          </View>
        )}

        <View style={[globalStyles.formActions, { marginTop: hp('4.5%'), marginBottom: 0, paddingTop: 0 }]}>
          <TouchableOpacity
            style={[globalStyles.primaryButton, {
              paddingVertical: hp('1.6%'),
              paddingHorizontal: wp('8%'),
              borderRadius: wp('2.5%'),
              minHeight: hp('5.5%'),
              opacity: isLocked ? 0.5 : 1
            }]}
            onPress={handleSignIn}
            disabled={loading || isLocked}
          >
            <Text style={[globalStyles.primaryButtonText, { fontSize: wp('4.5%') }]}>
              {loading ? 'Signing In...' : isLocked ? '🔒 Locked' : 'Login'}
            </Text>
          </TouchableOpacity>

          <View style={[signinStyles.signupContainer, { marginTop: hp('1.5%') }]}>
            <Text style={[globalStyles.grayText, { fontSize: wp('3.8%') }]}>Don't have an Account? </Text>
            <Link href="/signup" asChild>
              <TouchableOpacity>
                <Text style={[globalStyles.linkText, { fontSize: wp('3.8%') }]}>Sign up</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </Animated.View>

      {/* AppAlert rendered last so it overlays other content */}
      <AppAlert
        visible={alert.visible}
        type={alert.type}
        message={alert.message}
        actionable={alert.actionable}
        actionLabel={alert.actionLabel || 'OK'}
        onAction={() => {
          if (alert.type === 'success') {
            // allow AuthGuard to redirect again and navigate
            setSuppressRedirect(false);
            setAlert({ visible: false, type: 'info', message: '' });
            router.replace('/home');
          } else {
            // For errors, just close the modal and stay on signin page
            setAlert({ visible: false, type: 'info', message: '' });
          }
        }}
        onClose={() => {
          if (alert.type === 'success') {
            // ensure flag cleared if alert is closed
            setSuppressRedirect(false);
          }
          setAlert({ visible: false, type: 'info', message: '' });
        }}
      />

      {/* Email Verification Modal */}
      <AppAlert
        visible={showVerificationModal}
        type="error"
        title="Email Not Verified"
        message="Your email address is not verified yet. Please verify your email to continue."
        actionable
        actionLabel="Send Verification Code"
        onAction={async () => {
          try {
            const { error } = await resendOTP(unverifiedEmail, 'signup');
            setShowVerificationModal(false);
            if (!error) {
              router.push({
                pathname: '/otp-verification',
                params: { email: unverifiedEmail }
              });
            } else {
              setAlert({ visible: true, type: 'error', message: 'Failed to send verification code. Please try again.', actionable: true });
            }
          } catch (err) {
            setShowVerificationModal(false);
            setAlert({ visible: true, type: 'error', message: 'Something went wrong. Please try again.', actionable: true });
          }
        }}
        onClose={() => setShowVerificationModal(false)}
      >
        <TouchableOpacity
          style={{
            width: '100%',
            paddingVertical: hp('1.6%'),
            borderRadius: wp('2.5%'),
            backgroundColor: 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: hp('1%'),
          }}
          onPress={() => setShowVerificationModal(false)}
          activeOpacity={0.7}
        >
          <Text style={{ color: '#333', fontWeight: '600', fontSize: wp('4%'), letterSpacing: 0.3 }}>Cancel</Text>
        </TouchableOpacity>
      </AppAlert>
    </TopographicBackground>
  );
};

export default SignIn;
