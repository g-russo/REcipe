import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import BottomNavbar from '../../components/bottom-navbar';
import { TabProvider } from '../../contexts/tab-context';
import ScreenFlash from '../../components/screen-flash';

export default function TabsLayout() {
  return (
    <TabProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          animation: 'none', // Disable page transition animations
        }}
        tabBar={() => null} // Hide default tab bar since we're using custom BottomNavbar
      >
        <Tabs.Screen
          name="home"
          options={{
            title: 'Home',
          }}
        />
        <Tabs.Screen
          name="recipe-search"
          options={{
            title: 'Search',
          }}
        />
        <Tabs.Screen
          name="pantry"
          options={{
            title: 'Pantry',
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
          }}
        />
      </Tabs>
      <ScreenFlash />
      <BottomNavbar />
    </TabProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
