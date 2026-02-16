import React from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Archive Modal
 * Shows archived items with options to restore or permanently delete
 */
const ArchiveModal = ({ visible, onClose, archivedItems = [], onRestore, onDelete }) => {
    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.modalContainer}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.titleContainer}>
                            <Ionicons name="archive" size={24} color="#666" />
                            <Text style={styles.title}>Archive</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="#666" />
                        </TouchableOpacity>
                    </View>

                    {/* Archived Items List*/}
                    <ScrollView style={styles.itemsList} contentContainerStyle={styles.itemsListContent}>
                        {archivedItems.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Ionicons name="archive-outline" size={64} color="#ccc" />
                                <Text style={styles.emptyTitle}>No Archived Items</Text>
                                <Text style={styles.emptySubtitle}>
                                    Items moved to archive will appear here
                                </Text>
                            </View>
                        ) : (
                            archivedItems.map((item) => (
                                <View key={item.itemID} style={styles.itemCard}>
                                    {/* Item  Info */}
                                    <View style={styles.itemInfo}>
                                        {item.imageURL ? (
                                            <Image source={{ uri: item.imageURL }} style={styles.itemImage} />
                                        ) : (
                                            <View style={[styles.itemImage, styles.placeholderImage]}>
                                                <Ionicons name="cube-outline" size={24} color="#999" />
                                            </View>
                                        )}
                                        <View style={styles.itemDetails}>
                                            <Text style={styles.itemName}>{item.itemName}</Text>
                                            <Text style={styles.itemCategory}>{item.itemCategory}</Text>
                                            {item.itemExpiration && (
                                                <Text style={styles.itemExpiry}>
                                                    Best before: {new Date(item.itemExpiration).toLocaleDateString()}
                                                </Text>
                                            )}
                                        </View>
                                    </View>

                                    {/* Action Buttons */}
                                    <View style={styles.itemActions}>
                                        <TouchableOpacity
                                            style={[styles.actionButton, styles.restoreButton]}
                                            onPress={() => onRestore(item)}
                                        >
                                            <Ionicons name="arrow-undo" size={18} color="#81A969" />
                                            <Text style={styles.restoreText}>Restore</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[styles.actionButton, styles.deleteButton]}
                                            onPress={() => onDelete(item)}
                                        >
                                            <Ionicons name="trash-outline" size={18} color="#F44336" />
                                            <Text style={styles.deleteText}>Delete</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '90%',
        paddingBottom: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    titleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    closeButton: {
        padding: 8,
    },
    itemsList: {
        flex: 1,
    },
    itemsListContent: {
        padding: 16,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#999',
        marginTop: 16,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#aaa',
        marginTop: 8,
        textAlign: 'center',
    },
    itemCard: {
        backgroundColor: '#f9f9f9',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    itemInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    itemImage: {
        width: 60,
        height: 60,
        borderRadius: 8,
        marginRight: 12,
    },
    placeholderImage: {
        backgroundColor: '#f0f0f0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    itemDetails: {
        flex: 1,
    },
    itemName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    itemCategory: {
        fontSize: 13,
        color: '#666',
        marginBottom: 2,
    },
    itemExpiry: {
        fontSize: 12,
        color: '#999',
    },
    itemActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        gap: 6,
    },
    restoreButton: {
        backgroundColor: '#E8F5E9',
        borderWidth: 1,
        borderColor: '#81A969',
    },
    restoreText: {
        color: '#81A969',
        fontSize: 14,
        fontWeight: '600',
    },
    deleteButton: {
        backgroundColor: '#FFEBEE',
        borderWidth: 1,
        borderColor: '#F44336',
    },
    deleteText: {
        color: '#F44336',
        fontSize: 14,
        fontWeight: '600',
    },
});

export default ArchiveModal;
