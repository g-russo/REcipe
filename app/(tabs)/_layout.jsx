import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import BottomNavbar from '../../components/bottom-navbar';

export default function TabsLayout() {
  return (
    <>
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
      <BottomNavbar />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
