import React, { useEffect, useState, useRef } from 'react';
import {
    View,
    StyleSheet,
    Image,
    Animated,
    Dimensions
} from 'react-native';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
// Calculate the diagonal to ensure full screen coverage
const SCREEN_DIAGONAL = Math.sqrt(SCREEN_WIDTH ** 2 + SCREEN_HEIGHT ** 2);

const SplashScreen = ({ onFinish }) => {
    const [show, setShow] = useState(true);
    
    // Animation values
    const irisScale = useRef(new Animated.Value(0)).current; // Start at 0 for iris in
    const contentOpacity = useRef(new Animated.Value(0)).current;
    const contentScale = useRef(new Animated.Value(0.8)).current;
    
    useEffect(() => {
        // Iris in animation - expand from center to full screen
        // Total duration: 500ms (iris) + 300ms (content) = 800ms, but we add buffer
        const IRIS_IN_DURATION = 800;
        const CONTENT_FADE_DURATION = 500;
        const MINIMUM_SHOW_TIME = 2500; // Time to keep the splash screen visible
        
        const startAnimation = () => {
            Animated.sequence([
                // First, expand the iris background (both white and green layers)
                Animated.timing(irisScale, {
                    toValue: 1,
                    duration: IRIS_IN_DURATION,
                    useNativeDriver: true,
                }),
                // Then fade in content with a bouncy scale
                Animated.parallel([
                    Animated.timing(contentOpacity, {
                        toValue: 1,
                        duration: CONTENT_FADE_DURATION,
                        useNativeDriver: true,
                    }),
                    Animated.spring(contentScale, {
                        toValue: 1,
                        friction: 8,
                        tension: 100,
                        useNativeDriver: true,
                    })
                ])
            ]).start(() => {
                // Animation in complete
                // Wait for MINIMUM_SHOW_TIME then exit
                setTimeout(() => {
                    triggerExitAnimation();
                }, MINIMUM_SHOW_TIME);
            });
        };

        startAnimation();
    }, []);

    const triggerExitAnimation = () => {
        // Iris out animation - contract to center
        const CONTENT_FADE_OUT_DURATION = 300;
        const IRIS_OUT_DURATION = 600;
        
        Animated.sequence([
            // First fade out content
            Animated.parallel([
                Animated.timing(contentOpacity, {
                    toValue: 0,
                    duration: CONTENT_FADE_OUT_DURATION,
                    useNativeDriver: true,
                }),
                Animated.timing(contentScale, {
                    toValue: 0.8,
                    duration: CONTENT_FADE_OUT_DURATION,
                    useNativeDriver: true,
                })
            ]),
            // Then contract the iris background
            Animated.timing(irisScale, {
                toValue: 0,
                duration: IRIS_OUT_DURATION,
                useNativeDriver: true,
            })
        ]).start(({ finished }) => {
            if (finished) {
                setShow(false);
                if (onFinish) onFinish();
            }
        });
    };

    if (!show) return null;

    return (
        <View style={styles.container}>
            {/* White background layer - covers content behind the overlay */}
            <Animated.View
                style={[
                    styles.irisCircle,
                    styles.whiteLayer,
                    {
                        transform: [{ scale: irisScale }]
                    }
                ]}
            />
            
            {/* Green iris circle that expands/contracts on top of white */}
            <Animated.View
                style={[
                    styles.irisCircle,
                    styles.greenLayer,
                    {
                        transform: [{ scale: irisScale }]
                    }
                ]}
            />
            
            {/* Content on top of the iris */}
            <Animated.View
                style={[
                    styles.content,
                    {
                        opacity: contentOpacity,
                        transform: [{ scale: contentScale }]
                    }
                ]}
            >
                <Image
                    source={require('../assets/recipe_loading.gif')}
                    style={styles.gif}
                    resizeMode="contain"
                />
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 99999, // Very high z-index to be on top of everything
        elevation: 99999, // For Android
        overflow: 'hidden',
        backgroundColor: '#ffffff', // Match native splash background
        pointerEvents: 'none', // Allow touches to pass through if needed, but usually splash blocks interaction
    },
    irisCircle: {
        position: 'absolute',
        width: SCREEN_DIAGONAL,
        height: SCREEN_DIAGONAL,
        borderRadius: SCREEN_DIAGONAL / 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    whiteLayer: {
        backgroundColor: '#FFFFFF',
        zIndex: 0,
    },
    greenLayer: {
        backgroundColor: '#81A969',
        zIndex: 1,
    },
    content: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        zIndex: 2,
    },
    gif: {
        width: wp('50%'),
        height: wp('50%'),
        marginBottom: hp('2%'),
    }
});

export default SplashScreen;
