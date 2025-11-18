import React, { useEffect, useState } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    TextInput,
    Image,
    ScrollView,
} from 'react-native';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { AVATAR_OPTIONS, getAvatarSource } from './avatar-options';

const ProfileEditModal = ({
    visible,
    onClose,
    onSave,
    initialName = '',
    initialAvatar = null,
}) => {
    const [name, setName] = useState(initialName);
    const [selectedAvatar, setSelectedAvatar] = useState(initialAvatar);
    const [isSaving, setIsSaving] = useState(false);
    const canSave = name.trim().length > 0 && !isSaving;

    useEffect(() => {
        if (visible) {
            setName(initialName);
            setSelectedAvatar(initialAvatar);
            setIsSaving(false);
        }
    }, [visible, initialName, initialAvatar]);

    const handleSave = async () => {
        const trimmedName = name.trim();
        if (!trimmedName || isSaving) {
            return;
        }

        try {
            setIsSaving(true);
            await Promise.resolve(onSave({ name: trimmedName, avatar: selectedAvatar }));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal
            animationType="slide"
            transparent
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.backdrop}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Edit Profile</Text>

                    <ScrollView contentContainerStyle={styles.modalBody}>
                        <View style={styles.section}>
                            <Text style={styles.sectionLabel}>Display name</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter your name"
                                value={name}
                                onChangeText={setName}
                                autoCapitalize="words"
                                maxLength={40}
                                editable={!isSaving}
                            />
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.sectionLabel}>Profile avatar</Text>
                            <View style={styles.avatarGrid}>
                                {AVATAR_OPTIONS.map((option) => {
                                    const source = getAvatarSource(option.id);
                                    const isSelected = selectedAvatar === option.id;
                                    return (
                                        <TouchableOpacity
                                            key={option.id}
                                            style={[styles.avatarItem, isSelected && styles.avatarItemSelected]}
                                            onPress={() => setSelectedAvatar(option.id)}
                                            disabled={isSaving}
                                        >
                                            <Image source={source} style={styles.avatarImage} resizeMode="contain" />
                                            <Text style={styles.avatarLabel}>{option.label}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    </ScrollView>

                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.secondaryButton} onPress={onClose} disabled={isSaving}>
                            <Text style={styles.secondaryButtonText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.primaryButton, !canSave && styles.primaryButtonDisabled]}
                            onPress={handleSave}
                            disabled={!canSave}
                        >
                            <Text style={styles.primaryButtonText}>{isSaving ? 'Saving...' : 'Save changes'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        paddingHorizontal: wp('5%'),
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: wp('4%'),
        padding: wp('5%'),
        maxHeight: hp('80%'),
    },
    modalTitle: {
        fontSize: wp('5.5%'),
        fontWeight: '600',
        marginBottom: hp('2%'),
        color: '#000',
    },
    modalBody: {
        paddingBottom: hp('2%'),
    },
    section: {
        marginBottom: hp('2.5%'),
    },
    sectionLabel: {
        fontSize: wp('3.7%'),
        fontWeight: '500',
        color: '#555',
        marginBottom: hp('1%'),
    },
    input: {
        borderWidth: 1,
        borderColor: '#e0e0e0',
        borderRadius: wp('2%'),
        paddingHorizontal: wp('3%'),
        paddingVertical: hp('1.2%'),
        fontSize: wp('4%'),
        color: '#000',
    },
    avatarGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    avatarItem: {
        width: '48%',
        borderWidth: 1,
        borderColor: '#e0e0e0',
        borderRadius: wp('3%'),
        paddingVertical: hp('1.5%'),
        paddingHorizontal: wp('3%'),
        marginBottom: hp('1.5%'),
        alignItems: 'center',
    },
    avatarItemSelected: {
        borderColor: '#81A969',
        backgroundColor: 'rgba(129, 169, 105, 0.08)',
    },
    avatarImage: {
        width: wp('12%'),
        height: wp('12%'),
        marginBottom: hp('0.5%'),
    },
    avatarLabel: {
        fontSize: wp('3.2%'),
        color: '#333',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: hp('1%'),
    },
    secondaryButton: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#d0d0d0',
        borderRadius: wp('3%'),
        paddingVertical: hp('1.5%'),
        marginRight: wp('2%'),
        alignItems: 'center',
    },
    secondaryButtonText: {
        color: '#333',
        fontSize: wp('4%'),
        fontWeight: '500',
    },
    primaryButton: {
        flex: 1,
        backgroundColor: '#81A969',
        borderRadius: wp('3%'),
        paddingVertical: hp('1.5%'),
        alignItems: 'center',
    },
    primaryButtonDisabled: {
        opacity: 0.7,
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: wp('4%'),
        fontWeight: '600',
    },
});

export default ProfileEditModal;
