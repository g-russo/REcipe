import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SurveyService from '../services/survey-service';

const SurveyModal = ({ visible, survey, userEmail, onClose, onComplete }) => {
  const [answers, setAnswers] = useState({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  if (!survey || !survey.questions) return null;

  const questions = survey.questions;
  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  const handleAnswer = (questionId, value) => {
    setAnswers({
      ...answers,
      [questionId]: {
        type: currentQuestion.type,
        value,
      },
    });
  };

  const handleNext = () => {
    // Check if required question is answered
    if (currentQuestion.required && !answers[currentQuestion.id]) {
      Alert.alert('Required', 'Please answer this question to continue.');
      return;
    }

    if (isLastQuestion) {
      handleSubmit();
    } else {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSubmit = async () => {
    // Check all required questions are answered
    const unansweredRequired = questions.filter(
      (q) => q.required && !answers[q.id]
    );

    if (unansweredRequired.length > 0) {
      Alert.alert(
        'Incomplete',
        'Please answer all required questions before submitting.'
      );
      return;
    }

    setSubmitting(true);

    const result = await SurveyService.submitSurveyResponse(
      userEmail,
      survey.surveyID,
      answers
    );

    setSubmitting(false);

    if (result.success) {
      Alert.alert(
        'Thank You! 🎉',
        'Your feedback helps us improve REcipe for everyone.',
        [
          {
            text: 'Close',
            onPress: () => {
              onComplete && onComplete();
              onClose();
            },
          },
        ]
      );
    } else {
      Alert.alert('Error', 'Failed to submit survey. Please try again.');
    }
  };

  const handleDismiss = async () => {
    Alert.alert(
      'Skip Survey?',
      "We'll ask you again later.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Skip',
          onPress: async () => {
            await SurveyService.dismissSurvey(userEmail, survey.surveyID);
            onClose();
          },
        },
      ]
    );
  };

  const renderQuestion = () => {
    const answer = answers[currentQuestion.id];

    switch (currentQuestion.type) {
      case 'rating':
        return (
          <View style={styles.ratingContainer}>
            <Text style={styles.question}>
              {currentQuestion.question}
              {currentQuestion.required && <Text style={styles.required}> *</Text>}
            </Text>

            <View style={styles.ratingButtons}>
              {Array.from(
                { length: currentQuestion.options.max - currentQuestion.options.min + 1 },
                (_, i) => i + currentQuestion.options.min
              ).map((num) => (
                <TouchableOpacity
                  key={num}
                  style={[
                    styles.ratingButton,
                    answer?.value === num && styles.ratingButtonActive,
                  ]}
                  onPress={() => handleAnswer(currentQuestion.id, num)}
                >
                  <Text
                    style={[
                      styles.ratingButtonText,
                      answer?.value === num && styles.ratingButtonTextActive,
                    ]}
                  >
                    {num}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {currentQuestion.options.labels && (
              <View style={styles.ratingLabels}>
                <Text style={styles.ratingLabel}>
                  {currentQuestion.options.labels[currentQuestion.options.min]}
                </Text>
                <Text style={styles.ratingLabel}>
                  {currentQuestion.options.labels[currentQuestion.options.max]}
                </Text>
              </View>
            )}
          </View>
        );

      case 'multiple-choice':
        return (
          <View>
            <Text style={styles.question}>
              {currentQuestion.question}
              {currentQuestion.required && <Text style={styles.required}> *</Text>}
            </Text>

            {currentQuestion.options.map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.choiceButton,
                  answer?.value === option && styles.choiceButtonActive,
                ]}
                onPress={() => handleAnswer(currentQuestion.id, option)}
              >
                <View
                  style={[
                    styles.radio,
                    answer?.value === option && styles.radioActive,
                  ]}
                >
                  {answer?.value === option && <View style={styles.radioDot} />}
                </View>
                <Text
                  style={[
                    styles.choiceText,
                    answer?.value === option && styles.choiceTextActive,
                  ]}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        );

      case 'yes-no':
        return (
          <View>
            <Text style={styles.question}>
              {currentQuestion.question}
              {currentQuestion.required && <Text style={styles.required}> *</Text>}
            </Text>

            <View style={styles.yesNoContainer}>
              <TouchableOpacity
                style={[
                  styles.yesNoButton,
                  answer?.value === true && styles.yesNoButtonActive,
                ]}
                onPress={() => handleAnswer(currentQuestion.id, true)}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={24}
                  color={answer?.value === true ? '#fff' : '#4CAF50'}
                />
                <Text
                  style={[
                    styles.yesNoText,
                    answer?.value === true && styles.yesNoTextActive,
                  ]}
                >
                  Yes
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.yesNoButton,
                  answer?.value === false && styles.yesNoButtonActive,
                ]}
                onPress={() => handleAnswer(currentQuestion.id, false)}
              >
                <Ionicons
                  name="close-circle"
                  size={24}
                  color={answer?.value === false ? '#fff' : '#F44336'}
                />
                <Text
                  style={[
                    styles.yesNoText,
                    answer?.value === false && styles.yesNoTextActive,
                  ]}
                >
                  No
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 'text':
        return (
          <View>
            <Text style={styles.question}>
              {currentQuestion.question}
              {currentQuestion.required && <Text style={styles.required}> *</Text>}
            </Text>

            <TextInput
              style={styles.textInput}
              placeholder={currentQuestion.placeholder || 'Your answer...'}
              multiline
              numberOfLines={4}
              value={answer?.value || ''}
              onChangeText={(text) => handleAnswer(currentQuestion.id, text)}
              textAlignVertical="top"
            />
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text style={styles.title}>{survey.surveyTitle}</Text>
              <Text style={styles.description}>{survey.surveyDescription}</Text>
            </View>
            <TouchableOpacity onPress={handleDismiss} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Progress */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${((currentQuestionIndex + 1) / questions.length) * 100}%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              Question {currentQuestionIndex + 1} of {questions.length}
            </Text>
          </View>

          {/* Question */}
          <ScrollView style={styles.questionContainer} showsVerticalScrollIndicator={false}>
            {renderQuestion()}
          </ScrollView>

          {/* Navigation */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.navButton,
                currentQuestionIndex === 0 && styles.navButtonDisabled,
              ]}
              onPress={handlePrevious}
              disabled={currentQuestionIndex === 0}
            >
              <Ionicons
                name="arrow-back"
                size={20}
                color={currentQuestionIndex === 0 ? '#ccc' : '#4CAF50'}
              />
              <Text
                style={[
                  styles.navButtonText,
                  currentQuestionIndex === 0 && styles.navButtonTextDisabled,
                ]}
              >
                Previous
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.nextButton}
              onPress={handleNext}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.nextButtonText}>
                    {isLastQuestion ? 'Submit' : 'Next'}
                  </Text>
                  {!isLastQuestion && (
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                  )}
                </>
              )}
            </TouchableOpacity>
          </View>
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
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerContent: {
    flex: 1,
    marginRight: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  description: {
    fontSize: 14,
    color: '#666',
  },
  closeButton: {
    padding: 5,
  },
  progressContainer: {
    padding: 20,
    paddingBottom: 10,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  questionContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  question: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
    lineHeight: 24,
  },
  required: {
    color: '#F44336',
  },
  // Rating
  ratingContainer: {
    marginBottom: 20,
  },
  ratingButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  ratingButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingButtonActive: {
    borderColor: '#4CAF50',
    backgroundColor: '#4CAF50',
  },
  ratingButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
  },
  ratingButtonTextActive: {
    color: '#fff',
  },
  ratingLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ratingLabel: {
    fontSize: 12,
    color: '#999',
  },
  // Multiple Choice
  choiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 10,
  },
  choiceButtonActive: {
    borderColor: '#4CAF50',
    backgroundColor: '#f0f9f4',
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ccc',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioActive: {
    borderColor: '#4CAF50',
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
  },
  choiceText: {
    fontSize: 15,
    color: '#333',
  },
  choiceTextActive: {
    fontWeight: '600',
    color: '#4CAF50',
  },
  // Yes/No
  yesNoContainer: {
    flexDirection: 'row',
    gap: 15,
  },
  yesNoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    gap: 8,
  },
  yesNoButtonActive: {
    borderColor: '#4CAF50',
    backgroundColor: '#4CAF50',
  },
  yesNoText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  yesNoTextActive: {
    color: '#fff',
  },
  // Text Input
  textInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 15,
    fontSize: 15,
    color: '#333',
    minHeight: 100,
  },
  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 5,
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  navButtonText: {
    fontSize: 15,
    color: '#4CAF50',
    fontWeight: '600',
  },
  navButtonTextDisabled: {
    color: '#ccc',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    gap: 5,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default SurveyModal;
