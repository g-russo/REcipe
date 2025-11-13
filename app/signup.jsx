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
  Platform
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Modal from 'react-native-modal';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { useCustomAuth } from '../hooks/use-custom-auth';
import { router } from 'expo-router';
import { globalStyles } from '../assets/css/globalStyles';
import { signupStyles } from '../assets/css/signupStyles';
import TopographicBackground from '../components/TopographicBackground';

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
  const translateY = useRef(new Animated.Value(0)).current;

  const { signUp } = useCustomAuth();

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
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    return minLength && hasUppercase && hasLowercase && hasNumber && hasSpecialChar;
  };

  const handleSignUp = async () => {
    // Basic validation
    if (!name.trim() || !birthdate || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (!validatePassword(password)) {
      Alert.alert('Error', 'Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await signUp(email, password, {
        name: name.trim(),
        birthdate: birthdate
      });

      if (error) {
        Alert.alert('Sign Up Error', error.message);
      } else {
        Alert.alert(
          'Success!',
          'Account created successfully! Please check your email for the verification code.',
          [
            {
              text: 'OK',
              onPress: () => {
                router.push({
                  pathname: '/otp-verification',
                  params: { email }
                });
              }
            }
          ]
        );
      }
    } catch (err) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const goToSignIn = () => {
    router.push('/signin');
  };

  return (
    <TopographicBackground>
      <Animated.View style={[globalStyles.card, {
        paddingTop: hp('1%'),
        paddingBottom: hp('1.2%'),
        paddingHorizontal: wp('6%'),
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        marginTop: 0,
        minHeight: '90%',
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        transform: [{ translateY }]
      }]}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={[globalStyles.formContent, { flex: 0 }]}>
            <View style={{ position: 'relative', alignSelf: 'flex-start', marginTop: 0, marginBottom: hp('2%') }}>
              <Text style={[globalStyles.title, { marginBottom: hp('0.8%'), paddingBottom: 0, fontSize: wp('8%') }]}>Sign up</Text>
              <View
                style={{
                  position: 'absolute',
                  left: 0,
                  bottom: 0,
                  height: hp('0.5%'),
                  width: wp('20%'),
                  backgroundColor: '#97B88B',
                  borderRadius: hp('0.5%'),
                }}
              />
            </View>

            <View style={[globalStyles.inputContainer, { marginBottom: hp('1.2%') }]}>
              <Text style={[globalStyles.inputLabel, { fontSize: wp('4%'), marginBottom: hp('0.8%') }]}>Name</Text>
              <TextInput
                style={[globalStyles.input, nameFocused && globalStyles.inputFocused, {
                  paddingVertical: hp('1.5%'),
                  paddingHorizontal: wp('3.5%'),
                  fontSize: wp('4%'),
                  borderRadius: wp('2%')
                }]}
                placeholder="e.g. Juan Dela Cruz"
                value={name}
                onChangeText={setName}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
                autoCapitalize="words"
                placeholderTextColor="#BDC3C7"
              />
            </View>

            <View style={[globalStyles.inputContainer, { marginBottom: hp('1.2%') }]}>
              <Text style={[globalStyles.inputLabel, { fontSize: wp('4%'), marginBottom: hp('0.8%') }]}>Birthday</Text>
              <TextInput
                style={[globalStyles.input, birthdateFocused && globalStyles.inputFocused, {
                  paddingVertical: hp('1.5%'),
                  paddingHorizontal: wp('3.5%'),
                  fontSize: wp('4%'),
                  borderRadius: wp('2%')
                }]}
                placeholder="mm-dd-yyyy"
                value={birthdate}
                onChangeText={handleBirthdateChange}
                onFocus={() => setBirthdateFocused(true)}
                onBlur={() => setBirthdateFocused(false)}
                keyboardType="number-pad"
                maxLength={10}
                placeholderTextColor="#BDC3C7"
              />
            </View>

            <View style={[globalStyles.inputContainer, { marginBottom: hp('1.2%') }]}>
              <Text style={[globalStyles.inputLabel, { fontSize: wp('4%'), marginBottom: hp('0.8%') }]}>Email</Text>
              <TextInput
                style={[globalStyles.input, emailFocused && globalStyles.inputFocused, {
                  paddingVertical: hp('1.5%'),
                  paddingHorizontal: wp('3.5%'),
                  fontSize: wp('4%'),
                  borderRadius: wp('2%')
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

            <View style={[globalStyles.inputContainer, { marginBottom: hp('1.2%') }]}>
              <Text style={[globalStyles.inputLabel, { fontSize: wp('4%'), marginBottom: hp('0.8%') }]}>Password</Text>
              <View style={{ position: 'relative' }}>
                <TextInput
                  style={[globalStyles.input, passwordFocused && globalStyles.inputFocused, {
                    paddingRight: wp('12%'),
                    paddingVertical: hp('1.5%'),
                    paddingLeft: wp('3.5%'),
                    fontSize: wp('4%'),
                    borderRadius: wp('2%')
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

            <View style={[globalStyles.inputContainer, { marginBottom: 0 }]}>
              <Text style={[globalStyles.inputLabel, { fontSize: wp('4%'), marginBottom: hp('0.8%') }]}>Confirm Password</Text>
              <View style={{ position: 'relative' }}>
                <TextInput
                  style={[globalStyles.input, confirmPasswordFocused && globalStyles.inputFocused, {
                    paddingRight: wp('12%'),
                    paddingVertical: hp('1.5%'),
                    paddingLeft: wp('3.5%'),
                    fontSize: wp('4%'),
                    borderRadius: wp('2%')
                  }]}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
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
            </View>

            <View style={[globalStyles.formActions, { marginTop: hp('11%'), marginBottom: 0, paddingTop: 0 }]}>
              <TouchableOpacity
                style={[globalStyles.primaryButton, {
                  paddingVertical: hp('1.8%'),
                  paddingHorizontal: wp('8%'),
                  borderRadius: wp('3%')
                }]}
                onPress={handleSignUp}
                disabled={loading}
              >
                <Text style={[globalStyles.primaryButtonText, { fontSize: wp('4.5%') }]}>
                  {loading ? 'Creating Account...' : 'Create Account'}
                </Text>
              </TouchableOpacity>

              <View style={[signupStyles.signinContainer, { marginTop: hp('2%') }]}>
                <Text style={[globalStyles.grayText, { fontSize: wp('3.8%') }]}>Already have an Account? </Text>
                <TouchableOpacity onPress={goToSignIn}>
                  <Text style={[globalStyles.linkText, { fontSize: wp('3.8%') }]}>Login</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </Animated.View>
    </TopographicBackground>
  );
};

export default SignUp;
