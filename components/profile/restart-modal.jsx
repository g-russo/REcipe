import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import Restart from 'react-native-restart';

const RestartModal = ({ visible, onClose }) => {
    if (!visible) return null;
    const handleRestart = () => {
        if (Restart && typeof Restart.restart === 'function') {
            Restart.restart();
        }
        if (onClose) onClose();
    };
    return (
        <View style={styles.backdrop}>
            <View style={styles.modalContent}>
                <Text style={styles.title}>Please restart the app</Text>
                <Text style={styles.message}>
                    For your changes to take full effect and avoid any database connection issues, please restart the app now.
                </Text>
                <TouchableOpacity style={styles.button} onPress={handleRestart}>
                    <Text style={styles.buttonText}>Restart Now</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 999,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: wp('4%'),
        padding: wp('6%'),
        width: '80%',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 8,
    },
    title: {
        fontSize: wp('5%'),
        fontWeight: 'bold',
        marginBottom: hp('1.5%'),
        color: '#333',
        textAlign: 'center',
    },
    message: {
        fontSize: wp('4%'),
        color: '#555',
        marginBottom: hp('2.5%'),
        textAlign: 'center',
    },
    button: {
        backgroundColor: '#81A969',
        borderRadius: wp('2.5%'),
        paddingVertical: hp('1.2%'),
        paddingHorizontal: wp('6%'),
        marginTop: hp('1%'),
    },
    buttonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: wp('4%'),
    },
});

export default RestartModal;
