import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import * as Haptics from 'expo-haptics';

export default function FloatingPlayButton({
  onStartRecipe,
  onScheduleRecipe,
  hasMissingIngredients = false
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const playButtonScale = useRef(new Animated.Value(1)).current;
  const menuOpacity = useRef(new Animated.Value(0)).current;
  const menuTranslateY = useRef(new Animated.Value(20)).current;

  // Individual animations for each menu item
  const scheduleScale = useRef(new Animated.Value(0)).current;
  const scheduleOpacity = useRef(new Animated.Value(0)).current;
  const startScale = useRef(new Animated.Value(0)).current;
  const startOpacity = useRef(new Animated.Value(0)).current;

  const handleToggle = () => {
    if (isAnimating) return; // Prevent spam clicks during animation

    // Trigger haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (!isExpanded) {
      setIsAnimating(true);
      // Opening - show the menu first, then animate items
      setIsExpanded(true);

      // Reset all animations to 0 before starting
      scheduleScale.setValue(0);
      scheduleOpacity.setValue(0);
      startScale.setValue(0);
      startOpacity.setValue(0);

      // Expand animation - staggered pop-out effect
      Animated.parallel([
        Animated.spring(playButtonScale, {
          toValue: 1.1,
          friction: 6,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.timing(menuOpacity, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.spring(menuTranslateY, {
          toValue: 0,
          friction: 6,
          tension: 60,
          useNativeDriver: true,
        }),
      ]).start();

      // Schedule button appears first (closest to main button)
      Animated.parallel([
        Animated.spring(scheduleScale, {
          toValue: 1,
          friction: 5,
          tension: 60,
          useNativeDriver: true,
          delay: 30,
        }),
        Animated.timing(scheduleOpacity, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
          delay: 30,
        }),
      ]).start();

      // Start Recipe button appears second
      Animated.parallel([
        Animated.spring(startScale, {
          toValue: 1,
          friction: 5,
          tension: 60,
          useNativeDriver: true,
          delay: 80,
        }),
        Animated.timing(startOpacity, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
          delay: 80,
        }),
      ]).start(() => {
        setIsAnimating(false); // Re-enable after entrance animation completes
      });
    } else {
      setIsAnimating(true);
      // Exit: Start Recipe disappears first (farthest from button)
      Animated.parallel([
        Animated.timing(startScale, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(startOpacity, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();

      // Schedule disappears second (closest to button)
      Animated.parallel([
        Animated.timing(scheduleScale, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
          delay: 40,
        }),
        Animated.timing(scheduleOpacity, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
          delay: 40,
        }),
      ]).start();

      // Collapse main button and menu
      Animated.parallel([
        Animated.spring(playButtonScale, {
          toValue: 1,
          friction: 6,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.timing(menuOpacity, {
          toValue: 0,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(menuTranslateY, {
          toValue: 20,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Hide menu after animation completes
        setIsExpanded(false);
        setIsAnimating(false); // Re-enable after exit animation completes
      });
    }
  };

  const handleMenuAction = (action) => {
    if (isAnimating) return; // Prevent spam clicks during animation

    // Trigger haptic feedback for menu selection
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setIsAnimating(true);

    // Reset animations to 0 for next time
    // Collapse animations
    Animated.parallel([
      Animated.spring(playButtonScale, {
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(menuOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.spring(startScale, {
        toValue: 0,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.timing(startOpacity, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scheduleScale, {
        toValue: 0,
        friction: 6,
        useNativeDriver: true,
        delay: 50,
      }),
      Animated.timing(scheduleOpacity, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
        delay: 50,
      }),
    ]).start(() => {
      setIsExpanded(false);
      setIsAnimating(false);
      action();
    });
  };

  return (
    <View style={styles.floatingButtonContainer}>
      {/* Expanded Menu */}
      {isExpanded && (
        <Animated.View
          style={[
            styles.expandedMenu,
            {
              opacity: menuOpacity,
              transform: [{ translateY: menuTranslateY }],
            }
          ]}
        >
          <Animated.View
            style={{
              opacity: startOpacity,
              transform: [{ scale: startScale }],
            }}
          >
            <TouchableOpacity
              style={styles.menuButton}
              onPress={() => handleMenuAction(onStartRecipe)}
              activeOpacity={0.8}
            >
              <View style={styles.menuIconContainer}>
                <Ionicons name="play-circle" size={wp('6%')} color="#fff" />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuButtonText}>Start Recipe</Text>
                {hasMissingIngredients && (
                  <Text style={styles.warningText}>Missing ingredients</Text>
                )}
              </View>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View
            style={{
              opacity: scheduleOpacity,
              transform: [{ scale: scheduleScale }],
            }}
          >
            <TouchableOpacity
              style={styles.menuButton}
              onPress={() => handleMenuAction(onScheduleRecipe)}
              activeOpacity={0.8}
            >
              <View style={styles.menuIconContainer}>
                <Ionicons name="time-outline" size={wp('6%')} color="#fff" />
              </View>
              <Text style={styles.menuButtonText}>Schedule</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      )}

      {/* Main Play Button */}
      <Animated.View style={{ transform: [{ scale: playButtonScale }] }}>
        <TouchableOpacity
          style={[
            styles.playButton,
            isAnimating && styles.playButtonDisabled
          ]}
          onPress={handleToggle}
          activeOpacity={isAnimating ? 1 : 0.9}
          disabled={isAnimating}
        >
          <Ionicons name="play" size={wp('8%')} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingButtonContainer: {
    position: 'absolute',
    bottom: hp('4%'),
    right: wp('5%'),
    alignItems: 'flex-end',
    zIndex: 1000,
  },
  playButton: {
    width: wp('16%'),
    height: wp('16%'),
    borderRadius: wp('8%'),
    backgroundColor: '#81A969',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  playButtonDisabled: {
    backgroundColor: '#B0B0B0',
    opacity: 0.6,
  },
  expandedMenu: {
    position: 'absolute',
    bottom: wp('18%'),
    right: 0,
    backgroundColor: 'transparent',
  },
  menuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: hp('1.5%'),
    paddingHorizontal: wp('4%'),
    paddingRight: wp('6%'),
    borderRadius: wp('8%'),
    marginBottom: hp('1.5%'),
    minWidth: wp('45%'),
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  menuIconContainer: {
    width: wp('10%'),
    height: wp('10%'),
    borderRadius: wp('5%'),
    backgroundColor: '#81A969',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: wp('3%'),
  },
  menuTextContainer: {
    flex: 1,
  },
  menuButtonText: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#2c3e50',
  },
  warningText: {
    fontSize: wp('3%'),
    color: '#FF9800',
    marginTop: hp('0.3%'),
    fontWeight: '500',
  },
});
