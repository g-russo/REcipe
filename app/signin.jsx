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
import { useCustomAuth } from '../hooks/use-custom-auth';
import { Link, useRouter } from 'expo-router';
import { globalStyles } from '../assets/css/globalStyles';
import { signinStyles } from '../assets/css/signinStyles';
import TopographicBackground from '../components/TopographicBackground';
import SurveyService from '../services/survey-service';

const SignIn = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const translateY = useRef(new Animated.Value(0)).current;
  
  const { signIn } = useCustomAuth();
  const router = useRouter();

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

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await signIn(email, password);
      
      if (error) {
        // Provide more helpful error messages
        let errorMessage = error.message;
        
        if (errorMessage.includes('Invalid login credentials')) {
          errorMessage = 'Invalid email or password. Please check your credentials and try again.';
        } else if (errorMessage.includes('Email not confirmed')) {
          errorMessage = 'Please verify your email address first. Check your inbox for the verification email.';
        } else if (errorMessage.includes('not verified')) {
          errorMessage = 'Please verify your email address before signing in. Check your inbox for the verification email.';
        }
        
        Alert.alert('Sign In Error', errorMessage, [
          {
            text: 'Resend Verification',
            onPress: () => {
              Alert.alert(
                'Resend Verification',
                'Would you like to go to sign up to resend verification email?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'Yes', 
                    onPress: () => router.push('/signup') 
                  }
                ]
              );
            },
            style: 'default'
          },
          {
            text: 'OK',
            style: 'cancel'
          }
        ]);
      } else {
        Alert.alert('Success', 'Signed in successfully!');
        
        // Check for surveys after successful sign-in
        setTimeout(async () => {
          try {
            if (email) {
              console.log('📋 Checking for surveys after sign-in...');
              await SurveyService.checkAndShowSurvey(email);
            }
          } catch (error) {
            console.error('Error checking surveys:', error);
          }
        }, 2000); // Wait 2 seconds after sign-in
        
        router.push('/'); // Navigate to home screen
      }
    } catch (err) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const goToForgotPassword = () => {
    console.log('Navigating to forgot-password...');
    router.navigate('forgot-password');
  };

  return (
    <TopographicBackground>
      <Animated.View style={[
        globalStyles.card, 
        { 
          paddingTop: 8, 
          paddingBottom: 10, 
          marginTop: '80%',
          transform: [{ translateY }]
        }
      ]}>
        <View style={[globalStyles.formContent, { flex: 0 }]}>
          <View style={{ position: 'relative', alignSelf: 'flex-start', marginTop: 0, marginBottom: 20 }}>
            <Text style={[globalStyles.title, { marginBottom: 6, paddingBottom: 0 }]}>Sign in</Text>
            <View
              style={{
                position: 'absolute',
                left: 0,
                bottom: 0,
                height: 4,
                width: 80,
                backgroundColor: '#97B88B',
                borderRadius: 4,
              }}
            />
          </View>
          
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
              placeholderTextColor="#BDC3C7"
            />
          </View>
          
          <View style={globalStyles.inputContainer}>
            <Text style={globalStyles.inputLabel}>Password</Text>
            <View style={{ position: 'relative' }}>
              <TextInput
                style={[globalStyles.input, passwordFocused && globalStyles.inputFocused, { paddingRight: 45 }]}
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
                  right: 12,
                  top: '50%',
                  transform: [{ translateY: -12 }],
                  padding: 4,
                }}
                onPress={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7F8C8D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <Path d="M1 1l22 22" />
                  </Svg>
                ) : (
                  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7F8C8D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <Path d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
                  </Svg>
                )}
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={[signinStyles.optionsContainer, { marginVertical: 0 }]}> 
            <TouchableOpacity 
              style={globalStyles.checkboxContainer}
              onPress={() => setRememberMe(!rememberMe)}
            >
              <View style={[
                globalStyles.checkbox, 
                rememberMe && globalStyles.checkboxChecked
              ]}>
                {rememberMe && <Text style={signinStyles.checkmark}>✓</Text>}
              </View>
              <Text style={globalStyles.checkboxText}>Remember Me</Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={goToForgotPassword}>
              <Text style={globalStyles.linkText}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={[globalStyles.formActions, { marginTop: 50, marginBottom: 0, paddingTop: 0 }]}> 
          <TouchableOpacity 
            style={globalStyles.primaryButton} 
            onPress={handleSignIn}
            disabled={loading}
          >
            <Text style={globalStyles.primaryButtonText}>
              {loading ? 'Signing In...' : 'Login'}
            </Text>
          </TouchableOpacity>
          
          <View style={signinStyles.signupContainer}>
            <Text style={globalStyles.grayText}>Don't have an Account? </Text>
            <Link href="/signup" asChild>
              <TouchableOpacity>
                <Text style={globalStyles.linkText}>Sign up</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </Animated.View>
    </TopographicBackground>
  );
};

export default SignIn;
