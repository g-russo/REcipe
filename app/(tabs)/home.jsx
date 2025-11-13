import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Image,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { useCustomAuth } from '../../hooks/use-custom-auth';
import { router } from 'expo-router';
import AuthGuard from '../../components/auth-guard';
import NotificationDatabaseService from '../../services/notification-database-service';

const Home = () => {
  const { user, customUserData } = useCustomAuth();
  const [userName, setUserName] = useState('');
  const [greeting, setGreeting] = useState('Good Morning');
  const [unreadCount, setUnreadCount] = useState(0);

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

  // Load unread notification count
  useEffect(() => {
    const loadUnreadCount = async () => {
      if (user?.userID) {
        const count = await NotificationDatabaseService.getUnreadCount(user.userID);
        setUnreadCount(count);
      }
    };

    loadUnreadCount();

    // Subscribe to realtime updates
    if (user?.userID) {
      const subscription = NotificationDatabaseService.subscribeToNotifications(
        user.userID,
        () => {
          loadUnreadCount(); // Reload count when new notification arrives
        }
      );

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user]);

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

  // Sample data for recipes
  const pantryRecipes = [
    {
      id: 1,
      title: 'Asian white noodle with extra seafood',
      calories: 100,
      time: 20,
      image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400',
    },
    {
      id: 2,
      title: 'Healthy Taco with fresh',
      calories: 85,
      time: 15,
      image: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=400',
    },
  ];

  const makeItAgain = [
    {
      id: 1,
      title: 'Blueberry with egg for breakfast',
      time: '2 days ago',
      image: 'https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=200',
    },
    {
      id: 2,
      title: 'Healthy burger special',
      time: '3 days ago',
      image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200',
    },
  ];

  const tryNewRecipes = [
    {
      id: 1,
      title: 'Healthy Taco Salad with fresh vegetable',
      calories: 120,
      time: 20,
      image: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=300',
    },
    {
      id: 2,
      title: 'Japanese-style Pancakes Recipe',
      calories: 65,
      time: 12,
      image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=300',
    },
  ];


  return (
    <AuthGuard>
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
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
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={[styles.horizontalScroll, { paddingLeft: wp('5%') }]}
              contentContainerStyle={[styles.pantryScrollContent, { paddingVertical: hp('1.8%'), paddingRight: wp('5%') }]}
            >
              {pantryRecipes.map((recipe) => (
                <TouchableOpacity key={recipe.id} style={[styles.pantryCard, {
                  width: wp('70%'),
                  height: hp('22%'),
                  marginRight: wp('3.8%'),
                  borderRadius: wp('5%'),
                  elevation: 8
                }]}>
                  <Image source={{ uri: recipe.image }} style={styles.pantryCardImage} />
                  <View style={[styles.pantryCardOverlay, {
                    height: hp('10%'),
                    paddingHorizontal: wp('3.8%'),
                    paddingVertical: hp('1.5%')
                  }]}>
                    <Text style={[styles.pantryCardTitle, { fontSize: wp('4%') }]}>
                      {recipe.title}
                    </Text>
                    <View style={[styles.pantryCardInfo, { gap: wp('3.8%') }]}>
                      <Text style={[styles.pantryCardCalories, { fontSize: wp('3.2%') }]}>
                        {recipe.calories} Kcal
                      </Text>
                      <View style={[styles.pantryCardTime, { gap: wp('1%') }]}>
                        <Svg width={wp('4%')} height={wp('4%')} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <Circle cx="12" cy="12" r="10" />
                          <Path d="M12 6v6l4 2" />
                        </Svg>
                        <Text style={[styles.pantryCardTimeText, { fontSize: wp('3.2%') }]}>
                          {recipe.time} Min
                        </Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Make It Again */}
          <View style={[styles.section, { marginTop: hp('1.2%') }]}>
            <Text style={[styles.sectionTitle, { fontSize: wp('7%'), paddingHorizontal: wp('5%'), marginBottom: 0 }]}>
              Make It Again
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={[styles.horizontalScroll, { paddingLeft: wp('5%') }]}
              contentContainerStyle={[styles.makeAgainScrollContent, { paddingVertical: hp('1.8%'), paddingRight: wp('5%') }]}
            >
              {makeItAgain.map((recipe) => (
                <TouchableOpacity key={recipe.id} style={[styles.makeAgainCard, {
                  width: wp('70%'),
                  borderRadius: wp('3.8%'),
                  padding: wp('3%'),
                  marginRight: wp('3.8%'),
                  elevation: 8
                }]}>
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

          {/* Try Something New */}
          <View style={[styles.section, { marginBottom: hp('15%'), marginTop: hp('1.2%') }]}>
            <Text style={[styles.sectionTitle, { fontSize: wp('7%'), paddingHorizontal: wp('5%'), marginBottom: 0 }]}>
              Try Something New
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={[styles.horizontalScroll, { paddingLeft: wp('5%') }]}
              contentContainerStyle={[styles.tryNewScrollContent, { paddingVertical: hp('1.8%'), paddingRight: wp('5%') }]}
            >
              {tryNewRecipes.map((recipe) => (
                <TouchableOpacity key={recipe.id} style={[styles.tryNewCard, {
                  width: wp('57.5%'),
                  borderRadius: wp('5%'),
                  marginRight: wp('3.8%'),
                  elevation: 6
                }]}>
                  <View style={[styles.tryNewImageContainer, {
                    margin: wp('3.5%'),
                    borderRadius: wp('4%')
                  }]}>
                    <Image source={{ uri: recipe.image }} style={[styles.tryNewImage, { height: hp('20%') }]} />
                    <TouchableOpacity style={[styles.favoriteButton, {
                      top: wp('3%'),
                      right: wp('3%'),
                      width: wp('10%'),
                      height: wp('10%'),
                      borderRadius: wp('5%')
                    }]}>
                      <Svg width={wp('5%')} height={wp('5%')} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <Path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                      </Svg>
                    </TouchableOpacity>
                  </View>
                  <View style={[styles.tryNewContent, {
                    paddingHorizontal: wp('4%'),
                    paddingBottom: wp('4%'),
                    paddingTop: 0
                  }]}>
                    <Text style={[styles.tryNewTitle, { fontSize: wp('4.5%'), marginBottom: hp('1.5%') }]} numberOfLines={2}>
                      {recipe.title}
                    </Text>
                    <View style={styles.tryNewInfo}>
                      <View style={[styles.tryNewInfoItem, { gap: wp('1.5%') }]}>
                        <Svg width={wp('4%')} height={wp('4%')} viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <Path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                        </Svg>
                        <Text style={[styles.tryNewInfoText, { fontSize: wp('3.5%') }]}>
                          {recipe.calories} Kcal
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
                          {recipe.time} Min
                        </Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </ScrollView>
      </SafeAreaView>
    </AuthGuard>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: wp('5%'),
    paddingTop: hp('3.8%'),
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
  // Pantry Cards
  pantryCard: {
    overflow: 'hidden',
    position: 'relative',
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
  },
  tryNewImageContainer: {
    overflow: 'hidden',
    position: 'relative',
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
  tryNewContent: {
  },
  tryNewTitle: {
    fontWeight: 'bold',
    color: '#000',
  },
  tryNewInfo: {
    flexDirection: 'row',
    alignItems: 'center',
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
});

export default Home;
