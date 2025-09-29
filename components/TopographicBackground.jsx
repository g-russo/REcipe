import React from 'react';
import { ImageBackground } from 'react-native';
import { globalStyles } from '../assets/css/globalStyles';

const TopographicBackground = ({ children, style }) => {
  return (
    <ImageBackground
      source={require('../assets/topographic-bg.png')}
      style={[globalStyles.backgroundContainer, style]}
      imageStyle={{
        resizeMode: 'repeat',
      }}
    >
      {children}
    </ImageBackground>
  );
};

export default TopographicBackground;
