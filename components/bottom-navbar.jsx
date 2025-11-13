import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { useRouter, usePathname } from 'expo-router';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

const BottomNavbar = () => {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (route) => {
    // Check if the pathname ends with the route name (without the /(tabs)/ prefix)
    const routeName = route.replace('/(tabs)/', '');
    return pathname.endsWith(`/${routeName}`) || pathname === `/(tabs)/${routeName}`;
  };

  const activeColor = '#81A969';
  const inactiveColor = '#C6C6C6';

  // Only show navbar on tab pages - check if pathname includes the tab routes
  const showNavbar = pathname.includes('/home') || 
                     pathname.includes('/recipe-search') || 
                     pathname.includes('/pantry') || 
                     pathname.includes('/profile');

  if (!showNavbar) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Home */}
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => router.push('/(tabs)/home')}
        activeOpacity={0.7}
      >
        <Svg width={wp('6%')} height={wp('6%')} viewBox="0 0 24 24" fill="none" stroke={isActive('/(tabs)/home') ? activeColor : inactiveColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <Path d="M9 22V12h6v10" />
        </Svg>
        <Text style={[styles.navLabel, { color: isActive('/(tabs)/home') ? activeColor : inactiveColor, fontSize: wp('2.6%') }]}>
          Home
        </Text>
      </TouchableOpacity>

      {/* Search */}
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => router.push('/(tabs)/recipe-search')}
        activeOpacity={0.7}
      >
        <Svg width={wp('6%')} height={wp('6%')} viewBox="0 0 24 24" fill="none" stroke={isActive('/(tabs)/recipe-search') ? activeColor : inactiveColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <Circle cx="11" cy="11" r="8" />
          <Path d="m21 21-4.35-4.35" />
        </Svg>
        <Text style={[styles.navLabel, { color: isActive('/(tabs)/recipe-search') ? activeColor : inactiveColor, fontSize: wp('2.6%') }]}>
          Search
        </Text>
      </TouchableOpacity>

      {/* Scan (Center) */}
      <TouchableOpacity
        style={styles.scanButton}
        onPress={() => router.push('/food-recognition/upload')}
        activeOpacity={0.8}
      >
        <View style={[styles.scanButtonInner, { 
          width: wp('14.5%'), 
          height: wp('14.5%'), 
          borderRadius: wp('7.25%') 
        }]}>
          <Svg width={wp('8%')} height={wp('8%')} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <Path d="M3 7V5a2 2 0 0 1 2-2h2" />
            <Path d="M17 3h2a2 2 0 0 1 2 2v2" />
            <Path d="M21 17v2a2 2 0 0 1-2 2h-2" />
            <Path d="M7 21H5a2 2 0 0 1-2-2v-2" />
            <Circle cx="12" cy="12" r="1" />
            <Path d="M18.944 12.33a1 1 0 0 0 0-.66 7.5 7.5 0 0 0-13.888 0 1 1 0 0 0 0 .66 7.5 7.5 0 0 0 13.888 0" />
          </Svg>
        </View>
      </TouchableOpacity>

      {/* Pantry */}
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => router.push('/(tabs)/pantry')}
        activeOpacity={0.7}
      >
        <Svg width={wp('6%')} height={wp('6%')} viewBox="0 0 24 24" fill="none" stroke={isActive('/(tabs)/pantry') ? activeColor : inactiveColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <Rect width="7" height="7" x="3" y="3" rx="1" />
          <Rect width="7" height="7" x="14" y="3" rx="1" />
          <Rect width="7" height="7" x="14" y="14" rx="1" />
          <Rect width="7" height="7" x="3" y="14" rx="1" />
        </Svg>
        <Text style={[styles.navLabel, { color: isActive('/(tabs)/pantry') ? activeColor : inactiveColor, fontSize: wp('2.6%') }]}>
          Pantry
        </Text>
      </TouchableOpacity>

      {/* Profile */}
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => router.push('/(tabs)/profile')}
        activeOpacity={0.7}
      >
        <Svg width={wp('6%')} height={wp('6%')} viewBox="0 0 24 24" fill="none" stroke={isActive('/(tabs)/profile') ? activeColor : inactiveColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <Circle cx="12" cy="8" r="5" />
          <Path d="M20 21a8 8 0 0 0-16 0" />
        </Svg>
        <Text style={[styles.navLabel, { color: isActive('/(tabs)/profile') ? activeColor : inactiveColor, fontSize: wp('2.6%') }]}>
          Profile
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#262626',
    height: hp('13%'),
    paddingBottom: hp('4.4%'),
    paddingTop: hp('2.5%'),
    paddingHorizontal: wp('2%'),
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopLeftRadius: wp('7.5%'),
    borderTopRightRadius: wp('7.5%'),
    borderTopWidth: 0,
    elevation: 15,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('0.5%'),
    gap: hp('0.4%'),
  },
  navLabel: {
    fontWeight: '500',
    marginTop: hp('0.1%'),
  },
  scanButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('0.5%'),
  },
  scanButtonInner: {
    backgroundColor: '#81A969',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default BottomNavbar;
