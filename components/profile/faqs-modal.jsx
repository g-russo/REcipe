import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const FAQsModal = ({ visible, onClose }) => {
  const [expandedIndex, setExpandedIndex] = useState(null);

  const faqs = [
    {
      question: 'Is REcipe free to use?',
      answer: "Yes! REcipe is completely free to download and use with all core features included. There are no hidden fees, subscriptions, or in-app purchases. We believe everyone should have access to tools that help reduce food waste and make cooking easier.",
    },
    {
      question: "Why isn't REcipe on the Play Store or App Store?",
      answer: "REcipe is currently available exclusively through our website as we continue to develop and refine the app based on user feedback. This allows us to update faster and respond to our community's needs more efficiently. We're working towards official app store releases in the near future!",
    },
    {
      question: 'What permissions does the app require?',
      answer: 'REcipe requires camera access for food scanning and notification permissions for expiry alerts. Storage permission is needed to save scanned images. All permissions are optional but highly recommended for the best experience. We only request permissions that are essential for core functionality.',
    },
    {
      question: 'Is my data secure?',
      answer: "Absolutely! We use industry-standard encryption to protect your data. Your information is stored securely in our Supabase database with row-level security policies. We never share your data with third parties. Your privacy is our top priority, and you have full control over your information.",
    },
    {
      question: 'How accurate is the food recognition?',
      answer: "Our AI-powered food recognition has an accuracy rate of over 90% and continues to improve with each use. The system uses advanced machine learning models trained on thousands of food items. If the app doesn't recognize an item, you can easily add it manually or teach the AI by providing feedback.",
    },
    {
      question: 'Can I use REcipe offline?',
      answer: "While REcipe requires an internet connection for AI recipe generation and real-time updates, your pantry data is cached locally. You can view your stored items and recipes offline, but features like recipe search and food scanning require connectivity.",
    },
    {
      question: 'How do expiration notifications work?',
      answer: "REcipe sends you notifications when items in your pantry are approaching their expiration dates. You'll receive alerts 3 days before, 1 day before, and on the day of expiration. You can customize notification preferences in your settings to match your needs.",
    },
    {
      question: 'Can I share my pantry with family members?',
      answer: "Group sharing features are currently in development! Soon you'll be able to collaborate with family members on shared pantries, making household food management even easier. Stay tuned for updates!",
    },
    {
      question: 'What recipe sources does REcipe use?',
      answer: "REcipe combines multiple sources for the best recipe experience. We use the Edamam Recipe API for a vast library of verified recipes, plus our own AI-powered recipe generator that creates custom recipes based on your specific ingredients and preferences.",
    },
    {
      question: 'How can I provide feedback or report issues?',
      answer: "We love hearing from our users! You can reach out through the Help Center or email us directly at support@recipe-app.com. Your feedback helps us improve REcipe for everyone. We typically respond within 24-48 hours.",
    },
  ];

  const toggleExpand = (index) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={visible}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>FAQs</Text>
          <View style={styles.placeholderRight} />
        </View>

        {/* Subtitle */}
        <View style={styles.subtitleContainer}>
          <Text style={styles.subtitle}>Got questions? We've got answers!</Text>
        </View>

        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          {faqs.map((faq, index) => (
            <View key={index} style={styles.faqItem}>
              <TouchableOpacity
                style={styles.faqQuestion}
                onPress={() => toggleExpand(index)}
                activeOpacity={0.7}
              >
                <View style={styles.questionRow}>
                  <View style={styles.iconContainer}>
                    <Ionicons 
                      name="help-circle" 
                      size={24} 
                      color="#8BC34A" 
                    />
                  </View>
                  <Text style={styles.questionText}>{faq.question}</Text>
                </View>
                <Ionicons
                  name={expandedIndex === index ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#666"
                />
              </TouchableOpacity>
              
              {expandedIndex === index && (
                <View style={styles.faqAnswer}>
                  <Text style={styles.answerText}>{faq.answer}</Text>
                </View>
              )}
            </View>
          ))}

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Still have questions? Contact us at support@recipe-app.com
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholderRight: {
    width: 40,
  },
  subtitleContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#f9f9f9',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  iconContainer: {
    marginRight: 12,
  },
  questionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  faqAnswer: {
    paddingHorizontal: 20,
    paddingLeft: 56,
    paddingBottom: 16,
  },
  answerText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  footer: {
    padding: 20,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  footerText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});

export default FAQsModal;
