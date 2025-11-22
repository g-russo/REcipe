import React, { useEffect, useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    Animated,
    Dimensions
} from 'react-native';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
// Calculate the diagonal to ensure full screen coverage
const SCREEN_DIAGONAL = Math.sqrt(SCREEN_WIDTH ** 2 + SCREEN_HEIGHT ** 2);

const LOADING_PHRASES = [
    "Asking the chef...",
    "Sniffing the ingredients...",
    "Consulting the flavor spirits...",
    "Decoding the secret recipe...",
    "Warming up the oven...",
    "Chopping the pixels..."
];

const LoadingOverlay = ({ visible }) => {
    const [phraseIndex, setPhraseIndex] = useState(0);
    const [show, setShow] = useState(visible);
    const [isAnimating, setIsAnimating] = useState(false);

    // Animation values
    const irisScale = useRef(new Animated.Value(0)).current; // Start at 0 for iris in
    const contentOpacity = useRef(new Animated.Value(0)).current;
    const contentScale = useRef(new Animated.Value(0.8)).current;
    
    const animationStartTime = useRef(null);
    const shouldClose = useRef(false);

    useEffect(() => {
        let interval;
        if (visible) {
            setShow(true);
            setIsAnimating(true);
            shouldClose.current = false;
            animationStartTime.current = Date.now();
            
            // Iris in animation - expand from center to full screen
            // Total duration: 500ms (iris) + 300ms (content) = 800ms, but we add 500ms buffer
            const IRIS_IN_DURATION = 500;
            const CONTENT_FADE_DURATION = 300;
            const MINIMUM_SHOW_TIME = 1300; // Minimum time to show the animation
            
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
                // Animation complete, but enforce minimum duration
                const elapsedTime = Date.now() - animationStartTime.current;
                const remainingTime = Math.max(0, MINIMUM_SHOW_TIME - elapsedTime);
                
                setTimeout(() => {
                    setIsAnimating(false);
                    // If visible was set to false during animation, trigger exit now
                    if (shouldClose.current) {
                        triggerExitAnimation();
                    }
                }, remainingTime);
            });

            // Rotate phrases
            interval = setInterval(() => {
                setPhraseIndex((prev) => (prev + 1) % LOADING_PHRASES.length);
            }, 3000);
        } else {
            // If animation is still running, defer the close
            if (isAnimating) {
                shouldClose.current = true;
            } else {
                triggerExitAnimation();
            }
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [visible]);

    const triggerExitAnimation = () => {
        // Iris out animation - contract to center
        const CONTENT_FADE_OUT_DURATION = 200;
        const IRIS_OUT_DURATION = 400;
        
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
                shouldClose.current = false;
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
                    source={require('../../assets/recipe_loading.gif')}
                    style={styles.gif}
                    resizeMode="contain"
                />
                <Text style={styles.phrase}>
                    {LOADING_PHRASES[phraseIndex]}
                </Text>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
        overflow: 'hidden',
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
    },
    phrase: {
        color: '#FFFFFF',
        fontSize: wp('5%'),
        fontWeight: '600',
        textAlign: 'center',
        paddingHorizontal: wp('10%'),
        marginTop: hp('2%'),
        fontStyle: 'italic'
    }
});

export default LoadingOverlay;
