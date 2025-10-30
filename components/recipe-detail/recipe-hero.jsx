import React from 'react';
import { View, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function RecipeHero({ image, onBack, onToggleFavorite, isFavorite, savingFavorite }) {
  return (
    <View style={styles.heroContainer}>
      <Image source={{ uri: image }} style={styles.heroImage} />
      
      {/* Header Overlay */}
      <View style={styles.headerOverlay}>
        <TouchableOpacity style={styles.headerButton} onPress={onBack}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.headerButton} 
          onPress={onToggleFavorite}
          disabled={savingFavorite}
        >
          <Ionicons 
            name={isFavorite ? "heart" : "heart-outline"} 
            size={24} 
            color={isFavorite ? "#ff4757" : "#fff"} 
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroContainer: {
    position: 'relative',
    height: 300,
  },
  heroImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  headerOverlay: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
