// Optimized index.jsx - Fast app entry with background initialization
import { StyleSheet, Text, View, TouchableOpacity, Alert, StatusBar, Platform, ActivityIndicator } from "react-native";
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { globalStyles } from '../assets/css/globalStyles';
import { indexStyles } from '../assets/css/indexStyles';
import TopographicBackground from '../components/TopographicBackground';
import { useCustomAuth } from '../hooks/use-custom-auth';

export default function Home() {
  const [isInitializing, setIsInitializing] = useState(false);
  const [initStatus, setInitStatus] = useState({
    auth: false,
    database: false,
    connection: false
  });

  // Get auth data and loading state from custom hook
  const { user, customUserData, loading } = useCustomAuth();

  // Quick navigation functions - available immediately
  const goToSignUp = () => {
    router.push('/signup');
  };

  const goToSignIn = () => {
    router.push('/signin');
  };

  // If user is authenticated, redirect to home page
  useEffect(() => {
    if (!loading && user) {
      console.log('✅ User authenticated, redirecting to home...');
      router.replace('/(tabs)/home');
    }
  }, [user, loading]);

  // Show loading screen while checking auth state
  if (loading) {
    return (
      <TopographicBackground>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#97B88B" />
          <Text style={[globalStyles.subtitle, { marginTop: 20 }]}>Loading...</Text>
        </View>
      </TopographicBackground>
    );
  }

  // Welcome screen for non-authenticated users
  return (
    <TopographicBackground>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <View style={[globalStyles.welcomeCard, {
        borderTopLeftRadius: wp('5%'),
        borderTopRightRadius: wp('5%'),
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        overflow: 'hidden',
        backgroundColor: '#fff',
        paddingBottom: hp('9%'),
        paddingTop: hp('1.8%'),
        paddingHorizontal: wp('7%'),
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        elevation: 14,
      }]}>
        <View style={{ position: 'relative', alignSelf: 'flex-start', marginBottom: hp('0.8%'), padding: 0, margin: 0 }}>
          <Text style={[globalStyles.title, { marginBottom: hp('0.5%'), paddingBottom: 0, fontSize: wp('8.5%'), lineHeight: wp('10%') }]}>Welcome</Text>
          <View
            style={{
              position: 'absolute',
              left: 0,
              bottom: 0,
              height: hp('0.35%'),
              width: wp('22%'),
              backgroundColor: '#97B88B',
              borderRadius: hp('0.35%'),
            }}
          />
        </View>
        <Text style={[globalStyles.subtitle, { marginLeft: 0, marginTop: hp('0.6%'), fontSize: wp('3.8%'), lineHeight: wp('5.2%') }]}>
          Just a few steps to start saving food and cooking smarter.
        </Text>
        <View style={[globalStyles.formActions, { marginBottom: 0, marginTop: hp('2.5%') }]}>
          <TouchableOpacity
            style={[globalStyles.primaryButton, {
              paddingVertical: hp('1.4%'),
              paddingHorizontal: wp('8%'),
              borderRadius: wp('2.5%'),
              minHeight: hp('5.2%')
            }]}
            onPress={goToSignIn}
          >
            <Text style={[globalStyles.primaryButtonText, { fontSize: wp('4.3%') }]}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TopographicBackground>
  );
}