import React from 'react';
import { View, StyleSheet } from 'react-native';
import { heightPercentageToDP as hp } from 'react-native-responsive-screen';
import CachedImage from '../../components/common/cached-image';

export default function RecipeHero({ image, recipeId = null, recipeName = null }) {
  return (
    <View style={styles.heroContainer}>
      <CachedImage
        uri={image}
        recipeId={recipeId}
        recipeName={recipeName}
        style={styles.heroImage}
        resizeMode="cover"
        showLoader={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  heroContainer: {
    position: 'relative',
    height: hp('35%'),
  },
  loadingContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
});
