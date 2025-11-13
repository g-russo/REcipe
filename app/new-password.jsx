import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet
} from 'react-native';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { router, useLocalSearchParams } from 'expo-router';
import { useCustomAuth } from '../hooks/use-custom-auth';
import { newPasswordStyles } from '../assets/css/newPasswordStyles';

const NewPassword = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { resetPassword } = useCustomAuth();
  const { token } = useLocalSearchParams();

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    try {
      setLoading(true);

      const { error } = await resetPassword(token, newPassword);

      if (error) {
        Alert.alert('Error', error.message);
      } else {
        Alert.alert(
          'Success!',
          'Your password has been changed successfully!',
          [
            {
              text: 'Sign In',
              onPress: () => router.replace('/signin')
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

  return (
    <View style={[newPasswordStyles.container, { paddingHorizontal: wp('6%') }]}>
      <Text style={[newPasswordStyles.title, { fontSize: wp('7.5%'), marginBottom: hp('2%') }]}>Create New Password</Text>

      <Text style={[newPasswordStyles.subtitle, { fontSize: wp('3.8%'), marginBottom: hp('3%') }]}>
        Your new password must be different from previously used passwords.
      </Text>

      <TextInput
        style={[newPasswordStyles.input, {
          paddingVertical: hp('1.5%'),
          paddingHorizontal: wp('3.5%'),
          fontSize: wp('4%'),
          borderRadius: wp('2%'),
          marginBottom: hp('1.5%')
        }]}
        placeholder="New Password"
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
        autoCapitalize="none"
      />

      <TextInput
        style={[newPasswordStyles.input, {
          paddingVertical: hp('1.5%'),
          paddingHorizontal: wp('3.5%'),
          fontSize: wp('4%'),
          borderRadius: wp('2%'),
          marginBottom: hp('2%')
        }]}
        placeholder="Confirm New Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        autoCapitalize="none"
      />

      <TouchableOpacity
        style={[
          newPasswordStyles.button,
          (!newPassword || !confirmPassword) && newPasswordStyles.buttonDisabled,
          {
            paddingVertical: hp('1.8%'),
            paddingHorizontal: wp('8%'),
            borderRadius: wp('3%'),
            marginTop: hp('2%')
          }
        ]}
        onPress={handleChangePassword}
        disabled={loading || !newPassword || !confirmPassword}
      >
        <Text style={[newPasswordStyles.buttonText, { fontSize: wp('4.5%') }]}>
          {loading ? 'Changing Password...' : 'Change Password'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[newPasswordStyles.backButton, { marginTop: hp('2%'), paddingVertical: hp('1.2%') }]}
        onPress={() => router.back()}
      >
        <Text style={[newPasswordStyles.backButtonText, { fontSize: wp('4%') }]}>Back</Text>
      </TouchableOpacity>
    </View>
  );
};

export default NewPassword;