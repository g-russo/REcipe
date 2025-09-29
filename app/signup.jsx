import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  StyleSheet,
  ScrollView
} from 'react-native';
import Modal from 'react-native-modal';
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
  
  const { signUp } = useCustomAuth();

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
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={globalStyles.card}>
          <View style={globalStyles.formContent}>
            <Text style={globalStyles.title}>Sign up</Text>
            
            <View style={globalStyles.inputContainer}>
              <Text style={globalStyles.inputLabel}>Name</Text>
              <TextInput
                style={globalStyles.input}
                placeholder="e.g. Juan Dela Cruz"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                placeholderTextColor="#BDC3C7"
              />
            </View>
            
            <View style={globalStyles.inputContainer}>
              <Text style={globalStyles.inputLabel}>Birthday</Text>
              <TextInput
                style={globalStyles.input}
                placeholder="mm/dd/yyyy"
                value={birthdate}
                onChangeText={setBirthdate}
                placeholderTextColor="#BDC3C7"
              />
            </View>
            
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
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                placeholderTextColor="#BDC3C7"
              />
            </View>
            
            <View style={globalStyles.inputContainer}>
              <Text style={globalStyles.inputLabel}>Confirm Password</Text>
              <TextInput
                style={globalStyles.input}
                placeholder="Confirm your password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                placeholderTextColor="#BDC3C7"
              />
            </View>
          </View>
          
          <View style={globalStyles.formActions}>
            <TouchableOpacity 
              style={globalStyles.primaryButton} 
              onPress={handleSignUp}
              disabled={loading}
            >
              <Text style={globalStyles.primaryButtonText}>
                {loading ? 'Creating Account...' : 'Create Account'}
              </Text>
            </TouchableOpacity>
            
            <View style={signupStyles.signinContainer}>
              <Text style={globalStyles.grayText}>Already have an Account! </Text>
              <TouchableOpacity onPress={goToSignIn}>
                <Text style={globalStyles.linkText}>Login</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </TopographicBackground>
  );
};
  
export default SignUp;
