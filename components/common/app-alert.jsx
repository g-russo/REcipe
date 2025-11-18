import React, { useEffect, useRef, useState } from 'react';
import { Animated, Text, View, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { Ionicons } from '@expo/vector-icons';

// Simple animated toast component
// props: visible (bool), type: 'success' | 'error' | 'info', message (string), onClose (fn), duration (ms)
const AppAlert = ({
    visible = false,
    type = 'info',
    message = '',
    title = null,
    onClose = () => { },
    duration = 1800,
    actionable = false,
    actionLabel = 'OK',
    onAction = null,
    children = null,
}) => {
    const [show, setShow] = useState(visible);
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        let timeout;
        if (visible) {
            setShow(true);
            Animated.spring(opacity, {
                toValue: 1,
                friction: 8,
                tension: 40,
                useNativeDriver: true,
            }).start();

            if (!actionable) {
                timeout = setTimeout(() => {
                    Animated.timing(opacity, {
                        toValue: 0,
                        duration: 250,
                        useNativeDriver: true,
                    }).start(() => {
                        setShow(false);
                        onClose && onClose();
                    });
                }, duration);
            }
        } else {
            Animated.timing(opacity, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
            }).start(() => setShow(false));
        }

        return () => {
            if (timeout) clearTimeout(timeout);
        };
    }, [visible, actionable]);

    useEffect(() => {
        // sync visible prop
        if (!visible) setShow(false);
    }, [visible]);

    if (!show) return null;

    const backgroundColor = '#81A969'; // Green color for all alerts

    const handleAction = () => {
        if (onAction && typeof onAction === 'function') {
            try { onAction(); } catch (e) { console.error(e); }
        }
        onClose && onClose();
        setShow(false);
    };

    const getIcon = () => {
        if (type === 'success') return { name: 'checkmark-circle', color: '#81A969' };
        if (type === 'error') return { name: 'alert-circle', color: '#E74C3C' };
        return { name: 'hand-left', color: '#81A969' };
    };

    const getTitle = () => {
        if (title) return title;
        if (type === 'success') return 'Success!';
        if (type === 'error') return 'Error';
        return 'See you soon!';
    };

    const icon = getIcon();

    return (
        <Modal transparent visible={show} animationType="none">
            <Animated.View style={[styles.modalBackdrop, { opacity }]}>
                <View style={styles.modalWrapper}>
                    <View style={styles.modalCard}>
                        {/* Icon */}
                        <View style={styles.iconContainer}>
                            <Ionicons name={icon.name} size={wp('16%')} color={icon.color} />
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
                            {children ? (
                                <>
                                    {actionable && (
                                        <TouchableOpacity
                                            style={[styles.modalButton, styles.primaryButton, styles.fullWidthButton, { backgroundColor: '#81A969' }]}
                                            onPress={handleAction}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={styles.modalButtonText}>{actionLabel}</Text>
                                        </TouchableOpacity>
                                    )}
                                    {children}
                                </>
                            ) : (
                                actionable && (
                                    <TouchableOpacity
                                        style={[styles.modalButton, styles.primaryButton, { backgroundColor: '#81A969' }]}
                                        onPress={handleAction}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={styles.modalButtonText}>{actionLabel}</Text>
                                    </TouchableOpacity>
                                )
                            )}
                        </View>
                    </View>
                </View>
            </Animated.View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalBackdrop: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: wp('5%'),
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
        fontSize: wp('3.8%'),
        color: '#999',
        textAlign: 'center',
        lineHeight: wp('5.5%'),
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
    }
});

export const LogoutAlert = ({ visible, onConfirm, onCancel }) => {
    const cancelButtonStyle = {
        flex: 1,
        paddingVertical: hp('1.6%'),
        borderRadius: wp('2.5%'),
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
    };

    const cancelTextStyle = {
        color: '#81A969',
        fontWeight: '700',
        fontSize: wp('4%'),
        letterSpacing: 0.3,
    };

    return (
        <AppAlert
            visible={visible}
            type="info"
            message="Are you sure you want to log out of your account?"
            actionable
            actionLabel="Log out"
            onAction={onConfirm}
            onClose={onCancel}
        >
            <TouchableOpacity
                style={cancelButtonStyle}
                onPress={onCancel}
                activeOpacity={0.7}
            >
                <Text style={cancelTextStyle}>Cancel</Text>
            </TouchableOpacity>
        </AppAlert>
    );
};

export default AppAlert;
