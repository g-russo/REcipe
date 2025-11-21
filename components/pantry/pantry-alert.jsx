import React, { useEffect, useRef, useState } from 'react';
import { Animated, Text, View, StyleSheet, TouchableOpacity, Modal, Easing, TouchableWithoutFeedback } from 'react-native';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { Ionicons } from '@expo/vector-icons';

// Animated button component with press feedback
export const AnimatedButton = ({ children, onPress, style, activeOpacity = 0.85 }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: 0.92,
            friction: 4,
            tension: 120,
            useNativeDriver: true,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 4,
            tension: 120,
            useNativeDriver: true,
        }).start();
    };

    return (
        <TouchableWithoutFeedback
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
        >
            <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
                {children}
            </Animated.View>
        </TouchableWithoutFeedback>
    );
};

// Modal Alert component (no auto-dismiss)
// props: visible (bool), type: 'success' | 'error' | 'info', message (string), onClose (fn)
const PantryAlert = ({
    visible = false,
    type = 'info',
    message = '',
    title = null,
    onClose = () => { },
    // duration intentionally unused now (no auto dismiss)
    duration = 0,
    actionable = false,
    actionLabel = 'OK',
    onAction = null,
    children = null,
    // Optional: provide a custom icon React element to override default
    customIcon = null,
}) => {
    const [show, setShow] = useState(visible);
    const opacity = useRef(new Animated.Value(0)).current;
    const scale = useRef(new Animated.Value(0.8)).current;
    const translateY = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        if (visible) {
            setShow(true);
            Animated.parallel([
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 300,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
                Animated.spring(scale, {
                    toValue: 1,
                    friction: 7,
                    tension: 50,
                    useNativeDriver: true,
                }),
                Animated.timing(translateY, {
                    toValue: 0,
                    duration: 300,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(opacity, {
                    toValue: 0,
                    duration: 200,
                    easing: Easing.in(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(scale, {
                    toValue: 0.9,
                    duration: 200,
                    easing: Easing.in(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(translateY, {
                    toValue: 20,
                    duration: 200,
                    easing: Easing.in(Easing.ease),
                    useNativeDriver: true,
                }),
            ]).start(() => {
                setShow(false);
                // Reset values for next show
                opacity.setValue(0);
                scale.setValue(0.8);
                translateY.setValue(30);
                // Only call onClose after animation completes and modal is hidden
                if (!visible && typeof onClose === 'function') {
                    onClose();
                }
            });
        }
    }, [visible]);

    if (!show) return null;

    const handleClose = () => {
        // Call onClose to update parent state (this will trigger the exit animation via useEffect)
        onClose && onClose();
    };

    const handleAction = () => {
        if (onAction && typeof onAction === 'function') {
            try { onAction(); } catch (e) { console.error(e); }
        }
        handleClose();
    };

    const getIcon = () => {
        if (type === 'success') return { name: 'checkmark-circle', color: '#81A969' };
        if (type === 'error') return { name: 'alert-circle', color: '#E74C3C' };
        return { name: 'information-circle', color: '#81A969' };
    };

    const getTitle = () => {
        if (title) return title;
        if (type === 'success') return 'Success!';
        if (type === 'error') return 'Error';
        return 'See you soon!';
    };

    const icon = getIcon();

    return (
        <Modal transparent visible={show} animationType="none" onRequestClose={handleClose}>
            <TouchableWithoutFeedback onPress={() => {}}>
                <Animated.View style={[styles.modalBackdrop, { opacity }]}>
                    <TouchableWithoutFeedback onPress={() => {}}>
                        <Animated.View style={[
                            styles.modalWrapper,
                            {
                                opacity,
                                transform: [{ scale }, { translateY }]
                            }
                        ]}>
                            <View style={styles.modalCard}>
                                {/* Icon */}
                                <View style={styles.iconContainer}>
                                    {customIcon ? customIcon : null}
                                </View>

                                {/* Title */}
                                <View style={styles.modalHeader}>
                                    <Text style={[styles.modalTitle, { color: '#333' }]}>
                                        {getTitle()}
                                    </Text>
                                </View>

                                {/* Message */}
                                <View style={styles.modalContent}>
                                    <Text style={styles.modalMessage}>{message}</Text>
                                </View>

                                {/* Actions */}
                                <View style={[styles.modalActions, children && styles.modalActionsVertical]}>
                                    {actionable && (
                                        <AnimatedButton
                                            style={[styles.modalButton, styles.primaryButton, children && styles.fullWidthButton, { backgroundColor: '#81A969' }]}
                                            onPress={handleAction}
                                        >
                                            <Text style={styles.modalButtonText}>{actionLabel}</Text>
                                        </AnimatedButton>
                                    )}
                                    {children}
                                    {/* Cancel button */}
                                    <TouchableOpacity
                                        style={styles.cancelButton}
                                        onPress={handleClose}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.cancelButtonText}>Cancel</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </Animated.View>
                    </TouchableWithoutFeedback>
                </Animated.View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalBackdrop: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: wp('5%'),
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalWrapper: {
        width: '100%',
        maxWidth: 380,
    },
    modalCard: {
        backgroundColor: '#fff',
        borderRadius: wp('5%'),
        padding: 0,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 16,
    },
    iconContainer: {
        paddingTop: hp('3.5%'),
        alignItems: 'center',
    },
    modalHeader: {
        paddingTop: hp('2%'),
        paddingHorizontal: wp('6%'),
        paddingBottom: hp('1%'),
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: wp('6%'),
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    modalContent: {
        paddingHorizontal: wp('6%'),
        paddingBottom: hp('3%'),
        alignItems: 'center',
    },
    modalMessage: {
        fontSize: wp('4.2%'),
        color: '#555',
        textAlign: 'center',
        lineHeight: wp('6%'),
        fontWeight: '500',
        letterSpacing: 0.2,
    },
    modalActions: {
        width: '100%',
        paddingHorizontal: wp('6%'),
        paddingBottom: hp('2.5%'),
        flexDirection: 'row',
        gap: wp('3%'),
    },
    modalActionsVertical: {
        flexDirection: 'column',
        gap: 0,
    },
    modalButton: {
        flex: 1,
        paddingVertical: hp('1.6%'),
        borderRadius: wp('2.5%'),
        alignItems: 'center',
        justifyContent: 'center',
    },
    fullWidthButton: {
        flex: 0,
        width: '100%',
    },
    primaryButton: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    modalButtonText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: wp('4%'),
        letterSpacing: 0.3,
    },
    secondaryButtonText: {
        color: '#81A969',
        fontWeight: '700',
        fontSize: wp('4%'),
        letterSpacing: 0.3,
    },
    cancelButton: {
        width: '100%',
        paddingVertical: hp('1.6%'),
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: hp('0.5%'),
    },
    cancelButtonText: {
        color: '#999',
        fontWeight: '600',
        fontSize: wp('4%'),
        letterSpacing: 0.3,
    },
});

export default PantryAlert;
