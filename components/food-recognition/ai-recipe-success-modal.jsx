import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Dimensions,
    Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');

const AIRecipeSuccessModal = ({ visible, onClose, recipeName, pantryItemCount }) => {
    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <BlurView intensity={20} style={styles.blur} tint="dark" />

                <View style={styles.modalContainer}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="sparkles" size={40} color="#FFFFFF" />
                    </View>

                    <Text style={styles.title}>AI Recipe Created!</Text>

                    <Text style={styles.message}>
                        SousChef AI created a custom recipe for <Text style={styles.highlight}>"{recipeName}"</Text>!
                    </Text>

                    {pantryItemCount > 0 && (
                        <View style={styles.pantryBadge}>
                            <Ionicons name="basket" size={16} color="#8A2BE2" />
                            <Text style={styles.pantryText}>
                                Personalized using {pantryItemCount} items from your pantry!
                            </Text>
                        </View>
                    )}

                    <View style={styles.infoBox}>
                        <Ionicons name="information-circle-outline" size={20} color="#666" />
                        <Text style={styles.infoText}>
                            Want more options? Tap "Generate Another" (up to 5 total).
                        </Text>
                    </View>

                    <TouchableOpacity style={styles.button} onPress={onClose}>
                        <Text style={styles.buttonText}>Awesome!</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    blur: {
        ...StyleSheet.absoluteFillObject,
    },
    modalContainer: {
        width: width * 0.85,
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 10,
        },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 10,
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#8A2BE2', // AI generation purple
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        marginTop: -64, // Pull it up out of the box slightly
        borderWidth: 4,
        borderColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 5,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 12,
        textAlign: 'center',
    },
    message: {
        fontSize: 16,
        color: '#555',
        textAlign: 'center',
        marginBottom: 16,
        lineHeight: 22,
    },
    highlight: {
        fontWeight: 'bold',
        color: '#8A2BE2',
    },
    pantryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3E5FF',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        marginBottom: 16,
    },
    pantryText: {
        fontSize: 14,
        color: '#6A1B9A',
        marginLeft: 8,
        fontWeight: '600',
    },
    infoBox: {
        flexDirection: 'row',
        backgroundColor: '#F5F5F5',
        padding: 12,
        borderRadius: 12,
        marginBottom: 24,
        alignItems: 'center',
    },
    infoText: {
        fontSize: 13,
        color: '#666',
        marginLeft: 8,
        flex: 1,
    },
    button: {
        backgroundColor: '#8A2BE2',
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 16,
        width: '100%',
        alignItems: 'center',
        shadowColor: '#8A2BE2',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default AIRecipeSuccessModal;
