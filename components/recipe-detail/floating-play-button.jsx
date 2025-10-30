import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function FloatingPlayButton({ onStartRecipe, onScheduleRecipe }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const playButtonScale = useRef(new Animated.Value(1)).current;
  const menuOpacity = useRef(new Animated.Value(0)).current;
  const menuTranslateY = useRef(new Animated.Value(20)).current;

  const handleLongPress = () => {
    setIsExpanded(!isExpanded);
    
    if (!isExpanded) {
      // Expand animation
      Animated.parallel([
        Animated.spring(playButtonScale, {
          toValue: 1.1,
          useNativeDriver: true,
        }),
        Animated.timing(menuOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(menuTranslateY, {
          toValue: 0,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Collapse animation
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
        Animated.timing(menuTranslateY, {
          toValue: 20,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  const handleMenuAction = (action) => {
    setIsExpanded(false);
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
    ]).start();
    action();
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
          <TouchableOpacity 
            style={styles.menuButton}
            onPress={() => handleMenuAction(onStartRecipe)}
            activeOpacity={0.8}
          >
            <View style={styles.menuIconContainer}>
              <Ionicons name="play-circle" size={24} color="#fff" />
            </View>
            <Text style={styles.menuButtonText}>Start Recipe</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuButton}
            onPress={() => handleMenuAction(onScheduleRecipe)}
            activeOpacity={0.8}
          >
            <View style={styles.menuIconContainer}>
              <Ionicons name="time-outline" size={24} color="#fff" />
            </View>
            <Text style={styles.menuButtonText}>Schedule</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Main Play Button */}
      <Animated.View style={{ transform: [{ scale: playButtonScale }] }}>
        <TouchableOpacity
          style={styles.playButton}
          onLongPress={handleLongPress}
          onPress={() => {
            if (isExpanded) {
              handleLongPress();
            }
          }}
          activeOpacity={0.9}
          delayLongPress={300}
        >
          <Ionicons name="play" size={32} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingButtonContainer: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    alignItems: 'flex-end',
    zIndex: 1000,
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#6FA36D',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
  },
  expandedMenu: {
    position: 'absolute',
    bottom: 75,
    right: 0,
    backgroundColor: 'transparent',
  },
  menuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    paddingRight: 24,
    borderRadius: 30,
    marginBottom: 12,
    minWidth: 180,
    elevation: 4,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6FA36D',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6FA36D',
  },
});
