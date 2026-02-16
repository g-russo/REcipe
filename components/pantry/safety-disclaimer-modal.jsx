import React from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Animated,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

/**
 * Safety Disclaimer Modal
 * Shown when user chooses to use an item past its best-before date
 */
const SafetyDisclaimerModal = ({ visible, onAccept, onCancel, itemName }) => {
    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onCancel}
        >
            <View style={styles.overlay}>
                <View style={styles.modalContainer}>
                    {/* Header with Shield Icon */}
                    <View style={styles.header}>
                        <MaterialCommunityIcons name="shield-alert" size={48} color="#F44336" />
                        <Text style={styles.title}>Safety Notice</Text>
                    </View>

                    {/* Warning Message */}
                    <View style={styles.messageContainer}>
                        <View style={styles.warningBox}>
                            <Ionicons name="warning" size={24} color="#F44336" />
                            <Text style={styles.warningTitle}>Important Safety Information</Text>
                        </View>

                        <Text style={styles.message}>
                            You are choosing to use{' '}
                            <Text style={styles.itemNameText}>{itemName}</Text>{' '}
                            which is past its best-before date.
                        </Text>

                        <Text style={styles.message}>
                            The REcipe team cannot guarantee the safety or quality of items
                            used beyond their best-before date.
                        </Text>

                        <Text style={styles.disclaimer}>
                            By proceeding, you acknowledge that you have inspected the item
                            and accept full responsibility for any health or safety concerns
                            that may arise from its use.
                        </Text>

                        <Text style={styles.proceedText}>
                            Proceed at your own discretion.
                        </Text>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={[styles.button, styles.acceptButton]}
                            onPress={onAccept}
                        >
                            <Text style={styles.acceptButtonText}>I Understand, Continue</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.button, styles.cancelButton]}
                            onPress={onCancel}
                        >
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 400,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    header: {
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: '#333',
        marginTop: 12,
    },
    messageContainer: {
        marginBottom: 24,
    },
    warningBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFE5E5',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
        borderLeftWidth: 4,
        borderLeftColor: '#F44336',
    },
    warningTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#D32F2F',
        marginLeft: 10,
    },
    message: {
        fontSize: 15,
        color: '#555',
        lineHeight: 22,
        marginBottom: 12,
    },
    itemNameText: {
        fontWeight: '700',
        color: '#333',
    },
    disclaimer: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
        marginBottom: 12,
        backgroundColor: '#FFF9E5',
        padding: 12,
        borderRadius: 8,
        borderLeftWidth: 3,
        borderLeftColor: '#FF9800',
    },
    proceedText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#F44336',
        textAlign: 'center',
        marginTop: 8,
    },
    buttonContainer: {
        flexDirection: 'column',
        gap: 12,
    },
    button: {
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    acceptButton: {
        backgroundColor: '#81A969',
        shadowColor: '#81A969',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3,
    },
    acceptButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    cancelButton: {
        backgroundColor: 'transparent',
        borderWidth: 0,
    },
    cancelButtonText: {
        color: '#999',
        fontSize: 15,
        fontWeight: '600',
    },
});

export default SafetyDisclaimerModal;
