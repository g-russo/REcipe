import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Image,
  StatusBar,
  Platform,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Animated
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path, Circle } from 'react-native-svg';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCustomAuth } from '../../hooks/use-custom-auth';
import { router, useFocusEffect } from 'expo-router';
import { useTabContext } from '../../contexts/tab-context';
import AuthGuard from '../../components/auth-guard';
import NotificationDatabaseService from '../../services/notification-database-service';
import RecipeHistoryService from '../../services/recipe-history-service';
import PantryService from '../../services/pantry-service';
import EdamamService from '../../services/edamam-service';
import SupabaseCacheService from '../../services/supabase-cache-service';
import RecipeMatcherService from '../../services/recipe-matcher-service';
import { supabase } from '../../lib/supabase';

const PANTRY_RECIPES_CACHE_PREFIX = 'pantry_recipes_cache_';
const PANTRY_CACHE_TTL_MS = 30 * 60 * 1000; // reuse cached pantry recipes for 30 minutes
const PANTRY_FORCE_REFRESH_COOLDOWN_MS = 45 * 1000; // throttle manual refreshes to avoid API rate limits
const DEFAULT_RECIPE_IMAGE = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&auto=format&fit=crop&q=60';

const buildPantrySignature = (items = []) =>
  items
    .map(item => {
      const name = (item.itemName || '').trim().toLowerCase();
      const expiration = item.itemExpiration ? String(item.itemExpiration) : '';
      const quantity = Number(item.quantity) || 0;
      return `${name}|${expiration}|${quantity}`;
    })
    .sort()
    .join('||');

const TryNewCard = ({ recipe, isFavorited, onToggleFavorite, onPress }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handleFavoritePress = (event) => {
    // Trigger fast spring animation
    scaleAnim.setValue(1);
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 2,
      tension: 200,
      velocity: 3,
      useNativeDriver: true,
    }).start();

    onToggleFavorite(event, recipe);
  };

  return (
    <TouchableOpacity
      style={[styles.tryNewCard, {
        borderRadius: wp('4.5%'),
        height: hp('32%'),
        padding: wp('3%'),
        elevation: 6
      }]}
      activeOpacity={0.92}
      onPress={onPress}
    >
      <View style={[styles.tryNewImageContainer, {
        borderRadius: wp('4%'),
        marginBottom: hp('1.2%')
      }]}>
        <Image source={{ uri: recipe.image }} style={[styles.tryNewImage, { height: hp('20%') }]} />
        <TouchableOpacity
          style={{
            position: 'absolute',
            top: wp('3%'),
            right: wp('3%'),
            zIndex: 10
          }}
          activeOpacity={0.8}
          onPress={handleFavoritePress}
        >
          <Animated.View style={[
            styles.favoriteButton,
            {
              position: 'relative',
              width: wp('10%'),
              height: wp('10%'),
              borderRadius: wp('5%'),
              transform: [{ scale: scaleAnim }]
            },
            isFavorited && styles.favoriteButtonActive
          ]}>
            <Svg width={wp('5%')} height={wp('5%')} viewBox="0 0 24 24" fill={isFavorited ? '#fff' : 'none'} stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <Path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
            </Svg>
          </Animated.View>
        </TouchableOpacity>
      </View>
      <View style={[styles.tryNewContent, { paddingHorizontal: wp('1%') }]}>
        <View style={styles.tryNewTextBlock}>
          <Text style={[styles.tryNewTitle, { fontSize: wp('4.2%') }]} numberOfLines={2}>
            {recipe.title}
          </Text>
        </View>
        <View style={styles.tryNewMetaRow}>
          <View style={[styles.tryNewInfoItem, { gap: wp('1.5%') }]}>
            <Svg width={wp('4%')} height={wp('4%')} viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <Path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
            </Svg>
            <Text style={[styles.tryNewInfoText, { fontSize: wp('3.5%') }]}>
              {recipe.calories ? `${recipe.calories} Kcal` : 'Calories TBD'}
            </Text>
          </View>
          <Text style={[styles.tryNewDivider, { fontSize: wp('3.5%'), marginHorizontal: wp('2.5%') }]}>
            •
          </Text>
          <View style={[styles.tryNewInfoItem, { gap: wp('1.5%') }]}>
            <Svg width={wp('4%')} height={wp('4%')} viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <Circle cx="12" cy="12" r="10" />
              <Path d="M12 6v6l4 2" />
            </Svg>
            <Text style={[styles.tryNewInfoText, { fontSize: wp('3.5%') }]}>
              {recipe.time ? `${recipe.time} Min` : 'Time TBD'}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const Home = () => {
  const { user, customUserData } = useCustomAuth();
  const { showUploadModal } = useTabContext();
  const [userName, setUserName] = useState('');
  const [greeting, setGreeting] = useState('Good Morning');
  const [unreadCount, setUnreadCount] = useState(0);
  const [makeItAgainRecipes, setMakeItAgainRecipes] = useState([]);
  const [pantryRecipes, setPantryRecipes] = useState([]);
  const [loadingPantryRecipes, setLoadingPantryRecipes] = useState(false);
  const [pantryRecipesError, setPantryRecipesError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [popularRecipes, setPopularRecipes] = useState([]);
  const [loadingPopularRecipes, setLoadingPopularRecipes] = useState(false);
  const [popularRecipesError, setPopularRecipesError] = useState('');
  const [favoritePopularUris, setFavoritePopularUris] = useState({});
  const [favoriteBusyMap, setFavoriteBusyMap] = useState({});
  const [hasPantryItems, setHasPantryItems] = useState(true);
  const [toastQueue, setToastQueue] = useState([]);

  const userId = customUserData?.userID;
  const scrollViewRef = useRef(null);
  const pantryRecipesRef = useRef(null);
  const makeItAgainRef = useRef(null);
  const toastIdCounter = useRef(0);
  const saveTimeoutMap = useRef({});
  const { subscribe } = useTabContext();

  // Handle tab press events (scroll to top and reset horizontal scrolls)
  useEffect(() => {
    const unsubscribe = subscribe((event) => {
      if (event.type === 'tabPress' && event.isAlreadyActive && event.route.includes('home')) {
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollTo({ y: 0, animated: true });
        }
        if (pantryRecipesRef.current) {
          pantryRecipesRef.current.scrollTo({ x: 0, animated: true });
        }
        if (makeItAgainRef.current) {
          makeItAgainRef.current.scrollTo({ x: 0, animated: true });
        }
      }
    });
    return unsubscribe;
  }, [subscribe]);

  useEffect(() => {
    if (customUserData?.userName) {
      setUserName(customUserData.userName);
    } else if (user?.email) {
      setUserName(user.email.split('@')[0]);
    }
  }, [user, customUserData]);

  useEffect(() => {
    const updateGreeting = () => {
      const hour = new Date().getHours();
      if (hour < 12) {
        setGreeting('Good Morning');
      } else if (hour < 18) {
        setGreeting('Good Afternoon');
      } else {
        setGreeting('Good Evening');
      }
    };
    updateGreeting();
    const interval = setInterval(updateGreeting, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  const loadFavoriteMap = useCallback(async () => {
    if (!userId) {
      setFavoritePopularUris({});
      return;
    }

    try {
      const { data, error } = await supabase
        .from('tbl_favorites')
        .select('edamamRecipeURI, aiRecipeID, isFavorited')
        .eq('userID', userId);

      if (error) {
        console.warn('Unable to preload favorites:', error.message);
        return;
      }

      const map = {};
      (data || []).forEach(item => {
        if (item.isFavorited === false) return;

        if (item.edamamRecipeURI) map[item.edamamRecipeURI] = true;
        if (item.aiRecipeID) map[item.aiRecipeID] = true;
      });

      setFavoritePopularUris(map);
    } catch (error) {
      console.error('Error loading favorites map:', error);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    loadFavoriteMap();

    const channel = supabase
      .channel(`public:tbl_favorites:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tbl_favorites',
          filter: `userID=eq.${userId}`,
        },
        () => {
          loadFavoriteMap();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, loadFavoriteMap]);

  // Load unread notification count
  useEffect(() => {
    const loadUnreadCount = async () => {
      if (!userId) {
        setUnreadCount(0);
        return;
      }

      const count = await NotificationDatabaseService.getUnreadCount(userId);
      setUnreadCount(count);
    };

    loadUnreadCount();

    if (!userId) {
      return;
    }

    // Subscribe to realtime updates
    const subscription = NotificationDatabaseService.subscribeToNotifications(
      userId,
      () => {
        loadUnreadCount(); // Reload count when new notification arrives
      }
    );

    return () => {
      subscription?.unsubscribe?.();
    };
  }, [userId]);

  // Refresh notification count and favorites when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      const refreshNotificationCount = async () => {
        if (!userId) {
          setUnreadCount(0);
          return;
        }

        const count = await NotificationDatabaseService.getUnreadCount(userId);
        setUnreadCount(count);
      };

      refreshNotificationCount();
      loadFavoriteMap();
    }, [userId, loadFavoriteMap])
  );

  // Load recipe history for "Make It Again" section
  const loadRecentHistory = useCallback(async () => {
    if (!userId) {
      setMakeItAgainRecipes([]);
      return;
    }

    const history = await RecipeHistoryService.getRecipeHistory(userId, 10);

    // Transform history data to match the expected format
    const transformedHistory = history.slice(0, 5).map((item) => {
      const recipe = item.recipeData;
      const isAI = !recipe?.uri && (recipe?.recipeID || recipe?.isCustom);

      // Calculate time ago
      const completedDate = new Date(item.completedAt);
      const now = new Date();
      const diffTime = Math.abs(now - completedDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let timeAgo;
      if (diffDays === 1) timeAgo = 'Today';
      else if (diffDays === 2) timeAgo = 'Yesterday';
      else if (diffDays <= 7) timeAgo = `${diffDays - 1} days ago`;
      else timeAgo = completedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      return {
        id: item.historyID,
        title: item.recipeName || recipe?.label || 'Untitled Recipe',
        time: timeAgo,
        image: isAI ? (recipe?.recipeImage || recipe?.image) : (recipe?.image || recipe?.recipeImage),
        historyData: item // Store full history data for navigation
      };
    });

    setMakeItAgainRecipes(transformedHistory);
  }, [userId]);

  useEffect(() => {
    loadRecentHistory();
  }, [loadRecentHistory]);

  // Load pantry-based recipe suggestions with caching to avoid repeated API hits
  const loadPantryRecipeSuggestions = useCallback(async (forceRefresh = false) => {
    if (!userId) {
      setPantryRecipes([]);
      setPantryRecipesError('');
      return;
    }

    setLoadingPantryRecipes(true);
    setPantryRecipesError('');

    const cacheKey = `${PANTRY_RECIPES_CACHE_PREFIX}${userId}`;

    try {
      const pantryItems = await PantryService.getUserItems(userId);
      const signature = buildPantrySignature(pantryItems || []);
      const hasItems = (pantryItems || []).some(item => !!item?.itemName?.trim());
      setHasPantryItems(hasItems);

      const cachedString = await AsyncStorage.getItem(cacheKey);
      const cached = cachedString ? JSON.parse(cachedString) : null;
      const now = Date.now();
      const hasMatchingSignature = cached?.signature === signature;
      const cacheTimestamp = cached?.timestamp || 0;
      const cacheAge = hasMatchingSignature ? now - cacheTimestamp : Number.POSITIVE_INFINITY;
      const cacheFresh = hasMatchingSignature && cacheAge < PANTRY_CACHE_TTL_MS;
      const refreshWithinCooldown = forceRefresh && hasMatchingSignature && cacheAge < PANTRY_FORCE_REFRESH_COOLDOWN_MS;

      if (forceRefresh && cached && hasMatchingSignature) {
        setPantryRecipes(cached.recipes || []);
        if (cached.errorMessage) {
          setPantryRecipesError(cached.errorMessage);
        }
        setLoadingPantryRecipes(false);
        return;
      }

      if (cacheFresh && (!forceRefresh || refreshWithinCooldown)) {
        setPantryRecipes(cached.recipes || []);
        if (cached.errorMessage) {
          setPantryRecipesError(cached.errorMessage);
        }
        setLoadingPantryRecipes(false);
        return;
      }

      const prioritizedItems = (pantryItems || [])
        .filter(item => item.itemName)
        .map(item => ({
          name: item.itemName.trim(),
          normalized: item.itemName.trim().toLowerCase(),
          expiration: item.itemExpiration ? new Date(item.itemExpiration) : null,
          quantity: Number(item.quantity) || 0
        }))
        .filter(item => item.name.length > 0)
        .sort((a, b) => {
          const timeA = a.expiration ? a.expiration.getTime() : Number.MAX_SAFE_INTEGER;
          const timeB = b.expiration ? b.expiration.getTime() : Number.MAX_SAFE_INTEGER;
          if (timeA !== timeB) return timeA - timeB;
          return b.quantity - a.quantity;
        });

      const seen = new Set();
      const focusItems = [];
      for (const item of prioritizedItems) {
        if (!seen.has(item.normalized)) {
          seen.add(item.normalized);
          focusItems.push(item);
        }
        if (focusItems.length === 3) break;
      }

      if (focusItems.length === 0) {
        const emptyMessage = 'Add pantry items to unlock tailored recipes.';
        setPantryRecipes([]);
        setPantryRecipesError(emptyMessage);
        await AsyncStorage.setItem(cacheKey, JSON.stringify({
          recipes: [],
          signature,
          errorMessage: emptyMessage,
          timestamp: Date.now()
        }));
        setLoadingPantryRecipes(false);
        return;
      }

      const recipeResponses = await Promise.allSettled(
        focusItems.map(item =>
          EdamamService.searchRecipes(item.name, { to: 6, curatedOnly: false })
        )
      );

      const compiledRecipes = [];

      recipeResponses.forEach((result, index) => {
        if (result.status !== 'fulfilled' || !result.value?.success) {
          console.warn('Pantry recipe search failed for', focusItems[index]?.name);
          return;
        }

        const recipes = result.value.data?.recipes || [];
        const firstNewRecipe = recipes.find(r => !compiledRecipes.some(existing => existing.recipeData?.uri === r.uri));

        if (firstNewRecipe) {
          const caloriesPerServing = firstNewRecipe.calories && firstNewRecipe.yield
            ? Math.round(firstNewRecipe.calories / firstNewRecipe.yield)
            : null;

          compiledRecipes.push({
            id: firstNewRecipe.id || firstNewRecipe.uri,
            title: firstNewRecipe.label,
            calories: caloriesPerServing,
            time: firstNewRecipe.totalTime || 30,
            image: firstNewRecipe.image,
            recipeData: firstNewRecipe,
            focusIngredient: focusItems[index].name
          });
        }
      });

      if (compiledRecipes.length === 0) {
        const noMatchMessage = 'No matching recipes found for your current pantry items.';
        setPantryRecipes([]);
        setPantryRecipesError(noMatchMessage);
        await AsyncStorage.setItem(cacheKey, JSON.stringify({
          recipes: [],
          signature,
          errorMessage: noMatchMessage,
          timestamp: Date.now()
        }));
        setLoadingPantryRecipes(false);
        return;
      }

      setPantryRecipes(compiledRecipes);
      await AsyncStorage.setItem(cacheKey, JSON.stringify({
        recipes: compiledRecipes,
        signature,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Error loading pantry recipes:', error);
      try {
        const cachedString = await AsyncStorage.getItem(cacheKey);
        if (cachedString) {
          const cached = JSON.parse(cachedString);
          setPantryRecipes(cached.recipes || []);
          if (cached.errorMessage) {
            setPantryRecipesError(cached.errorMessage);
          } else if (!cached.recipes?.length) {
            setPantryRecipesError('Unable to load pantry recipes right now.');
          }
        } else {
          setPantryRecipes([]);
          setPantryRecipesError('Unable to load pantry recipes right now.');
        }
      } catch (cacheError) {
        console.error('Error reading pantry recipe cache:', cacheError);
        setPantryRecipes([]);
        setPantryRecipesError('Unable to load pantry recipes right now.');
      }
    } finally {
      setLoadingPantryRecipes(false);
    }
  }, [userId]);

  const loadPopularRecipes = useCallback(async (forceRefresh = false) => {
    setLoadingPopularRecipes(true);
    setPopularRecipesError('');

    try {
      const result = await SupabaseCacheService.getPopularRecipes(forceRefresh);
      const recipeList = Array.isArray(result)
        ? result
        : result?.data?.recipes || [];

      if (!recipeList.length) {
        setPopularRecipes([]);
        setPopularRecipesError('No trending recipes available right now.');
        return;
      }

      const normalized = recipeList
        .filter(recipe => recipe?.label)
        .slice(0, 8)
        .map(recipe => {
          const caloriesPerServing = recipe.calories && recipe.yield
            ? Math.round(recipe.calories / Math.max(1, recipe.yield))
            : null;

          const image = recipe.image
            || recipe.images?.REGULAR?.url
            || recipe.images?.LARGE?.url
            || DEFAULT_RECIPE_IMAGE;

          return {
            id: recipe.id || recipe.uri || recipe.shareAs,
            title: recipe.label,
            calories: caloriesPerServing,
            time: recipe.totalTime || 30,
            source: recipe.source,
            image,
            recipeData: recipe
          };
        });

      setPopularRecipes(normalized);

      // ✅ Keep loading visible until recipes render (prevents flash of empty state)
      setTimeout(() => {
        setLoadingPopularRecipes(false);
        console.log('✅ Popular recipes loaded and rendered');
      }, 2000); // 2 seconds for smooth transition
    } catch (error) {
      console.error('Error loading popular recipes:', error);
      setPopularRecipes([]);
      setPopularRecipesError('Unable to load popular recipes right now.');
      setLoadingPopularRecipes(false); // Stop loading immediately on error
    }
  }, []);

  useEffect(() => {
    loadPantryRecipeSuggestions();
  }, [loadPantryRecipeSuggestions]);

  useEffect(() => {
    loadPopularRecipes();
  }, [loadPopularRecipes]);

  // Pull to refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      loadRecentHistory(),
      loadPantryRecipeSuggestions(true)
    ]);
    setRefreshing(false);
  }, [loadRecentHistory, loadPantryRecipeSuggestions]);

  const getGreetingIcon = () => {
    const hour = new Date().getHours();
    if (hour < 12) {
      // Morning - Sun icon
      return (
        <Svg width={wp('6%')} height={wp('6%')} viewBox="0 0 24 24" fill="none" stroke="#81A969" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <Circle cx="12" cy="12" r="4" />
          <Path d="M12 2v2" />
          <Path d="M12 20v2" />
          <Path d="m4.93 4.93 1.41 1.41" />
          <Path d="m17.66 17.66 1.41 1.41" />
          <Path d="M2 12h2" />
          <Path d="M20 12h2" />
          <Path d="m6.34 17.66-1.41 1.41" />
          <Path d="m19.07 4.93-1.41 1.41" />
        </Svg>
      );
    } else if (hour < 18) {
      // Afternoon - Sun with clouds (custom SVG)
      return (
        <Svg width={wp('6%')} height={wp('6%')} viewBox="0 0 24 24" fill="none" stroke="#81A969" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M12 2v2" />
          <Path d="M4.93 4.93l1.41 1.41" />
          <Path d="M20 12h2" />
          <Path d="M17.07 4.93l-1.41 1.41" />
          <Path d="M14.917 12.724a4 4 0 0 0-5.925-4.128" />
          <Path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6" />
        </Svg>
      );
    } else {
      // Evening - Moon icon
      return (
        <Svg width={wp('6%')} height={wp('6%')} viewBox="0 0 24 24" fill="none" stroke="#81A969" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </Svg>
      );
    }
  };

  const handleMakeItAgainPress = (recipe) => {
    // Navigate to recipe detail with the history data
    const historyData = recipe.historyData;
    const recipeData = historyData.recipeData;
    const isAI = !recipeData?.uri && (recipeData?.recipeID || recipeData?.isCustom);

    router.push({
      pathname: '/recipe-detail',
      params: {
        recipeData: JSON.stringify(recipeData),
        recipeSource: isAI ? 'ai' : 'edamam',
        fromHistory: 'true'
      }
    });
  };

  const handlePantryRecipePress = (recipeCard) => {
    if (!recipeCard?.recipeData) {
      return;
    }

    router.push({
      pathname: '/recipe-detail',
      params: {
        recipeData: JSON.stringify(recipeCard.recipeData),
        recipeSource: 'edamam',
        fromPantry: 'true'
      }
    });
  };

  const handlePopularRecipePress = (recipeCard) => {
    if (!recipeCard?.recipeData) {
      return;
    }

    router.push({
      pathname: '/recipe-detail',
      params: {
        recipeData: JSON.stringify(recipeCard.recipeData),
        recipeSource: 'edamam',
        fromPopular: 'true'
      }
    });
  };

  const showToastMessage = (message, isAdded) => {
    // Quickly fade out existing toasts when new toggle happens
    toastQueue.forEach(toast => {
      Animated.timing(toast.opacity, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }).start();
    });

    const toastId = toastIdCounter.current++;
    const newToast = {
      id: toastId,
      message,
      isAdded,
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(100),
    };

    setToastQueue(prev => [...prev, newToast]);

    // Animate in
    Animated.parallel([
      Animated.timing(newToast.opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(newToast.translateY, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto remove after delay
    setTimeout(() => {
      Animated.timing(newToast.opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setToastQueue(prev => prev.filter(t => t.id !== toastId));
      });
    }, 1500);
  };

  const handlePopularFavoriteToggle = async (event, recipeCard) => {
    event?.stopPropagation?.();

    if (!recipeCard?.recipeData?.uri) {
      return;
    }

    if (!user?.email) {
      Alert.alert('Sign in required', 'Please sign in to save recipes to your favorites.');
      return;
    }

    const recipeURI = recipeCard.recipeData.uri;

    // Clear any existing timeout for this recipe
    if (saveTimeoutMap.current[recipeURI]) {
      clearTimeout(saveTimeoutMap.current[recipeURI]);
      delete saveTimeoutMap.current[recipeURI];
    }

    // Trigger haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Determine new state
    const isCurrentlyFavorited = !!favoritePopularUris[recipeURI];
    const newFavoriteState = !isCurrentlyFavorited;

    // Optimistic update
    setFavoritePopularUris(prev => {
      const newMap = { ...prev };
      if (newFavoriteState) {
        newMap[recipeURI] = true;
      } else {
        delete newMap[recipeURI];
      }
      return newMap;
    });

    // Show toast immediately
    if (newFavoriteState) {
      showToastMessage('Recipe added to your favorites', true);
    } else {
      showToastMessage('Recipe removed from favorites', false);
    }

    // Wait 3 seconds before actually saving to database
    saveTimeoutMap.current[recipeURI] = setTimeout(async () => {
      try {
        if (newFavoriteState) {
          const result = await RecipeMatcherService.saveRecipe(user.email, recipeCard.recipeData);
          if (!result.success) {
            // Revert on failure
            setFavoritePopularUris(prev => {
              const newMap = { ...prev };
              delete newMap[recipeURI];
              return newMap;
            });
            Alert.alert('Error', result.error || 'Unable to save recipe to favorites.');
          }
        } else {
          const result = await RecipeMatcherService.unsaveRecipe(user.email, recipeCard.recipeData);
          if (!result.success) {
            // Revert on failure
            setFavoritePopularUris(prev => ({ ...prev, [recipeURI]: true }));
            Alert.alert('Error', result.error || 'Unable to remove favorite right now.');
          }
        }
      } catch (error) {
        console.error('Favorite toggle error:', error);
        // Revert on error
        setFavoritePopularUris(prev => {
          if (newFavoriteState) {
            const newMap = { ...prev };
            delete newMap[recipeURI];
            return newMap;
          } else {
            return { ...prev, [recipeURI]: true };
          }
        });
        Alert.alert('Error', error.message || 'Something went wrong.');
      } finally {
        delete saveTimeoutMap.current[recipeURI];
      }
    }, 3000);
  };

  return (
    <AuthGuard>
      <SafeAreaView style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#4CAF50']}
              tintColor="#4CAF50"
            />
          }
          ref={scrollViewRef}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.greetingRow, { gap: wp('1.5%'), marginBottom: hp('0.1%'), marginTop: hp('5%') }]}>
                {getGreetingIcon()}
                <Text style={[styles.greeting, { fontSize: wp('5%') }]}>
                  {greeting}
                </Text>
              </View>
              <Text style={[styles.userName, { fontSize: wp('7.5%') }]}>
                {userName || 'User'}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.notificationButton, { padding: wp('2%') }]}
              onPress={() => router.push('/notifications')}
            >
              <Svg width={wp('6%')} height={wp('6%')} viewBox="0 0 24 24" fill="none" stroke="#81A969" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </Svg>
              {unreadCount > 0 && (
                <View style={[styles.notificationBadge, {
                  top: wp('0.5%'),
                  right: wp('0.5%'),
                  borderRadius: wp('2.5%'),
                  minWidth: wp('4.5%'),
                  height: wp('4.5%'),
                  paddingHorizontal: wp('1%')
                }]}>
                  <Text style={[styles.notificationBadgeText, { fontSize: wp('2.5%') }]}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Recipes from Your Pantry */}
          <View style={[styles.section, { marginTop: hp('1.2%') }]}>
            <Text style={[styles.sectionTitle, { fontSize: wp('7%'), paddingHorizontal: wp('5%'), marginBottom: 0 }]}>
              Recipes from Your Pantry
            </Text>
            {loadingPantryRecipes ? (
              <View style={styles.pantryStatusContainer}>
                <ActivityIndicator size="small" color="#4CAF50" />
                <Text style={styles.pantryHelperText}>Scanning your pantry ingredients...</Text>
              </View>
            ) : pantryRecipes.length > 0 ? (
              <ScrollView
                ref={pantryRecipesRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={[styles.horizontalScroll, { paddingLeft: wp('5%') }]}
                contentContainerStyle={[styles.pantryScrollContent, { paddingVertical: hp('1.8%'), paddingRight: wp('5%') }]}
              >
                {pantryRecipes.map((recipe) => (
                  <TouchableOpacity
                    key={recipe.id}
                    style={[styles.pantryCard, {
                      width: wp('70%'),
                      height: hp('22%'),
                      marginRight: wp('3.8%'),
                      borderRadius: wp('5%'),
                      elevation: 8
                    }]}
                    onPress={() => handlePantryRecipePress(recipe)}
                  >
                    <Image source={{ uri: recipe.image }} style={styles.pantryCardImage} />
                    <View style={[styles.pantryCardOverlay, {
                      height: hp('10%'),
                      paddingHorizontal: wp('3.8%'),
                      paddingVertical: hp('1.5%')
                    }]}>
                      <Text style={[styles.pantryCardTitle, { fontSize: wp('4%') }]}>
                        {recipe.title}
                      </Text>
                      {recipe.focusIngredient && (
                        <Text style={[styles.pantryIngredientText, { fontSize: wp('3%') }]}>
                          Uses {recipe.focusIngredient}
                        </Text>
                      )}
                      <View style={[styles.pantryCardInfo, { gap: wp('3.8%') }]}>
                        <Text style={[styles.pantryCardCalories, { fontSize: wp('3.2%') }]}>
                          {recipe.calories ? `${recipe.calories} Kcal` : 'Kcal TBD'}
                        </Text>
                        <View style={[styles.pantryCardTime, { gap: wp('1%') }]}>
                          <Svg width={wp('4%')} height={wp('4%')} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <Circle cx="12" cy="12" r="10" />
                            <Path d="M12 6v6l4 2" />
                          </Svg>
                          <Text style={[styles.pantryCardTimeText, { fontSize: wp('3.2%') }]}>
                            {recipe.time ? `${recipe.time} Min` : 'Time TBD'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.pantryStatusContainer}>
                <Text style={styles.pantryHelperText}>
                  {pantryRecipesError || 'Add pantry items to unlock tailored recipes.'}
                </Text>
                {!hasPantryItems && (
                  <TouchableOpacity
                    style={[styles.startScanningButton, { marginTop: hp('1.2%'), paddingVertical: hp('1%'), paddingHorizontal: wp('5%'), borderRadius: wp('5%') }]}
                    onPress={() => showUploadModal()}
                  >
                    <Text style={[styles.startScanningButtonText, { fontSize: wp('4%') }]}>Start Scanning</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* Make It Again - Only show if there's history */}
          {makeItAgainRecipes.length > 0 && (
            <View style={[styles.section, { marginTop: hp('1.2%') }]}>
              <Text style={[styles.sectionTitle, { fontSize: wp('7%'), paddingHorizontal: wp('5%'), marginBottom: 0 }]}>
                Make It Again
              </Text>
              <ScrollView
                ref={makeItAgainRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={[styles.horizontalScroll, { paddingLeft: wp('5%') }]}
                contentContainerStyle={[styles.makeAgainScrollContent, { paddingVertical: hp('1.8%'), paddingRight: wp('5%') }]}
              >
                {makeItAgainRecipes.map((recipe) => (
                  <TouchableOpacity
                    key={recipe.id}
                    style={[styles.makeAgainCard, {
                      width: wp('70%'),
                      borderRadius: wp('3.8%'),
                      padding: wp('3%'),
                      marginRight: wp('3.8%'),
                      elevation: 8
                    }]}
                    onPress={() => handleMakeItAgainPress(recipe)}
                  >
                    <Image source={{ uri: recipe.image }} style={[styles.makeAgainImage, {
                      width: wp('17.5%'),
                      height: wp('17.5%'),
                      borderRadius: wp('3%')
                    }]} />
                    <View style={[styles.makeAgainInfo, {
                      marginLeft: wp('3%'),
                      marginRight: wp('2%')
                    }]}>
                      <Text style={[styles.makeAgainTitle, { fontSize: wp('3.5%'), marginBottom: hp('0.5%') }]} numberOfLines={2}>
                        {recipe.title}
                      </Text>
                      <Text style={[styles.makeAgainTime, { fontSize: wp('3%') }]}>
                        {recipe.time}
                      </Text>
                    </View>
                    <View style={[styles.makeAgainButton, {
                      width: wp('9%'),
                      height: wp('9%'),
                      borderRadius: wp('2%')
                    }]}>
                      <Svg width={wp('5%')} height={wp('5%')} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <Path d="M5 12h14" />
                        <Path d="m12 5 7 7-7 7" />
                      </Svg>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Try Something New */}
          <View style={[styles.section, { marginBottom: hp('15%'), marginTop: hp('1.2%') }]}>
            <Text style={[styles.sectionTitle, { fontSize: wp('7%'), paddingHorizontal: wp('5%'), marginBottom: 0 }]}>
              Try Something New
            </Text>
            {loadingPopularRecipes ? (
              <View style={styles.pantryStatusContainer}>
                <ActivityIndicator size="small" color="#4CAF50" />
                <Text style={styles.pantryHelperText}>Pulling trending recipes...</Text>
              </View>
            ) : popularRecipes.length > 0 ? (
              <View style={[styles.tryNewList, { paddingHorizontal: wp('5%'), paddingVertical: hp('1.8%'), gap: hp('1.5%') }]}>
                {popularRecipes.map((recipe) => {
                  const recipeURI = recipe.recipeData?.uri;
                  const isFavorited = recipeURI ? !!favoritePopularUris[recipeURI] : false;
                  const isBusy = recipeURI ? !!favoriteBusyMap[recipeURI] : false;

                  return (
                    <TryNewCard
                      key={recipe.id || recipeURI}
                      recipe={recipe}
                      isFavorited={isFavorited}
                      onToggleFavorite={handlePopularFavoriteToggle}
                      onPress={() => handlePopularRecipePress(recipe)}
                    />
                  );
                })}
              </View>
            ) : (
              <View style={styles.pantryStatusContainer}>
                <Text style={styles.pantryHelperText}>
                  {popularRecipesError || 'Trending recipes will appear here soon.'}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Toast Notifications */}
        {toastQueue.map((toast) => (
          <Animated.View
            key={toast.id}
            style={[
              styles.toastContainer,
              {
                opacity: toast.opacity,
                transform: [{ translateY: toast.translateY }],
              },
            ]}
          >
            <View style={[
              styles.toastContent,
              { borderLeftColor: toast.isAdded ? '#81A969' : '#e74c3c' }
            ]}>
              <Ionicons
                name={toast.isAdded ? "checkmark-circle" : "close-circle"}
                size={wp('5%')}
                color={toast.isAdded ? "#81A969" : "#e74c3c"}
              />
              <Text style={styles.toastText}>{toast.message}</Text>
            </View>
          </Animated.View>
        ))}
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
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: wp('5%'),
    paddingTop: hp('2%'),
    paddingBottom: hp('3.1%'),
  },
  headerLeft: {
    flex: 1,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greeting: {
    color: '#000',
    fontWeight: 'regular',
  },
  userName: {
    fontWeight: 'bold',
    color: '#000',
  },
  notificationButton: {
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  section: {
  },
  sectionTitle: {
    fontWeight: 'bold',
    color: '#000',
  },
  horizontalScroll: {
  },
  pantryScrollContent: {
  },
  makeAgainScrollContent: {
  },
  tryNewScrollContent: {
  },
  tryNewList: {
    width: '100%'
  },
  // Pantry Cards
  pantryCard: {
    overflow: 'hidden',
    position: 'relative',
  },
  pantryStatusContainer: {
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('2%'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  pantryHelperText: {
    marginTop: hp('1%'),
    fontSize: wp('3.5%'),
    color: '#666',
    textAlign: 'center',
  },
  startScanningButton: {
    backgroundColor: '#81A969',
    alignItems: 'center',
    justifyContent: 'center'
  },
  startScanningButtonText: {
    color: '#fff',
    fontWeight: '600'
  },
  pantryCardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  pantryCardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(129, 169, 105, 0.85)',
    justifyContent: 'space-between',
  },
  pantryIngredientText: {
    color: '#f0fff0',
    fontWeight: '500',
    marginTop: hp('0.3%'),
  },
  pantryCardTitle: {
    fontWeight: '600',
    color: '#fff',
  },
  pantryCardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pantryCardCalories: {
    color: '#fff',
    fontWeight: '500',
  },
  pantryCardTime: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pantryCardTimeText: {
    color: '#fff',
    fontWeight: '500',
  },
  // Make It Again Cards
  makeAgainCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  makeAgainImage: {
    resizeMode: 'cover',
  },
  makeAgainInfo: {
    flex: 1,
  },
  makeAgainTitle: {
    fontWeight: '600',
    color: '#000',
  },
  makeAgainTime: {
    color: '#999',
  },
  makeAgainButton: {
    backgroundColor: '#81A969',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Try New Cards
  tryNewCard: {
    backgroundColor: '#fff',
    width: '100%',
    alignSelf: 'center',
  },
  tryNewImageContainer: {
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  tryNewImage: {
    width: '100%',
    resizeMode: 'cover',
  },
  favoriteButton: {
    position: 'absolute',
    backgroundColor: '#81A969',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteButtonActive: {
    backgroundColor: '#FF6B6B',
  },
  tryNewContent: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: hp('0.5%')
  },
  tryNewTextBlock: {
    minHeight: hp('5.5%'),
    justifyContent: 'flex-start'
  },
  tryNewTitle: {
    fontWeight: 'bold',
    color: '#000',
    lineHeight: hp('2.6%')
  },
  tryNewMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: hp('1%')
  },
  tryNewInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tryNewInfoText: {
    color: '#666',
  },
  tryNewDivider: {
    color: '#666',
  },
  toastContainer: {
    position: 'absolute',
    bottom: hp('16%'),
    left: wp('5%'),
    right: wp('5%'),
    alignItems: 'center',
    zIndex: 2000,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.5%'),
    borderRadius: wp('3%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    borderLeftWidth: 4,
    minWidth: wp('80%'),
  },
  toastText: {
    marginLeft: wp('3%'),
    fontSize: wp('3.8%'),
    color: '#333',
    fontWeight: '500',
  },
});

export default Home;
