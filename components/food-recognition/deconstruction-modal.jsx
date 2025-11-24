import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    Dimensions,
    Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { BlurView } from 'expo-blur';

const DeconstructionModal = ({ visible, onClose, data, onSearchRecipe, onRecipeSelect, onGenerateRecipe }) => {
    if (!data) return null;

    const { is_dish, ingredients, suggested_recipes, reasoning, originalDish, realRecipes } = data;

    const [confirmVisible, setConfirmVisible] = useState(false);
    const [pendingRecipe, setPendingRecipe] = useState(null);

    const handleConfirmGenerate = () => {
        setConfirmVisible(false);
        if (onGenerateRecipe && pendingRecipe) onGenerateRecipe(pendingRecipe);
        setPendingRecipe(null);
    };

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.centeredView}>
                <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
                <View style={styles.modalView}>

                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.iconContainer}>
                            <Ionicons name={is_dish ? "restaurant" : "nutrition"} size={32} color="#FFF" />
                        </View>
                        <Text style={styles.modalTitle}>
                            {is_dish ? "Dish Deconstructed!" : "Ingredient Analyzed"}
                        </Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="#999" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

                        {/* Context */}
                        <Text style={styles.subTitle}>
                            We identified <Text style={styles.highlight}>{originalDish}</Text>.
                        </Text>
                        <Text style={styles.description}>{reasoning}</Text>

                        {/* Ingredients Section */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>
                                <Ionicons name="list" size={18} color="#81A969" /> Ingredient Breakdown
                            </Text>
                            <View style={styles.tagContainer}>
                                {ingredients.map((ing, index) => (
                                    <View key={index} style={styles.tag}>
                                        <Text style={styles.tagText}>{ing}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>

                        {/* Real Recipes Found Section */}
                        {realRecipes && realRecipes.length > 0 && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>
                                    <Ionicons name="flame" size={18} color="#FF6B6B" /> Ready to Cook
                                </Text>
                                <Text style={styles.sectionSubtitle}>Recipes using these ingredients:</Text>

                                {realRecipes.map((recipe, index) => (
                                    <TouchableOpacity
                                        key={index}
                                        style={styles.realRecipeCard}
                                        onPress={() => onRecipeSelect ? onRecipeSelect(recipe) : onSearchRecipe(recipe.label)}
                                    >
                                        <Image source={{ uri: recipe.image }} style={styles.recipeImage} />
                                        <View style={styles.recipeInfo}>
                                            <Text style={styles.recipeName} numberOfLines={2}>{recipe.label}</Text>
                                            <Text style={styles.recipeSource}>{recipe.source}</Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={20} color="#CCC" />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        {/* AI Suggested Recipes Section */}
                        {suggested_recipes && suggested_recipes.length > 0 && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>
                                    <Ionicons name="sparkles" size={18} color="#FFB74D" /> Create Recipes with SousChefAI
                                </Text>
                                <Text style={styles.sectionSubtitle}>Tap to generate a recipe automatically:</Text>

                                {suggested_recipes.map((recipe, index) => (
                                    <TouchableOpacity
                                        key={index}
                                        style={styles.recipeButton}
                                        onPress={() => { setPendingRecipe(recipe); setConfirmVisible(true); }}
                                    >
                                        <Text style={styles.recipeButtonText}>{recipe}</Text>
                                        <Ionicons name="arrow-forward-circle" size={20} color="#81A969" />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        {/* Confirmation Modal for AI generation */}
                        <Modal
                            visible={confirmVisible}
                            transparent={true}
                            animationType="fade"
                            onRequestClose={() => setConfirmVisible(false)}
                        >
                            <View style={styles.confirmCentered}>
                                <View style={styles.confirmView}>
                                    <Text style={styles.confirmTitle}>Generate Recipe?</Text>
                                    <Text style={styles.confirmText}>Generate a recipe using SousChefAI for "{pendingRecipe}"? This will create a generated recipe automatically.</Text>
                                    <View style={styles.confirmButtonsRow}>
                                        <TouchableOpacity style={[styles.confirmButton, styles.confirmCancelButton]} onPress={() => { setConfirmVisible(false); setPendingRecipe(null); }}>
                                            <Text style={styles.confirmButtonText}>Cancel</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[styles.confirmButton, styles.confirmPrimaryButton]} onPress={handleConfirmGenerate}>
                                            <Text style={[styles.confirmButtonText, { color: '#fff' }]}>Generate</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        </Modal>

                    </ScrollView>

                    {/* Footer Actions */}
                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={styles.primaryButton}
                            onPress={() => onSearchRecipe(ingredients.join(', '))}
                        >
                            <Text style={styles.primaryButtonText}>Search by Breakdown</Text>
                            <Ionicons name="search" size={20} color="#FFF" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.secondaryButton}
                            onPress={() => onSearchRecipe(originalDish)}
                        >
                            <Text style={styles.secondaryButtonText}>Search for "{originalDish}"</Text>
                        </TouchableOpacity>
                    </View>

                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalView: {
        width: '90%',
        maxHeight: '85%',
        backgroundColor: 'white',
        borderRadius: 24,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 10,
        overflow: 'hidden',
    },
    header: {
        alignItems: 'center',
        paddingTop: 30,
        paddingBottom: 20,
        backgroundColor: '#F9FAFB',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
        position: 'relative',
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#81A969',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
        shadowColor: '#81A969',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#333',
    },
    closeButton: {
        position: 'absolute',
        top: 16,
        right: 16,
        padding: 8,
    },
    content: {
        padding: 24,
    },
    subTitle: {
        fontSize: 16,
        color: '#444',
        textAlign: 'center',
        marginBottom: 8,
    },
    highlight: {
        fontWeight: 'bold',
        color: '#81A969',
    },
    description: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        marginBottom: 24,
        fontStyle: 'italic',
        lineHeight: 20,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
    },
    sectionSubtitle: {
        fontSize: 13,
        color: '#888',
        marginBottom: 10,
    },
    tagContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    tag: {
        backgroundColor: '#F0F7ED',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#DCECDC',
    },
    tagText: {
        color: '#558B2F',
        fontSize: 14,
        fontWeight: '500',
    },
    realRecipeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        borderRadius: 12,
        marginBottom: 10,
        padding: 8,
        borderWidth: 1,
        borderColor: '#EEE',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    recipeImage: {
        width: 50,
        height: 50,
        borderRadius: 8,
        marginRight: 12,
        backgroundColor: '#EEE',
    },
    recipeInfo: {
        flex: 1,
    },
    recipeName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#333',
        marginBottom: 2,
    },
    recipeSource: {
        fontSize: 12,
        color: '#888',
    },
    recipeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFF',
        padding: 16,
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#EEE',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    recipeButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#333',
    },
    footer: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
        backgroundColor: '#FFF',
    },
    primaryButton: {
        flexDirection: 'row',
        backgroundColor: '#81A969',
        paddingVertical: 16,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#81A969',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
        marginBottom: 10,
    },
    primaryButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
        marginRight: 8,
    },
    secondaryButton: {
        paddingVertical: 12,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    secondaryButtonText: {
        color: '#81A969',
        fontSize: 15,
        fontWeight: '600',
    },
    /* Confirmation modal styles */
    confirmCentered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.45)'
    },
    confirmView: {
        width: '85%',
        backgroundColor: '#FFF',
        borderRadius: 14,
        padding: 20,
        alignItems: 'center',
        elevation: 6,
    },
    confirmTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 8,
        color: '#222'
    },
    confirmText: {
        fontSize: 14,
        color: '#555',
        textAlign: 'center',
        marginBottom: 16,
    },
    confirmButtonsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%'
    },
    confirmButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        marginHorizontal: 6,
    },
    confirmPrimaryButton: {
        backgroundColor: '#81A969'
    },
    confirmCancelButton: {
        backgroundColor: '#F0F0F0'
    },
    confirmButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#333'
    },
});

export default DeconstructionModal;
