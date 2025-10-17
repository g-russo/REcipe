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
import { useCustomAuth } from '../hooks/use-custom-auth';
import { router, useLocalSearchParams } from 'expo-router';
import { globalStyles } from '../assets/css/globalStyles';
import { forgotPasswordStyles } from '../assets/css/forgotPasswordStyles';
import TopographicBackground from '../components/TopographicBackground';

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
          'We\'ve sent a 6-digit verification code to your email. Please check your inbox and enter the code on the next screen.',
          [
            {
              text: 'Continue',
              onPress: () => {
                router.push({
                  pathname: '/reset-password-otp',
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
      {/* Back button */}
      <TouchableOpacity style={globalStyles.backButton} onPress={goBack}>
        <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#81A969" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <Path d="m15 18-6-6 6-6"/>
        </Svg>
      </TouchableOpacity>
      
      <Animated.View style={[globalStyles.card, { 
        paddingTop: 8, 
        paddingBottom: 10, 
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        marginTop: 0,
        minHeight: '60%',
        borderBottomLeftRadius: 0, 
        borderBottomRightRadius: 0,
        transform: [{ translateY }]
      }]}>
        <View style={[globalStyles.formContent, { flex: 0 }]}>
          <View style={{ position: 'relative', alignSelf: 'flex-start', marginTop: 0, marginBottom: 20 }}>
            <Text style={[globalStyles.title, { marginBottom: 6, paddingBottom: 0 }]}>Forgot Password</Text>
            <View
              style={{
                position: 'absolute',
                left: 0,
                bottom: 0,
                height: 4,
                width: 200,
                backgroundColor: '#97B88B',
                borderRadius: 4,
              }}
            />
          </View>
          
          <Text style={[globalStyles.subtitle, { marginLeft: 8, marginTop: 18, marginBottom: 24 }]}>
            Enter the email address so we can send you your 6-digit OTP
          </Text>
          
          <View style={globalStyles.inputContainer}>
            <Text style={globalStyles.inputLabel}>Email</Text>
            <TextInput
              style={[globalStyles.input, emailFocused && globalStyles.inputFocused]}
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
        
        <View style={[globalStyles.formActions, { marginTop: 50, marginBottom: 0, paddingTop: 0 }]}>
          <TouchableOpacity 
            style={globalStyles.primaryButton} 
            onPress={handleForgotPassword}
            disabled={loading}
          >
            <Text style={globalStyles.primaryButtonText}>
              {loading ? 'Sending...' : 'Send OTP'}
            </Text>
          </TouchableOpacity>
          
          <View style={forgotPasswordStyles.resendContainer}>
            <Text style={globalStyles.grayText}>Didn't receive email? </Text>
            <TouchableOpacity>
              <Text style={globalStyles.linkText}>Resend</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </TopographicBackground>
  );
};

export default ForgotPassword;
