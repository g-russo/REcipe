import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Dimensions,
    Animated,
    Modal,
    TouchableWithoutFeedback,
    Platform,
    Alert,
    BackHandler
} from 'react-native';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { Ionicons } from '@expo/vector-icons';
import { useTabContext } from '../contexts/tab-context';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import * as Haptics from 'expo-haptics';

// Import Scanners
import BarcodeScannerModal from './barcode-scanner-modal';
import QRScannerModal from './qr-scanner-modal';
import OCRScannerModal from './ocr-scanner-modal';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const UploadModal = () => {
    const { isUploadModalVisible, hideUploadModal } = useTabContext();
    const fadeAnim = useRef(new Animated.Value(0)).current;

    // Animation Values for 5 items
    const itemAnims = useRef([...Array(5)].map(() => new Animated.Value(0))).current;

    // Scanner States
    const [barcodeScannerVisible, setBarcodeScannerVisible] = useState(false);
    const [qrScannerVisible, setQrScannerVisible] = useState(false);
    const [ocrVisible, setOcrVisible] = useState(false);

    // Handle Android Back Button
    useEffect(() => {
        const backAction = () => {
            if (isUploadModalVisible) {
                hideUploadModal();
                return true;
            }
            return false;
        };

        const backHandler = BackHandler.addEventListener(
            "hardwareBackPress",
            backAction
        );

        return () => backHandler.remove();
    }, [isUploadModalVisible, hideUploadModal]);

    useEffect(() => {
        if (isUploadModalVisible) {
            // ENTRY: Staggered Bottom-to-Top
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
                Animated.stagger(50, itemAnims.map(anim =>
                    Animated.spring(anim, {
                        toValue: 1,
                        friction: 6,
                        tension: 50,
                        useNativeDriver: true
                    })
                ))
            ]).start();
        } else {
            // EXIT: Staggered Top-to-Bottom (Reverse order)
            const reversedAnims = [...itemAnims].reverse();

            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
                Animated.stagger(40, reversedAnims.map(anim =>
                    Animated.timing(anim, {
                        toValue: 0,
                        duration: 200,
                        useNativeDriver: true
                    })
                ))
            ]).start();
        }
    }, [isUploadModalVisible]);

    // --- Logic Migration from upload.jsx ---

    // Helper function to determine category
    const determineFoodCategory = (foodName) => {
        const name = foodName.toLowerCase();

        // Cooked/Prepared Categories
        if (/adobo|sinigang|tinola|menudo|caldereta|kare-kare|lechon|sisig|lumpia|pancit|viand|ulam|leftover|left over/i.test(name)) {
            return 'Leftovers';
        }
        if (/kanin|rice|fried rice|sinangag|garlic rice|rice dish|paella|risotto|biryani|pilaf/i.test(name)) {
            return 'Rice';
        }
        if (/sabaw|soup|sinigang|bulalo|nilaga|tinola|broth|stew|chowder|bisque/i.test(name)) {
            return 'Soup';
        }
        if (/bibingka|puto|kutsinta|sapin-sapin|suman|biko|kakanin/i.test(name)) {
            return 'Kakanin';
        }

        // Raw Ingredients
        if (/flour|baking powder|baking soda|yeast|sugar|brown sugar|vanilla|cocoa/i.test(name)) {
            return 'Baking';
        }
        if (/juice|soda|coffee|tea|water|drink|beverage|smoothie/i.test(name)) {
            return 'Beverages';
        }
        if (/canned|can of|tinned/i.test(name)) {
            return 'Canned';
        }
        if (/jar|jarred|pickled|preserved/i.test(name)) {
            return 'Jarred';
        }
        if (/sauce|ketchup|mayo|mustard|soy sauce|vinegar|patis|toyo|condiment/i.test(name)) {
            return 'Condiments';
        }
        if (/gravy|salsa|dressing|marinade/i.test(name)) {
            return 'Sauces';
        }
        if (/milk|cheese|yogurt|butter|cream|dairy/i.test(name)) {
            return 'Dairy';
        }
        if (/egg|itlog/i.test(name)) {
            return 'Eggs';
        }
        if (/apple|banana|orange|grape|strawberry|mango|pineapple|watermelon|kiwi|berry|fruit/i.test(name)) {
            return 'Fruits';
        }
        if (/frozen|freezer/i.test(name)) {
            return 'Frozen';
        }
        if (/grain|wheat|oat|barley|quinoa|cereal/i.test(name)) {
            return 'Grains';
        }
        if (/pasta|spaghetti|macaroni|penne|linguine/i.test(name)) {
            return 'Pasta';
        }
        if (/noodle|ramen|udon|soba|pancit canton|misua/i.test(name)) {
            return 'Noodles';
        }
        if (/beef|pork|lamb|steak|ground meat|bacon|ham|meat/i.test(name)) {
            return 'Meat';
        }
        if (/chicken|poultry|duck|turkey/i.test(name)) {
            return 'Poultry';
        }
        if (/fish|salmon|tuna|tilapia|bangus|shrimp|prawn|crab|seafood|shellfish/i.test(name)) {
            return 'Seafood';
        }
        if (/chip|cookie|candy|chocolate|snack|cracker|chips/i.test(name)) {
            return 'Snacks';
        }
        if (/spice|pepper|salt|garlic powder|paprika|cumin|cinnamon/i.test(name)) {
            return 'Spices';
        }
        if (/basil|oregano|thyme|rosemary|cilantro|parsley|herb/i.test(name)) {
            return 'Herbs';
        }
        if (/carrot|tomato|potato|onion|lettuce|cabbage|spinach|broccoli|pepper|cucumber|vegetable/i.test(name)) {
            return 'Vegetables';
        }

        return 'Other';
    };

    // Helper function to estimate expiry date
    const estimateExpiryDate = (category) => {
        const now = new Date();
        const expiryDays = {
            // Cooked/Prepared
            'Leftovers': 3,
            'Rice': 2,
            'Soup': 3,
            'Kakanin': 3,
            // Raw Ingredients
            'Baking': 180,
            'Beverages': 90,
            'Canned': 365,
            'Jarred': 180,
            'Condiments': 180,
            'Sauces': 90,
            'Dairy': 7,
            'Eggs': 21,
            'Fruits': 7,
            'Frozen': 90,
            'Grains': 180,
            'Pasta': 365,
            'Noodles': 180,
            'Meat': 3,
            'Poultry': 3,
            'Seafood': 2,
            'Snacks': 60,
            'Spices': 365,
            'Herbs': 7,
            'Vegetables': 7,
            'Other': 14
        };

        const days = expiryDays[category] || 14;
        now.setDate(now.getDate() + days);
        return now.toISOString();
    };

    // Add item to Supabase
    const addItemToInventory = async (itemName, metadata = {}) => {
        try {
            // Get current user
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError || !user) {
                Alert.alert('Error', 'You must be logged in to add items');
                return false;
            }

            // Get user's first inventory
            const { data: inventories, error: invError } = await supabase
                .from('inventories')
                .select('*')
                .eq('userID', user.id)
                .order('createdAt', { ascending: true })
                .limit(1);

            if (invError) {
                console.error('Inventory error:', invError);
                Alert.alert('Error', 'Failed to fetch inventory');
                return false;
            }

            let inventoryID;

            if (!inventories || inventories.length === 0) {
                // Create default inventory if none exists
                const { data: newInventory, error: createError } = await supabase
                    .from('inventories')
                    .insert({
                        userID: user.id,
                        inventoryColor: '#8BC34A',
                        maxItems: 100,
                        inventoryTags: { name: 'My Pantry' }
                    })
                    .select()
                    .single();

                if (createError) {
                    console.error('Create inventory error:', createError);
                    Alert.alert('Error', 'Failed to create inventory');
                    return false;
                }
                inventoryID = newInventory.inventoryID;
            } else {
                inventoryID = inventories[0].inventoryID;
            }

            // Determine category and expiry
            const category = determineFoodCategory(itemName);
            const expiryDate = estimateExpiryDate(category);

            // Insert the pantry item
            const { data: newItem, error: itemError } = await supabase
                .from('pantry_items')
                .insert({
                    inventoryID,
                    itemName,
                    category,
                    quantity: 1,
                    unit: 'pcs',
                    expiryDate,
                    itemTags: {
                        scannedAt: new Date().toISOString(),
                        ...metadata
                    }
                })
                .select()
                .single();

            if (itemError) {
                console.error('Item insert error:', itemError);
                Alert.alert('Error', `Failed to add item: ${itemError.message}`);
                return false;
            }

            // Update inventory count
            const { error: updateError } = await supabase
                .from('inventories')
                .update({
                    itemCount: inventories[0].itemCount + 1,
                    updatedAt: new Date().toISOString()
                })
                .eq('inventoryID', inventoryID);

            if (updateError) {
                console.warn('Count update error:', updateError);
            }

            return true;

        } catch (error) {
            console.error('Add to inventory error:', error);
            Alert.alert('Error', 'Failed to add item to pantry');
            return false;
        }
    };

    const pickImage = async (useCamera = false) => {
        // Close modal before opening camera/gallery
        hideUploadModal();

        const permissionMethod = useCamera
            ? ImagePicker.requestCameraPermissionsAsync
            : ImagePicker.requestMediaLibraryPermissionsAsync;

        const { status } = await permissionMethod();

        if (status !== 'granted') {
            Alert.alert(
                'Permission Required',
                `Please allow ${useCamera ? 'camera' : 'photo library'} access to continue.`
            );
            return;
        }

        const result = useCamera
            ? await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 0.8,
            })
            : await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 0.8,
            });

        if (!result.canceled && result.assets[0]) {
            const selectedUri = result.assets[0].uri;
            console.log('✅ Selected image URI:', selectedUri);

            router.push({
                pathname: '/food-recognition/result',
                params: { uri: selectedUri },
            });
        }
    };

    const handleFoodFound = async (food) => {
        console.log('Food found:', food);

        const foodName = food.food_name || 'Unknown Food';

        Alert.alert(
            'Food Found!',
            `${foodName}\n\nAdd to your pantry?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Add to Pantry',
                    onPress: async () => {
                        const success = await addItemToInventory(foodName, {
                            source: 'scanner',
                            ...food
                        });
                        if (success) {
                            Alert.alert('Success', 'Item added to pantry');
                        }
                    }
                }
            ]
        );
    };

    // --- Render Logic ---

    if (!isUploadModalVisible && fadeAnim._value === 0) return null;

    const RenderOption = ({ icon, title, sub, index, onPress, color }) => {
        const scaleAnim = useRef(new Animated.Value(1)).current;

        const handlePressIn = () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            Animated.spring(scaleAnim, {
                toValue: 0.95,
                useNativeDriver: true,
                speed: 20,
                bounciness: 10,
            }).start();
        };

        const handlePressOut = () => {
            Animated.spring(scaleAnim, {
                toValue: 1,
                useNativeDriver: true,
                speed: 20,
                bounciness: 10,
            }).start();
        };

        return (
            <Animated.View style={[
                styles.optionContainer,
                {
                    opacity: itemAnims[index],
                    transform: [
                        {
                            translateY: itemAnims[index].interpolate({
                                inputRange: [0, 1],
                                outputRange: [50, 0]
                            })
                        },
                        { scale: itemAnims[index] }
                    ]
                }
            ]}>
                <TouchableWithoutFeedback
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                    onPress={onPress}
                >
                    <Animated.View style={[
                        styles.barButton,
                        { transform: [{ scale: scaleAnim }] }
                    ]}>
                        <View style={[styles.iconBox, { backgroundColor: color + '20' }]}>
                            <Ionicons name={icon} size={wp('6%')} color={color} />
                        </View>
                        <View style={styles.textContainer}>
                            <Text style={styles.title}>{title}</Text>
                            <Text style={styles.subtitle}>{sub}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={wp('5%')} color="#C6C6C6" />
                    </Animated.View>
                </TouchableWithoutFeedback>
            </Animated.View>
        );
    };

    return (
        <View style={styles.modalContainer} pointerEvents="box-none">
            <TouchableWithoutFeedback onPress={hideUploadModal}>
                <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />
            </TouchableWithoutFeedback>

            <View style={styles.contentContainer} pointerEvents="box-none">
                <RenderOption
                    index={4}
                    title="Take Photo"
                    sub="Use camera to identify food"
                    icon="camera"
                    color="#FF6B6B"
                    onPress={() => pickImage(true)}
                />
                <RenderOption
                    index={3}
                    title="Upload from Gallery"
                    sub="Choose existing photo"
                    icon="images"
                    color="#4ECDC4"
                    onPress={() => pickImage(false)}
                />
                <RenderOption
                    index={2}
                    title="Scan Barcode"
                    sub="Scan product barcode"
                    icon="barcode"
                    color="#45B7D1"
                    onPress={() => {
                        hideUploadModal();
                        setBarcodeScannerVisible(true);
                    }}
                />
                <RenderOption
                    index={1}
                    title="Scan QR Code"
                    sub="Scan QR code"
                    icon="qr-code"
                    color="#96CEB4"
                    onPress={() => {
                        hideUploadModal();
                        setQrScannerVisible(true);
                    }}
                />
                <RenderOption
                    index={0}
                    title="Text Scanner"
                    sub="Scan text from packaging"
                    icon="text"
                    color="#FFEEAD"
                    onPress={() => {
                        hideUploadModal();
                        setOcrVisible(true);
                    }}
                />

                {/* Spacer for Bottom Navbar Safe Area */}
                <View style={{ height: hp('16%') }} /> 
            </View>            {/* Scanner Modals */}
            <BarcodeScannerModal
                visible={barcodeScannerVisible}
                onClose={() => setBarcodeScannerVisible(false)}
                onScan={(data) => {
                    setBarcodeScannerVisible(false);
                    handleFoodFound({ food_name: data.data || 'Unknown Item' });
                }}
            />

            <QRScannerModal
                visible={qrScannerVisible}
                onClose={() => setQrScannerVisible(false)}
                onScan={(data) => {
                    setQrScannerVisible(false);
                    handleFoodFound({ food_name: data.data || 'Unknown Item' });
                }}
            />

            <OCRScannerModal
                visible={ocrVisible}
                onClose={() => setOcrVisible(false)}
                onTextRecognized={(text) => {
                    setOcrVisible(false);
                    // Simple heuristic: take first line or first few words
                    const foodName = text.split('\n')[0].substring(0, 30);
                    handleFoodFound({ food_name: foodName });
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    modalContainer: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 50,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 1,
    },
    contentContainer: {
        position: 'absolute',
        bottom: 0,
        width: '100%',
        zIndex: 2,
        paddingHorizontal: wp('5%'),
    },
    optionContainer: {
        marginBottom: hp('1.5%'),
    },
    barButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        borderRadius: wp('4%'),
        padding: wp('4%'),
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
    },
    iconBox: {
        width: wp('12%'),
        height: wp('12%'),
        borderRadius: wp('3%'),
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: wp('4%'),
    },
    textContainer: {
        flex: 1,
    },
    title: {
        fontSize: wp('4%'),
        fontWeight: '600',
        color: '#333',
        marginBottom: hp('0.5%'),
    },
    subtitle: {
        fontSize: wp('3%'),
        color: '#666',
    }
});

export default UploadModal;
