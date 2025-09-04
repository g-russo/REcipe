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
import { router } from 'expo-router';

const SignIn = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { signIn } = useCustomAuth();

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

  const goToSignUp = () => {
    router.push('/signup');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign In</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />
      
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
      />
      
      <TouchableOpacity 
        style={styles.button} 
        onPress={handleSignIn}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Signing In...' : 'Sign In'}
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity onPress={goToSignUp}>
        <Text style={styles.linkText}>
          Don't have an account? Sign Up
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity onPress={() => router.push('/forgot-password')} style={styles.forgotPasswordButton}>
        <Text style={styles.forgotPasswordText}>
          Forgot Password?
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 15,
    marginBottom: 15,
    borderRadius: 5,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginBottom: 15,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  linkText: {
    textAlign: 'center',
    color: '#007AFF',
    fontSize: 16,
  },
  forgotPasswordButton: {
    marginTop: 15,
    alignItems: 'center',
  },
  forgotPasswordText: {
    color: '#666',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
});

export default SignIn;
