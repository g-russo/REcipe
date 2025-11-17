import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const TermsPoliciesModal = ({ visible, onClose }) => {
  const [activeTab, setActiveTab] = useState('terms');

  const sections = {
    terms: [
      {
        title: 'Acceptance of Terms',
        content: 'By downloading, installing, or using REcipe, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the application.',
      },
      {
        title: 'Use License',
        content: 'REcipe grants you a personal, non-exclusive, non-transferable, limited license to use the application for personal, non-commercial purposes. You may not modify, distribute, or reverse engineer the application.',
      },
      {
        title: 'User Accounts',
        content: 'You are responsible for maintaining the confidentiality of your account credentials. You agree to accept responsibility for all activities that occur under your account.',
      },
      {
        title: 'User Content',
        content: 'You retain ownership of any content you create or upload to REcipe, including pantry items, recipes, and images. By uploading content, you grant REcipe a license to use, store, and display this content.',
      },
      {
        title: 'Prohibited Activities',
        content: 'You may not use REcipe for any unlawful purpose, attempt to gain unauthorized access, or interfere with the proper functioning of the application.',
      },
      {
        title: 'Disclaimer of Warranties',
        content: 'REcipe is provided "as is" without warranties of any kind. We do not guarantee that the application will be error-free or uninterrupted.',
      },
      {
        title: 'Limitation of Liability',
        content: 'REcipe shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the application.',
      },
      {
        title: 'Changes to Terms',
        content: 'We reserve the right to modify these terms at any time. Continued use of the application constitutes acceptance of modified terms.',
      },
    ],
    privacy: [
      {
        title: 'Information We Collect',
        content: 'We collect information you provide directly, including email address, name, and pantry data. We also collect usage data to improve our services.',
      },
      {
        title: 'How We Use Your Information',
        content: 'Your information is used to provide and improve our services, send notifications, personalize your experience, and communicate with you about updates.',
      },
      {
        title: 'Data Storage and Security',
        content: 'Your data is stored securely using Supabase with industry-standard encryption. We implement appropriate technical and organizational measures to protect your information.',
      },
      {
        title: 'Third-Party Services',
        content: 'We use third-party services including Edamam API for recipes and OpenAI for AI features. These services have their own privacy policies.',
      },
      {
        title: 'Cookies and Tracking',
        content: 'We use local storage and cookies to maintain your session and preferences. We do not use tracking for advertising purposes.',
      },
      {
        title: 'Your Rights',
        content: 'You have the right to access, correct, or delete your personal data. You can export your data or request account deletion at any time.',
      },
      {
        title: 'Data Sharing',
        content: 'We do not sell your personal information to third parties. We only share data with service providers necessary to operate the application.',
      },
      {
        title: 'Children\'s Privacy',
        content: 'REcipe is not intended for children under 13. We do not knowingly collect information from children under 13.',
      },
      {
        title: 'Contact Us',
        content: 'For privacy-related questions or concerns, contact us at privacy@recipe-app.com.',
      },
    ],
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
          <Text style={styles.headerTitle}>Terms & Policies</Text>
          <View style={styles.placeholderRight} />
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'terms' && styles.activeTab]}
            onPress={() => setActiveTab('terms')}
          >
            <Text style={[styles.tabText, activeTab === 'terms' && styles.activeTabText]}>
              Terms of Service
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'privacy' && styles.activeTab]}
            onPress={() => setActiveTab('privacy')}
          >
            <Text style={[styles.tabText, activeTab === 'privacy' && styles.activeTabText]}>
              Privacy Policy
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <View style={styles.lastUpdated}>
              <Ionicons name="time-outline" size={16} color="#999" />
              <Text style={styles.lastUpdatedText}>
                Last updated: October 2025
              </Text>
            </View>

            {sections[activeTab].map((section, index) => (
              <View key={index} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.bulletPoint} />
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                </View>
                <Text style={styles.sectionContent}>{section.content}</Text>
              </View>
            ))}

            <View style={styles.footer}>
              <View style={styles.footerCard}>
                <Ionicons name="mail" size={24} color="#8BC34A" />
                <Text style={styles.footerTitle}>Questions?</Text>
                <Text style={styles.footerText}>
                  Contact us at recipe-app@gmail.com for any questions about our terms or policies.
                </Text>
              </View>
            </View>
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
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#8BC34A',
  },
  tabText: {
    fontSize: 14,
    color: '#999',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#8BC34A',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  lastUpdated: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 6,
  },
  lastUpdatedText: {
    fontSize: 12,
    color: '#999',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  bulletPoint: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#8BC34A',
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  sectionContent: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
    marginLeft: 16,
  },
  footer: {
    marginTop: 20,
    marginBottom: 40,
  },
  footerCard: {
    backgroundColor: '#F1F8E9',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  footerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginTop: 12,
    marginBottom: 8,
  },
  footerText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default TermsPoliciesModal;
