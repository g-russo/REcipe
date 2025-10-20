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
import { useCustomAuth } from '../../hooks/use-custom-auth';
import { router } from 'expo-router';
import AuthGuard from '../../components/AuthGuard';

const Home = () => {
  const { user, customUserData } = useCustomAuth();
  const [userName, setUserName] = useState('');
  const [greeting, setGreeting] = useState('Good Morning');

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

  const getGreetingIcon = () => {
    const hour = new Date().getHours();
    if (hour < 12) {
      // Morning - Sun icon
      return (
        <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#81A969" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
        <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#81A969" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
        <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#81A969" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
              <View style={styles.greetingRow}>
                {getGreetingIcon()}
                <Text style={styles.greeting}>{greeting}</Text>
              </View>
              <Text style={styles.userName}>{userName || 'User'}</Text>
            </View>
            <TouchableOpacity style={styles.notificationButton}>
              <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#81A969" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </Svg>
            </TouchableOpacity>
          </View>

          {/* Recipes from Your Pantry */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recipes from Your Pantry</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              style={styles.horizontalScroll}
              contentContainerStyle={styles.pantryScrollContent}
            >
              {pantryRecipes.map((recipe) => (
                <TouchableOpacity key={recipe.id} style={styles.pantryCard}>
                  <Image source={{ uri: recipe.image }} style={styles.pantryCardImage} />
                  <View style={styles.pantryCardOverlay}>
                    <Text style={styles.pantryCardTitle}>{recipe.title}</Text>
                    <View style={styles.pantryCardInfo}>
                      <Text style={styles.pantryCardCalories}>{recipe.calories} Kcal</Text>
                      <View style={styles.pantryCardTime}>
                        <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <Circle cx="12" cy="12" r="10" />
                          <Path d="M12 6v6l4 2" />
                        </Svg>
                        <Text style={styles.pantryCardTimeText}>{recipe.time} Min</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Make It Again */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Make It Again</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              style={styles.horizontalScroll}
              contentContainerStyle={styles.makeAgainScrollContent}
            >
              {makeItAgain.map((recipe) => (
                <TouchableOpacity key={recipe.id} style={styles.makeAgainCard}>
                  <Image source={{ uri: recipe.image }} style={styles.makeAgainImage} />
                  <View style={styles.makeAgainInfo}>
                    <Text style={styles.makeAgainTitle} numberOfLines={2}>{recipe.title}</Text>
                    <Text style={styles.makeAgainTime}>{recipe.time}</Text>
                  </View>
                  <View style={styles.makeAgainButton}>
                    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <Path d="M5 12h14" />
                      <Path d="m12 5 7 7-7 7" />
                    </Svg>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Try Something New */}
          <View style={[styles.section, { marginBottom: 120 }]}>
            <Text style={styles.sectionTitle}>Try Something New</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              style={styles.horizontalScroll}
              contentContainerStyle={styles.tryNewScrollContent}
            >
              {tryNewRecipes.map((recipe) => (
                <TouchableOpacity key={recipe.id} style={styles.tryNewCard}>
                  <View style={styles.tryNewImageContainer}>
                    <Image source={{ uri: recipe.image }} style={styles.tryNewImage} />
                    <TouchableOpacity style={styles.favoriteButton}>
                      <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <Path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                      </Svg>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.tryNewContent}>
                    <Text style={styles.tryNewTitle} numberOfLines={2}>{recipe.title}</Text>
                    <View style={styles.tryNewInfo}>
                      <View style={styles.tryNewInfoItem}>
                        <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <Path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                        </Svg>
                        <Text style={styles.tryNewInfoText}>{recipe.calories} Kcal</Text>
                      </View>
                      <Text style={styles.tryNewDivider}>•</Text>
                      <View style={styles.tryNewInfoItem}>
                        <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <Circle cx="12" cy="12" r="10" />
                          <Path d="M12 6v6l4 2" />
                        </Svg>
                        <Text style={styles.tryNewInfoText}>{recipe.time} Min</Text>
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
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 25,
  },
  headerLeft: {
    flex: 1,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 1,
    marginTop: 40,
  },
  greeting: {
    fontSize: 20,
    color: '#000',
    fontWeight: 'regular',
  },
  userName: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#000',
  },
  notificationButton: {
    padding: 8,
  },
  section: {
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    paddingHorizontal: 20,
    marginBottom: 0,
  },
  horizontalScroll: {
    paddingLeft: 20,
  },
  pantryScrollContent: {
    paddingVertical: 15,
    paddingRight: 20,
  },
  makeAgainScrollContent: {
    paddingVertical: 15,
    paddingRight: 20,
  },
  tryNewScrollContent: {
    paddingVertical: 15,
    paddingRight: 20,
  },
  // Pantry Cards
  pantryCard: {
    width: 280,
    height: 180,
    marginRight: 15,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
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
    height: 80,
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: 'rgba(129, 169, 105, 0.85)',
    justifyContent: 'space-between',
  },
  pantryCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  pantryCardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  pantryCardCalories: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '500',
  },
  pantryCardTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pantryCardTimeText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '500',
  },
  // Make It Again Cards
  makeAgainCard: {
    width: 280,
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 12,
    marginRight: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  makeAgainImage: {
    width: 70,
    height: 70,
    borderRadius: 12,
    resizeMode: 'cover',
  },
  makeAgainInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  makeAgainTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  makeAgainTime: {
    fontSize: 12,
    color: '#999',
  },
  makeAgainButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#81A969',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Try New Cards
  tryNewCard: {
    width: 230,
    backgroundColor: '#fff',
    borderRadius: 20,
    marginRight: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  tryNewImageContainer: {
    margin: 14,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  tryNewImage: {
    width: '100%',
    height: 160,
    resizeMode: 'cover',
  },
  favoriteButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#81A969',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tryNewContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 0,
  },
  tryNewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 12,
  },
  tryNewInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tryNewInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tryNewInfoText: {
    fontSize: 14,
    color: '#666',
  },
  tryNewDivider: {
    fontSize: 14,
    color: '#666',
    marginHorizontal: 10,
  },
});

export default Home;
