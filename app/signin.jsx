import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  StyleSheet 
} from 'react-native';
import { useCustomAuth } from '../hooks/useCustomAuth';
import { Link, useRouter } from 'expo-router';
import { globalStyles } from '../assets/css/globalStyles';
import { signinStyles } from '../assets/css/signinStyles';
import TopographicBackground from '../components/TopographicBackground';

const SignIn = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const { signIn } = useCustomAuth();
  const router = useRouter();

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
      <View style={globalStyles.card}>
        <View style={globalStyles.formContent}>
          <Text style={globalStyles.title}>Sign in</Text>
          
          <View style={globalStyles.inputContainer}>
            <Text style={globalStyles.inputLabel}>Email</Text>
            <TextInput
              style={globalStyles.input}
              placeholder="demo@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor="#BDC3C7"
            />
          </View>
          
          <View style={globalStyles.inputContainer}>
            <Text style={globalStyles.inputLabel}>Password</Text>
            <TextInput
              style={globalStyles.input}
              placeholder="enter your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              placeholderTextColor="#BDC3C7"
            />
          </View>
          
          <View style={signinStyles.optionsContainer}>
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
        
        <View style={globalStyles.formActions}>
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
      </View>
    </TopographicBackground>
  );
};

export default SignIn;
