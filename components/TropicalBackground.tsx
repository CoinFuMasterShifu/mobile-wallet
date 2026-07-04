import React from 'react';
import { View, ImageBackground, StyleSheet, Platform } from 'react-native';

const BG_BASE = '#040404';

interface Props {
  children: React.ReactNode;
}

/**
 * Subtle tropical foliage backdrop — matches wartbunker global.css body::before.
 * Cards and modals stay opaque; only the page backdrop shows the pattern.
 */
const TropicalBackground: React.FC<Props> = ({ children }) => {
  return (
    <View style={styles.root}>
      <ImageBackground
        source={require('../assets/bg-tropical.jpg')}
        style={styles.bgImage}
        imageStyle={styles.bgImagePattern}
        resizeMode={Platform.OS === 'web' ? 'repeat' : 'cover'}
      />
      <View style={styles.tint} pointerEvents="none" />
      <View style={styles.content}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG_BASE,
  },
  bgImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.085,
  },
  bgImagePattern: {
    ...(Platform.OS === 'web'
      ? {
          // wartbunker: background-size 480px auto, repeat
          width: 480,
          height: undefined,
        }
      : {}),
  },
  tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.38)',
  },
  content: {
    flex: 1,
  },
});

export default TropicalBackground;