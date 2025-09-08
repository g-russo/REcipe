import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  StyleSheet,
  ScrollView,
  Picker
} from 'react-native';
import Modal from 'react-native-modal';
import { useCustomAuth } from '../hooks/useCustomAuth';
import { router } from 'expo-router';

const SignUp = () => {
  const [name, setName] = useState('');
  const [birthdate, setBirthdate] = useState(new Date(2000, 0, 1)); // Default to Jan 1, 2000
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempMonth, setTempMonth] = useState(0);
  const [tempDay, setTempDay] = useState(1);
  const [tempYear, setTempYear] = useState(2000);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { signUp } = useCustomAuth();

  // Validation functions
  const validateName = (name) => {
    const alphaNumericRegex = /^[a-zA-Z0-9\s]+$/;
    return name.length > 0 && name.length <= 50 && alphaNumericRegex.test(name);
  };

  const validateAge = (birthdate) => {
    if (!birthdate) return false;
    
    const today = new Date();
    const birth = new Date(birthdate);
    const age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      return age - 1 >= 18;
    }
    return age >= 18;
  };

  const openDatePicker = () => {
    setTempMonth(birthdate.getMonth());
    setTempDay(birthdate.getDate());
    setTempYear(birthdate.getFullYear());
    setShowDatePicker(true);
  };

  const confirmDateSelection = () => {
    const selectedDate = new Date(tempYear, tempMonth, tempDay);
    setBirthdate(selectedDate);
    setShowDatePicker(false);
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  // Generate options for date picker
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);
  const days = Array.from({ length: getDaysInMonth(tempYear, tempMonth) }, (_, i) => i + 1);

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
    // Validate all fields
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    if (!validateName(name)) {
      Alert.alert('Error', 'Name must be alphanumeric and under 50 characters');
      return;
    }

    if (!birthdate) {
      Alert.alert('Error', 'Please enter your birthdate');
      return;
    }

    if (!validateAge(birthdate)) {
      Alert.alert('Error', 'You must be at least 18 years old to sign up');
      return;
    }

    if (!email) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (!password) {
      Alert.alert('Error', 'Please enter a password');
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
        birthdate: birthdate.toISOString().split('T')[0] // Format as YYYY-MM-DD for database
      });
      
      if (error) {
        // Handle rate limiting specifically
        if (error.code === 'RATE_LIMIT_EXCEEDED') {
          Alert.alert(
            'Too Many Attempts', 
            error.message + '\n\n💡 You can also try using a different email address.',
            [
              {
                text: 'Use Different Email',
                onPress: () => setEmail(''),
                style: 'default'
              },
              {
                text: 'OK',
                style: 'cancel'
              }
            ]
          );
        } else {
          Alert.alert('Sign Up Error', error.message);
        }
      } else {
        Alert.alert(
          'Success!', 
          'Account created successfully! Please check your email for the verification code.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Navigate back to sign in since Supabase handles email verification
                router.push('/signin');
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
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Sign Up</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Full Name"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        maxLength={50}
      />
      
      <TouchableOpacity 
        style={styles.dateButton}
        onPress={openDatePicker}
      >
        <Text style={styles.dateButtonText}>
          Birthdate: {formatDate(birthdate)}
        </Text>
      </TouchableOpacity>
      
      <Modal isVisible={showDatePicker} onBackdropPress={() => setShowDatePicker(false)}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Select Your Birthdate</Text>
          
          <View style={styles.datePickerContainer}>
            <View style={styles.pickerColumn}>
              <Text style={styles.pickerLabel}>Month</Text>
              <ScrollView style={styles.picker} showsVerticalScrollIndicator={false}>
                {months.map((month, index) => (
                  <TouchableOpacity 
                    key={index}
                    style={[
                      styles.pickerItem,
                      tempMonth === index && styles.selectedPickerItem
                    ]}
                    onPress={() => setTempMonth(index)}
                  >
                    <Text style={[
                      styles.pickerItemText,
                      tempMonth === index && styles.selectedPickerItemText
                    ]}>
                      {month}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            
            <View style={styles.pickerColumn}>
              <Text style={styles.pickerLabel}>Day</Text>
              <ScrollView style={styles.picker} showsVerticalScrollIndicator={false}>
                {days.map((day) => (
                  <TouchableOpacity 
                    key={day}
                    style={[
                      styles.pickerItem,
                      tempDay === day && styles.selectedPickerItem
                    ]}
                    onPress={() => setTempDay(day)}
                  >
                    <Text style={[
                      styles.pickerItemText,
                      tempDay === day && styles.selectedPickerItemText
                    ]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            
            <View style={styles.pickerColumn}>
              <Text style={styles.pickerLabel}>Year</Text>
              <ScrollView style={styles.picker} showsVerticalScrollIndicator={false}>
                {years.map((year) => (
                  <TouchableOpacity 
                    key={year}
                    style={[
                      styles.pickerItem,
                      tempYear === year && styles.selectedPickerItem
                    ]}
                    onPress={() => setTempYear(year)}
                  >
                    <Text style={[
                      styles.pickerItemText,
                      tempYear === year && styles.selectedPickerItemText
                    ]}>
                      {year}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
          
          <View style={styles.modalButtons}>
            <TouchableOpacity 
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => setShowDatePicker(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.modalButton, styles.confirmButton]}
              onPress={confirmDateSelection}
            >
              <Text style={styles.confirmButtonText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      
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
      
      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        autoCapitalize="none"
      />
      
      <Text style={styles.passwordHint}>
        Password must contain: 8+ characters, uppercase, lowercase, number, and special character
      </Text>
      
      <TouchableOpacity 
        style={styles.button} 
        onPress={handleSignUp}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Creating Account...' : 'Sign Up'}
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity onPress={goToSignIn}>
        <Text style={styles.linkText}>
          Already have an account? Sign In
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
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
  passwordHint: {
    fontSize: 12,
    color: '#666',
    marginBottom: 15,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  dateButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 15,
    marginBottom: 15,
    borderRadius: 5,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#333',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  datePickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  pickerColumn: {
    flex: 1,
    marginHorizontal: 5,
  },
  pickerLabel: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
  },
  picker: {
    height: 150,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
  },
  pickerItem: {
    padding: 10,
    alignItems: 'center',
  },
  selectedPickerItem: {
    backgroundColor: '#007AFF',
  },
  pickerItemText: {
    fontSize: 16,
    color: '#333',
  },
  selectedPickerItemText: {
    color: 'white',
    fontWeight: 'bold',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  confirmButton: {
    backgroundColor: '#007AFF',
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 16,
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default SignUp;
