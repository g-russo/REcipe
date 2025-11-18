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
import { router } from 'expo-router';
import { globalStyles } from '../assets/css/globalStyles';
import { signupStyles } from '../assets/css/signupStyles';
import TopographicBackground from '../components/TopographicBackground';
import AppAlert from '../components/common/app-alert';
import rateLimiterService from '../services/rate-limiter-service';

const SignUp = () => {
  const [name, setName] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [birthdateFocused, setBirthdateFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmPasswordFocused, setConfirmPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [alert, setAlert] = useState({ visible: false, type: 'info', message: '' });
  const [nameError, setNameError] = useState('');
  const [birthdateError, setBirthdateError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const translateY = useRef(new Animated.Value(0)).current;

  const { signUp } = useCustomAuth();

  // Custom styled alert function
  const showStyledError = (message) => {
    setAlert({ visible: true, type: 'error', message, actionable: true });
  };

  const showStyledSuccess = (message) => {
    setAlert({ visible: true, type: 'success', message, actionable: true });
  };

  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        Animated.timing(translateY, {
          toValue: -e.endCoordinates.height * 0.35,
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

  const handleBirthdateChange = (text) => {
    // Remove all non-numeric characters
    const numbers = text.replace(/\D/g, '');

    // Format as mm-dd-yyyy
    let formatted = '';
    if (numbers.length > 0) {
      // Add first 2 digits (month)
      formatted = numbers.substring(0, 2);

      if (numbers.length > 2) {
        // Add dash and next 2 digits (day)
        formatted += '-' + numbers.substring(2, 4);
      }

      if (numbers.length > 4) {
        // Add dash and last 4 digits (year)
        formatted += '-' + numbers.substring(4, 8);
      }
    }

    setBirthdate(formatted);
  };

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password) => {
    const minLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>_]/.test(password);

    return minLength && hasUppercase && hasLowercase && hasNumber && hasSpecialChar;
  };

  const validateBirthdate = (birthdate) => {
    // Check if birthdate format is complete (mm-dd-yyyy)
    if (birthdate.length !== 10) {
      return { valid: false, message: 'Please enter a complete birthdate (mm-dd-yyyy)' };
    }

    const parts = birthdate.split('-');
    if (parts.length !== 3) {
      return { valid: false, message: 'Invalid birthdate format' };
    }

    const month = parseInt(parts[0], 10);
    const day = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);

    // Validate year range (1900 onwards)
    if (year < 1900) {
      return { valid: false, message: 'Year must be 1900 or later' };
    }

    // Check if year is in the future
    const currentYear = new Date().getFullYear();
    if (year > currentYear) {
      return { valid: false, message: 'Birthdate cannot be in the future' };
    }

    // Validate month
    if (month < 1 || month > 12) {
      return { valid: false, message: 'Invalid month. Please enter a value between 01 and 12' };
    }

    // Days in each month (accounting for leap years)
    const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    // Check for leap year
    const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    if (isLeapYear) {
      daysInMonth[1] = 29; // February has 29 days in leap years
    }

    // Validate day
    if (day < 1 || day > daysInMonth[month - 1]) {
      return {
        valid: false,
        message: `Invalid day for the selected month. ${month === 2 ? (isLeapYear ? 'February has 29 days in ' + year : 'February has 28 days in ' + year) : 'Please enter a valid day'}`
      };
    }

    // Calculate age
    const birthDate = new Date(year, month - 1, day);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    // Check minimum age requirement (18 years old)
    if (age < 18) {
      return { valid: false, message: 'You must be at least 18 years old to register' };
    }

    return { valid: true, message: '' };
  };

  const handleSignUp = async () => {
    // Check IP-based rate limiting first (prevents spam/DoS)
    const clientIP = await rateLimiterService.getClientIP();
    const rateLimitCheck = rateLimiterService.checkRateLimit(clientIP);

    if (!rateLimitCheck.allowed) {
      if (rateLimitCheck.reason === 'IP_BLOCKED') {
        showStyledError('Too many requests from this network. Please try again later.');
      } else if (rateLimitCheck.reason === 'RATE_LIMIT_EXCEEDED') {
        showStyledError('Too many signup attempts. Please try again in a few minutes.');
      }
      return;
    }

    // Clear all errors first
    setNameError('');
    setBirthdateError('');
    setEmailError('');
    setPasswordError('');
    setConfirmPasswordError('');

    let hasError = false;

    // Check individual fields for specific error messages
    if (!name.trim()) {
      setNameError('Name is required');
      hasError = true;
    }

    if (!birthdate) {
      setBirthdateError('Birthday is required');
      hasError = true;
    }

    if (!email.trim()) {
      setEmailError('Email is required');
      hasError = true;
    }

    if (!password) {
      setPasswordError('Password is required');
      hasError = true;
    }

    if (!confirmPassword) {
      setConfirmPasswordError('Confirm Password is required');
      hasError = true;
    }

    // If any field is empty, stop here
    if (hasError) {
      return;
    }

    // Birthdate validation (date range, validity, and age check)
    const birthdateValidation = validateBirthdate(birthdate);
    if (!birthdateValidation.valid) {
      setBirthdateError(birthdateValidation.message);
      return;
    }

    // R3: Email format validation
    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address.');
      return;
    }

    // R4: Password validation
    if (!validatePassword(password)) {
      setPasswordError('Password must be at least 8 characters, and include at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character');
      return;
    }

    // R5: Password match validation
    if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await signUp(email, password, {
        name: name.trim(),
        birthdate: birthdate
      });

      if (error) {
        // R7: Duplicate email error
        showStyledError(error.message);
      } else {
        // R1 & R6: Success case
        showStyledSuccess('Account created successfully! Please check your email for the verification code.');
      }
    } catch (err) {
      showStyledError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const goToSignIn = () => {
    router.push('/signin');
  };

  return (
    <TopographicBackground>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <Animated.View style={[globalStyles.card, {
        paddingTop: hp('1.2%'),
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
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: hp('2%') }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={[globalStyles.formContent, { flex: 0 }]}>
            <View style={{ position: 'relative', alignSelf: 'flex-start', marginTop: 0, marginBottom: hp('1.5%') }}>
              <Text style={[globalStyles.title, { marginBottom: hp('0.6%'), paddingBottom: 0, fontSize: wp('8.5%'), lineHeight: wp('10%') }]}>Sign up</Text>
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

            <View style={[globalStyles.inputContainer, { marginBottom: hp('1%') }]}>
              <Text style={[globalStyles.inputLabel, { fontSize: wp('4.2%'), marginBottom: hp('0.6%') }]}>
                Name <Text style={{ color: '#E74C3C' }}>*</Text>
              </Text>
              <TextInput
                style={[globalStyles.input, nameFocused && globalStyles.inputFocused, nameError && { borderColor: '#E74C3C', borderWidth: 1.5 }, {
                  paddingVertical: hp('1.3%'),
                  paddingHorizontal: wp('4%'),
                  fontSize: wp('4.2%'),
                  borderRadius: wp('2%'),
                  minHeight: hp('5.5%')
                }]}
                placeholder="e.g. Juan Dela Cruz"
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  if (nameError) setNameError('');
                }}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
                autoCapitalize="words"
                placeholderTextColor="#BDC3C7"
              />
              {nameError ? <Text style={{ color: '#E74C3C', fontSize: wp('3.5%'), marginTop: hp('0.5%') }}>{nameError}</Text> : null}
            </View>

            <View style={[globalStyles.inputContainer, { marginBottom: hp('1%') }]}>
              <Text style={[globalStyles.inputLabel, { fontSize: wp('4.2%'), marginBottom: hp('0.6%') }]}>
                Birthday <Text style={{ color: '#E74C3C' }}>*</Text>
              </Text>
              <TextInput
                style={[globalStyles.input, birthdateFocused && globalStyles.inputFocused, birthdateError && { borderColor: '#E74C3C', borderWidth: 1.5 }, {
                  paddingVertical: hp('1.3%'),
                  paddingHorizontal: wp('4%'),
                  fontSize: wp('4.2%'),
                  borderRadius: wp('2%'),
                  minHeight: hp('5.5%')
                }]}
                placeholder="mm-dd-yyyy"
                value={birthdate}
                onChangeText={(text) => {
                  handleBirthdateChange(text);
                  if (birthdateError) setBirthdateError('');
                }}
                onFocus={() => setBirthdateFocused(true)}
                onBlur={() => setBirthdateFocused(false)}
                keyboardType="number-pad"
                maxLength={10}
                placeholderTextColor="#BDC3C7"
              />
              {birthdateError ? <Text style={{ color: '#E74C3C', fontSize: wp('3.5%'), marginTop: hp('0.5%') }}>{birthdateError}</Text> : null}
            </View>

            <View style={[globalStyles.inputContainer, { marginBottom: hp('1%') }]}>
              <Text style={[globalStyles.inputLabel, { fontSize: wp('4.2%'), marginBottom: hp('0.6%') }]}>
                Email <Text style={{ color: '#E74C3C' }}>*</Text>
              </Text>
              <TextInput
                style={[globalStyles.input, emailFocused && globalStyles.inputFocused, emailError && { borderColor: '#E74C3C', borderWidth: 1.5 }, {
                  paddingVertical: hp('1.3%'),
                  paddingHorizontal: wp('4%'),
                  fontSize: wp('4.2%'),
                  borderRadius: wp('2%'),
                  minHeight: hp('5.5%')
                }]}
                placeholder="demo@email.com"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (emailError) setEmailError('');
                }}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor="#BDC3C7"
              />
              {emailError ? <Text style={{ color: '#E74C3C', fontSize: wp('3.5%'), marginTop: hp('0.5%') }}>{emailError}</Text> : null}
            </View>

            <View style={[globalStyles.inputContainer, { marginBottom: hp('0.8%') }]}>
              <Text style={[globalStyles.inputLabel, { fontSize: wp('4.2%'), marginBottom: hp('0.6%') }]}>
                Password <Text style={{ color: '#E74C3C' }}>*</Text>
              </Text>
              <View style={{ position: 'relative' }}>
                <TextInput
                  style={[globalStyles.input, passwordFocused && globalStyles.inputFocused, passwordError && { borderColor: '#E74C3C', borderWidth: 1.5 }, {
                    paddingRight: wp('12%'),
                    paddingVertical: hp('1.3%'),
                    paddingLeft: wp('4%'),
                    fontSize: wp('4.2%'),
                    borderRadius: wp('2%'),
                    minHeight: hp('5.5%')
                  }]}
                  placeholder="Enter your password"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (passwordError) setPasswordError('');
                  }}
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
              {passwordError ? <Text style={{ color: '#E74C3C', fontSize: wp('3.5%'), marginTop: hp('0.5%') }}>{passwordError}</Text> : null}
            </View>

            <View style={[globalStyles.inputContainer, { marginBottom: 0 }]}>
              <Text style={[globalStyles.inputLabel, { fontSize: wp('4.2%'), marginBottom: hp('0.6%') }]}>
                Confirm Password <Text style={{ color: '#E74C3C' }}>*</Text>
              </Text>
              <View style={{ position: 'relative' }}>
                <TextInput
                  style={[globalStyles.input, confirmPasswordFocused && globalStyles.inputFocused, confirmPasswordError && { borderColor: '#E74C3C', borderWidth: 1.5 }, {
                    paddingRight: wp('12%'),
                    paddingVertical: hp('1.3%'),
                    paddingLeft: wp('4%'),
                    fontSize: wp('4.2%'),
                    borderRadius: wp('2%'),
                    minHeight: hp('5.5%')
                  }]}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    if (confirmPasswordError) setConfirmPasswordError('');
                  }}
                  onFocus={() => setConfirmPasswordFocused(true)}
                  onBlur={() => setConfirmPasswordFocused(false)}
                  secureTextEntry={!showConfirmPassword}
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
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
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
              {confirmPasswordError ? <Text style={{ color: '#E74C3C', fontSize: wp('3.5%'), marginTop: hp('0.5%') }}>{confirmPasswordError}</Text> : null}
            </View>

            <View style={[globalStyles.formActions, { marginTop: hp('3.5%'), marginBottom: 0, paddingTop: 0 }]}>
              <TouchableOpacity
                style={[globalStyles.primaryButton, {
                  paddingVertical: hp('1.6%'),
                  paddingHorizontal: wp('8%'),
                  borderRadius: wp('2.5%'),
                  minHeight: hp('5.5%')
                }]}
                onPress={handleSignUp}
                disabled={loading}
              >
                <Text style={[globalStyles.primaryButtonText, { fontSize: wp('4.5%') }]}>
                  {loading ? 'Creating Account...' : 'Create Account'}
                </Text>
              </TouchableOpacity>

              <View style={[signupStyles.signinContainer, { marginTop: hp('1.5%') }]}>
                <Text style={[globalStyles.grayText, { fontSize: wp('3.8%') }]}>Already have an Account? </Text>
                <TouchableOpacity onPress={goToSignIn}>
                  <Text style={[globalStyles.linkText, { fontSize: wp('3.8%') }]}>Login</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </Animated.View>

      {/* AppAlert rendered last so it overlays other content */}
      <AppAlert
        visible={alert.visible}
        type={alert.type}
        message={alert.message}
        actionable={alert.actionable}
        actionLabel={alert.type === 'success' ? 'Continue' : 'OK'}
        onAction={() => {
          if (alert.type === 'success') {
            setAlert({ visible: false, type: 'info', message: '' });
            router.push({
              pathname: '/otp-verification',
              params: { email }
            });
          } else {
            setAlert({ visible: false, type: 'info', message: '' });
          }
        }}
        onClose={() => {
          if (alert.type === 'success') {
            router.push({
              pathname: '/otp-verification',
              params: { email }
            });
          }
          setAlert({ visible: false, type: 'info', message: '' });
        }}
      />
    </TopographicBackground>
  );
};

export default SignUp;
