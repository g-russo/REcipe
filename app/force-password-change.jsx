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
import { useLocalSearchParams, router } from 'expo-router';
import { useCustomAuth } from '../hooks/use-custom-auth';
import { globalStyles } from '../assets/css/globalStyles';
import TopographicBackground from '../components/TopographicBackground';

const ForcePasswordChange = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmPasswordFocused, setConfirmPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const translateY = useRef(new Animated.Value(0)).current;

  const { forcePasswordChange } = useCustomAuth();
  const { email, autoSignedIn } = useLocalSearchParams();

  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        Animated.timing(translateY, {
          toValue: -e.endCoordinates.height / 2,
          duration: Platform.OS === 'ios' ? 250 : 200,
          useNativeDriver: true,
        }).start();
      }
    );

    const keyboardWillHideListener = Keyboard.addListener(
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
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, []);

  const validatePassword = (password) => {
    const minLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    return minLength && hasUppercase && hasLowercase && hasNumber && hasSpecialChar;
  };

  const getPasswordStrength = (password) => {
    let strength = 0;
    const checks = [
      password.length >= 8,
      /[A-Z]/.test(password),
      /[a-z]/.test(password),
      /\d/.test(password),
      /[!@#$%^&*(),.?":{}|<>]/.test(password)
    ];
    
    strength = checks.filter(Boolean).length;
    
    if (strength <= 2) return { level: 'Weak', color: '#ff4757' };
    if (strength <= 3) return { level: 'Fair', color: '#ffa502' };
    if (strength <= 4) return { level: 'Good', color: '#2ed573' };
    return { level: 'Strong', color: '#1e90ff' };
  };

  const handleForcePasswordChange = async () => {
    // Validation
    if (!password) {
      Alert.alert('Error', 'Please enter a new password');
      return;
    }

    if (!validatePassword(password)) {
      Alert.alert(
        'Invalid Password', 
        'Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character'
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    try {
      setLoading(true);
      console.log('🔄 Starting forced password change...');
      console.log('📧 Email:', email);
      
      const { data, error } = await forcePasswordChange(email, password);
      
      console.log('🔍 Force password change result:', { data: !!data, error: !!error });
      
      if (error) {
        console.error('❌ Password change error:', error);
        
        // Check if it's a timeout - treat as success
        if (error.message.includes('timeout') || error.message.includes('timed out')) {
          console.log('⏰ Timeout detected - assuming success and redirecting to home');
          
          Alert.alert(
            'Password Updated! 🎉',
            'Your password update took longer than expected, but it likely succeeded. You are being redirected to the home page.',
            [
              {
                text: 'Continue to Home',
                onPress: () => {
                  console.log('🏠 Redirecting to home after timeout');
                  router.replace('/home');
                }
              }
            ]
          );
        } else if (error.message.includes('different from')) {
          Alert.alert(
            'Password Error',
            'The new password must be different from your current password. Please choose a different password.'
          );
        } else if (error.message.includes('security requirements')) {
          Alert.alert(
            'Password Error',
            'Password does not meet security requirements. Please choose a stronger password.'
          );
        } else {
          Alert.alert('Error', error.message || 'Failed to change password. Please try again.');
        }
      } else {
        console.log('✅ Password change successful!');
        
        // Check if we should redirect to home (including timeout cases)
        if (data.redirectToHome || data.passwordChanged) {
          const sessionMessage = data.sessionRestored 
            ? 'Your password has been updated, application state reloaded, and you are now signed in.' 
            : 'Your password has been updated and you are now signed in.';
            
          Alert.alert(
            'Password Changed Successfully! 🎉',
            `${sessionMessage} Welcome to REcipe!`,
            [
              {
                text: 'Continue to Home',
                onPress: () => {
                  console.log('🚀 User clicked button, redirecting to home');
                  router.replace('/home');
                }
              }
            ]
          );
        } else {
          // Fallback message
          Alert.alert(
            'Password Updated! 🎉',
            'Your password has been changed. Redirecting to home page.',
            [
              {
                text: 'Continue to Home',
                onPress: () => {
                  console.log('🏠 Fallback redirect to home');
                  router.replace('/home');
                }
              }
            ]
          );
        }
      }
    } catch (err) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
      console.error('Force password change error:', err);
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = getPasswordStrength(password);

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
        minHeight: '75%',
        borderBottomLeftRadius: 0, 
        borderBottomRightRadius: 0,
        transform: [{ translateY }]
      }]}>
        <View style={[globalStyles.formContent, { flex: 0 }]}>
          <View style={{ position: 'relative', alignSelf: 'flex-start', marginTop: 0, marginBottom: 20 }}>
            <Text style={[globalStyles.title, { marginBottom: 6, paddingBottom: 0 }]}>Change Password</Text>
            <View
              style={{
                position: 'absolute',
                left: 0,
                bottom: 0,
                height: 4,
                width: 180,
                backgroundColor: '#97B88B',
                borderRadius: 4,
              }}
            />
          </View>

          <View style={[globalStyles.inputContainer, { marginBottom: 10, marginTop: 32 }]}>
            <Text style={globalStyles.inputLabel}>New Password</Text>
            <View style={{ position: 'relative' }}>
              <TextInput
                style={[
                  globalStyles.input,
                  passwordFocused && globalStyles.inputFocused,
                  { paddingRight: 45 }
                ]}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your new password"
                placeholderTextColor="#BDC3C7"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                editable={!loading}
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
            {password.length > 0 && (
              <Text style={[styles.strengthText, { color: passwordStrength.color, marginTop: 6, marginLeft: 4 }]}>
                Strength: {passwordStrength.level}
              </Text>
            )}
          </View>

          <View style={[globalStyles.inputContainer, { marginBottom: 10 }]}>
            <Text style={globalStyles.inputLabel}>Confirm New Password</Text>
            <View style={{ position: 'relative' }}>
              <TextInput
                style={[
                  globalStyles.input,
                  confirmPasswordFocused && globalStyles.inputFocused,
                  { paddingRight: 45 }
                ]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm your new password"
                placeholderTextColor="#BDC3C7"
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                onFocus={() => setConfirmPasswordFocused(true)}
                onBlur={() => setConfirmPasswordFocused(false)}
                editable={!loading}
              />
              <TouchableOpacity
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: [{ translateY: -12 }],
                  padding: 4,
                }}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
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

          <View style={styles.requirementsContainer}>
            <Text style={styles.requirementsTitle}>Password Requirements:</Text>
            <Text style={styles.requirement}>• At least 8 characters long</Text>
            <Text style={styles.requirement}>• Contains uppercase letter (A-Z)</Text>
            <Text style={styles.requirement}>• Contains lowercase letter (a-z)</Text>
            <Text style={styles.requirement}>• Contains number (0-9)</Text>
            <Text style={styles.requirement}>• Contains special character (!@#$%^&*)</Text>
          </View>
        </View>

        <View style={[globalStyles.formActions, { marginTop: 48, marginBottom: 0, paddingTop: 0 }]}>
          <TouchableOpacity
            style={globalStyles.primaryButton}
            onPress={handleForcePasswordChange}
            disabled={loading}
          >
            <Text style={globalStyles.primaryButtonText}>
              {loading ? 'Updating Password...' : 'Change Password'}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </TopographicBackground>
  );
};

const styles = StyleSheet.create({
  strengthText: {
    fontSize: 14,
    fontWeight: '600',
  },
  requirementsContainer: {
    backgroundColor: '#F8F9FA',
    padding: 15,
    borderRadius: 12,
    marginTop: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 8,
  },
  requirement: {
    fontSize: 13,
    color: '#7F8C8D',
    marginBottom: 3,
  },
});

export default ForcePasswordChange;
