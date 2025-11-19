import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    SafeAreaView,
    Image,
    ActivityIndicator,
    StatusBar,
    Platform,
    RefreshControl
} from 'react-native';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import cacheService from '../services/supabase-cache-service';
import AuthGuard from '../components/auth-guard';

const PopularRecipes = () => {
    const router = useRouter();
    const [popularRecipes, setPopularRecipes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadPopularRecipes();
    }, []);

    const loadPopularRecipes = async (forceRefresh = false) => {
        try {
            if (!forceRefresh) {
                setLoading(true);
            }

            const recipes = await cacheService.getPopularRecipes(forceRefresh);

            if (recipes && recipes.length > 0) {
                const displayRecipes = recipes.map((recipe, index) => ({
                    id: recipe.uri || `recipe-${index}`,
                    title: recipe.label || recipe.title,
                    image: recipe.image,
                    recipeData: recipe,
                    category: recipe.cuisineType?.[0] || recipe.category || 'General',
                    calories: Math.round(recipe.calories / recipe.yield) || recipe.calories || 0,
                    time: recipe.totalTime || recipe.time || 30,
                }));

                setPopularRecipes(displayRecipes);
            }
        } catch (error) {
            console.error('❌ Error loading popular recipes:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadPopularRecipes(true);
    };

    const handleRecipePress = (recipe) => {
        router.push({
            pathname: '/recipe-detail',
            params: {
                recipeData: JSON.stringify(recipe.recipeData),
                recipeSource: 'edamam',
                fromPopular: 'true'
            }
        });
    };

    return (
        <AuthGuard>
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="dark-content" backgroundColor="#fff" />

                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.back()}
                    >
                        <Svg width={wp('6%')} height={wp('6%')} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <Path d="m15 18-6-6 6-6" />
                        </Svg>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Popular Recipes</Text>
                </View>                {loading && !refreshing ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#81A969" />
                        <Text style={styles.loadingText}>Loading popular recipes...</Text>
                    </View>
                ) : (
                    <ScrollView
                        style={styles.scrollView}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={handleRefresh}
                                colors={['#81A969']}
                                tintColor="#81A969"
                            />
                        }
                        contentContainerStyle={{ paddingBottom: hp('5%') }}
                    >
                        <View style={styles.recipeGrid}>
                            {popularRecipes.map((recipe) => (
                                <TouchableOpacity
                                    key={recipe.id}
                                    style={styles.recipeCard}
                                    onPress={() => handleRecipePress(recipe)}
                                    activeOpacity={0.9}
                                >
                                    <View style={styles.imageContainer}>
                                        {recipe.image ? (
                                            <Image
                                                source={{ uri: recipe.image }}
                                                style={styles.recipeImage}
                                                resizeMode="cover"
                                            />
                                        ) : (
                                            <View style={[styles.recipeImage, styles.placeholderImage]}>
                                                <Svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <Path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                                                    <Path d="m21 15-5-5L5 21" />
                                                    <Path d="m21 3-2 2" />
                                                </Svg>
                                            </View>
                                        )}
                                    </View>

                                    <View style={styles.recipeInfo}>
                                        <Text style={styles.recipeTitle} numberOfLines={2}>
                                            {recipe.title}
                                        </Text>

                                        <View style={styles.recipeStats}>
                                            <View style={styles.statItem}>
                                                <Ionicons name="time-outline" size={wp('4%')} color="#7f8c8d" style={styles.statIcon} />
                                                <Text style={styles.statText}>{recipe.time} min</Text>
                                            </View>
                                            <View style={styles.statItem}>
                                                <Svg width={wp('4%')} height={wp('4%')} viewBox="0 0 24 24" fill="none" stroke="#7f8c8d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <Path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                                                </Svg>
                                                <Text style={styles.statText}>{recipe.calories} kcal</Text>
                                            </View>
                                        </View>

                                        {recipe.category && (
                                            <View style={styles.categoryBadge}>
                                                <Text style={styles.categoryText}>{recipe.category}</Text>
                                            </View>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {popularRecipes.length === 0 && !loading && (
                            <View style={styles.emptyContainer}>
                                <Svg width={60} height={60} viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <Path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
                                </Svg>
                                <Text style={styles.emptyText}>No popular recipes available</Text>
                                <Text style={styles.emptySubtext}>Pull down to refresh</Text>
                            </View>
                        )}
                    </ScrollView>
                )}
            </SafeAreaView>
        </AuthGuard>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: wp('5%'),
        paddingTop: hp('2%'),
        paddingBottom: hp('1.5%'),
    },
    backButton: {
        width: wp('12%'),
        height: wp('12%'),
        backgroundColor: '#81A969',
        borderRadius: wp('3%'),
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
    },
    headerTitle: {
        fontSize: wp('7.5%'),
        fontWeight: 'bold',
        color: '#333',
        flex: 1,
        textAlign: 'right',
        marginLeft: wp('3%'),
    },
    scrollView: {
        flex: 1,
    },
    recipeGrid: {
        paddingHorizontal: wp('5%'),
        paddingTop: hp('2%'),
    },
    recipeCard: {
        backgroundColor: '#fff',
        borderRadius: wp('4%'),
        marginBottom: hp('2.5%'),
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
    },
    imageContainer: {
        margin: wp('3%'),
        borderRadius: wp('3%'),
        overflow: 'hidden',
        height: hp('25%'),
    },
    recipeImage: {
        width: '100%',
        height: '100%',
    },
    placeholderImage: {
        backgroundColor: '#f0f0f0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    recipeInfo: {
        padding: wp('4%'),
        paddingTop: 0,
    },
    recipeTitle: {
        fontSize: wp('4.5%'),
        fontWeight: 'bold',
        color: '#333',
        marginBottom: hp('1.5%'),
        lineHeight: wp('5.5%'),
    },
    recipeStats: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: wp('5%'),
        marginBottom: hp('1%'),
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: wp('1.5%'),
    },
    statIcon: {
        marginRight: wp('1%'),
    },
    statText: {
        fontSize: wp('3.5%'),
        color: '#7f8c8d',
        fontWeight: '500',
    },
    categoryBadge: {
        alignSelf: 'flex-start',
        backgroundColor: '#80a9694b',
        paddingHorizontal: wp('3%'),
        paddingVertical: hp('0.6%'),
        borderRadius: wp('4%'),
        marginTop: hp('0.5%'),
    },
    categoryText: {
        fontSize: wp('3%'),
        color: '#333',
        fontWeight: '500',
        textTransform: 'capitalize',
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        fontSize: wp('4%'),
        color: '#666',
        marginTop: hp('2%'),
        fontWeight: '500',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: hp('10%'),
    },
    emptyText: {
        fontSize: wp('4.5%'),
        color: '#666',
        fontWeight: '600',
        marginTop: hp('2%'),
    },
    emptySubtext: {
        fontSize: wp('3.5%'),
        color: '#999',
        marginTop: hp('0.5%'),
    },
});

export default PopularRecipes;
