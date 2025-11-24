import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Header component for item selection mode
 * 💡 REDESIGNED based on user feedback
 */
const SelectionModeHeader = ({
  selectedCount,
  onCancel,
  onAddToGroup,
  onDeleteSelected, // NEW: Prop for deleting items
  isDisabled,
  isExiting = false,
}) => {
  const appGreen = '#81A969'; // Using the app's green color
  const appRed = '#FF3B30';
  const disabledColor = '#aaa';

  // Animation values
  const slideAnim = useRef(new Animated.Value(-80)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const hasAnimatedIn = useRef(false);

  useEffect(() => {
    if (isExiting) {
      // Exit animation - slide up and fade out
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -80,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.85,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
      hasAnimatedIn.current = false;
    } else if (!hasAnimatedIn.current) {
      // Entrance animation - only play once on mount
      hasAnimatedIn.current = true;
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 70,
          friction: 9,
          delay: 50,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          delay: 0,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 70,
          friction: 9,
          delay: 50,
        }),
      ]).start();
    }
  }, [isExiting]);

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          transform: [
            { translateY: slideAnim },
            { scale: scaleAnim }
          ],
          opacity: fadeAnim,
        }
      ]}
    >
      {/* Left Action: Cancel */}
      <TouchableOpacity style={styles.actionButton} onPress={onCancel}>
        <Ionicons name="close" size={26} color={appGreen} />
        <Text style={[styles.actionText, { color: appGreen }]}>Cancel</Text>
      </TouchableOpacity>

      {/* Center: Count */}
      <Text style={styles.countText}>{selectedCount} Selected</Text>

      {/* Right Actions: Add to Group & Delete */}
      <View style={styles.rightActions}>
        <TouchableOpacity
          style={[styles.actionButton, isDisabled && styles.disabledButton]}
          onPress={onAddToGroup}
          disabled={isDisabled}
        >
          <Ionicons name="folder-open-outline" size={24} color={isDisabled ? disabledColor : appGreen} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, isDisabled && styles.disabledButton]}
          onPress={onDeleteSelected}
          disabled={isDisabled}
        >
          <Ionicons name="trash-outline" size={24} color={isDisabled ? disabledColor : appRed} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#fff', // Cleaner white background
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0', // Lighter border
    paddingTop: Platform.OS === 'android' ? 50 : 45,
    height: Platform.OS === 'android' ? 100 : 95,
    zIndex: 1000,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8, // A bit more touch area
    marginHorizontal: 5,
  },
  actionText: {
    fontSize: 17,
    marginLeft: 5,
    fontWeight: '500',
  },
  countText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.4,
  },
});

export default SelectionModeHeader;