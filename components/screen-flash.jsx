import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTabContext } from '../contexts/tab-context';

const ScreenFlash = () => {
    const { subscribe } = useTabContext();
    const { width, height } = useWindowDimensions();
    const opacity = useRef(new Animated.Value(0)).current;
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const unsubscribe = subscribe((event) => {
            if (event.type === 'tabPress' && event.isAlreadyActive) {
                setIsVisible(true);
                // Sequence: Fade In -> Hold -> Fade Out
                Animated.sequence([
                    Animated.timing(opacity, {
                        toValue: 0.6, // Visible white flash
                        duration: 50, // Fast fade in
                        useNativeDriver: true,
                    }),
                    Animated.timing(opacity, {
                        toValue: 0,
                        duration: 250, // Smooth fade out
                        useNativeDriver: true,
                    }),
                ]).start(() => {
                    setIsVisible(false);
                });
            }
        });

        return unsubscribe;
    }, [subscribe, opacity]);

    if (!isVisible) return null;

    return (
        <Animated.View
            style={[
                StyleSheet.absoluteFill,
                styles.flash,
                { opacity },
            ]}
            pointerEvents="none"
        />
    );
};

const styles = StyleSheet.create({
    flash: {
        backgroundColor: 'white',
        zIndex: 50, // Below navbar (100) but above content
        elevation: 10, // Below navbar (15)
    },
});

export default ScreenFlash;
