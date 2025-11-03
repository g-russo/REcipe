import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCustomAuth } from '../hooks/use-custom-auth';
import { useIngredientSubstitution } from '../hooks/use-ingredient-substitution';

/**
 * Cooking Steps Screen
 * Displays step-by-step cooking instructions
 * Handles ingredient usage confirmation at the end
 */
const CookingSteps = () => {
  const router = useRouter();
  const { recipeData, hasSubstitutions } = useLocalSearchParams();
  const { user, customUserData } = useCustomAuth();

  const [recipe, setRecipe] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);

  const {
    showIngredientUsageConfirmation,
  } = useIngredientSubstitution(recipe, customUserData?.userID);

  useEffect(() => {
    if (recipeData) {
      try {
        const parsedRecipe = JSON.parse(recipeData);
        setRecipe(parsedRecipe);
      } catch (error) {
        console.error('Error parsing recipe data:', error);
        Alert.alert('Error', 'Failed to load recipe');
        router.back();
      }
    }
  }, [recipeData]);

  const instructions = recipe?.instructions || [];
  const totalSteps = instructions.length;

  const handleNextStep = () => {
    if (currentStep < totalSteps - 1) {
      setCompletedSteps([...completedSteps, currentStep]);
      setCurrentStep(currentStep + 1);
    } else {
      // Last step completed
      handleCookingComplete();
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setCompletedSteps(completedSteps.filter(s => s !== currentStep - 1));
    }
  };

  const handleCookingComplete = () => {
    // Mark last step as completed
    setCompletedSteps([...completedSteps, currentStep]);

    // Show confirmation to subtract ingredients from pantry
    showIngredientUsageConfirmation(() => {
      // Navigate back to recipe detail
      router.back();
    });
  };

  const currentInstruction = instructions[currentStep];
  const instructionText = typeof currentInstruction === 'string' 
    ? currentInstruction 
    : currentInstruction?.instruction || '';

  if (!recipe) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{recipe.label}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Substitution Badge */}
      {hasSubstitutions === 'true' && (
        <View style={styles.substitutionBanner}>
          <Text style={styles.substitutionBannerText}>
            ✓ Using ingredient substitutions
          </Text>
        </View>
      )}

      {/* Step Counter */}
      <View style={styles.stepCounter}>
        <Text style={styles.stepCounterText}>
          Step {currentStep + 1} of {totalSteps}
        </Text>
      </View>

      {/* Instruction */}
      <ScrollView 
        style={styles.instructionContainer}
        contentContainerStyle={styles.instructionContent}
      >
        <Text style={styles.instructionText}>
          {instructionText}
        </Text>
      </ScrollView>

      {/* Progress Dots */}
      <View style={styles.progressDots}>
        {instructions.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index === currentStep && styles.dotActive,
              completedSteps.includes(index) && styles.dotCompleted,
            ]}
          />
        ))}
      </View>

      {/* Navigation Buttons */}
      <View style={styles.navigationButtons}>
        <TouchableOpacity
          style={[styles.navButton, styles.previousButton]}
          onPress={handlePreviousStep}
          disabled={currentStep === 0}
        >
          <Text style={[
            styles.navButtonText,
            currentStep === 0 && styles.navButtonTextDisabled
          ]}>
            Previous
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navButton, styles.nextButton]}
          onPress={handleNextStep}
        >
          <Text style={styles.navButtonText}>
            {currentStep === totalSteps - 1 ? 'Complete' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 20,
    color: '#666',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
    marginHorizontal: 12,
  },
  headerSpacer: {
    width: 36,
  },
  substitutionBanner: {
    backgroundColor: '#E8F5E9',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#C8E6C9',
  },
  substitutionBannerText: {
    color: '#2E7D32',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  stepCounter: {
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  stepCounterText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B9B6E',
    textAlign: 'center',
  },
  instructionContainer: {
    flex: 1,
  },
  instructionContent: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  instructionText: {
    fontSize: 18,
    lineHeight: 28,
    color: '#1A1A1A',
    textAlign: 'left',
  },
  progressDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
  },
  dotActive: {
    width: 24,
    backgroundColor: '#6B9B6E',
  },
  dotCompleted: {
    backgroundColor: '#A5D6A7',
  },
  navigationButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 12,
  },
  navButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  previousButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#6B9B6E',
  },
  nextButton: {
    backgroundColor: '#6B9B6E',
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  navButtonTextDisabled: {
    color: '#B0B0B0',
  },
});

export default CookingSteps;
