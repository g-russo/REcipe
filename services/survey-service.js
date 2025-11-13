import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import * as Linking from 'expo-linking';
import { Alert } from 'react-native';

const SURVEY_CHECK_KEY = 'last_survey_check';
const SURVEY_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // Check once per day
const GOOGLE_FORM_URL = 'https://forms.gle/f1paMobEx48C9G4S6';

class SurveyService {
  /**
   * Open Google Form in browser
   */
  static async openSurveyForm() {
    try {
      console.log('🔗 Opening survey form:', GOOGLE_FORM_URL);

      const canOpen = await Linking.canOpenURL(GOOGLE_FORM_URL);
      if (canOpen) {
        await Linking.openURL(GOOGLE_FORM_URL);
        return true;
      } else {
        Alert.alert('Error', 'Cannot open survey form. Please try again later.');
        return false;
      }
    } catch (error) {
      console.error('❌ Error opening survey form:', error);
      Alert.alert('Error', 'Failed to open survey. Please try again.');
      return false;
    }
  }

  /**
   * Show survey prompt and redirect to Google Form
   */
  static async showSurveyPrompt(userEmail, surveyTitle, surveyDescription) {
    return new Promise((resolve) => {
      Alert.alert(
        surveyTitle || '📋 Quick Survey',
        surveyDescription || 'Help us improve REcipe! We\'d love to hear your feedback.',
        [
          {
            text: 'Later',
            style: 'cancel',
            onPress: () => {
              console.log('⏭️ User dismissed survey');
              resolve({ action: 'dismissed' });
            },
          },
          {
            text: 'Take Survey',
            onPress: async () => {
              console.log('✅ User accepted survey');
              const opened = await this.openSurveyForm();
              if (opened) {
                resolve({ action: 'opened' });
              } else {
                resolve({ action: 'error' });
              }
            },
          },
        ],
        { cancelable: true }
      );
    });
  }

  /**
   * Get days since user signed up
   */
  static async getDaysSinceSignup(userEmail) {
    try {
      const { data, error } = await supabase
        .from('tbl_users')
        .select('created_at')
        .eq('email', userEmail)
        .single();

      if (error || !data) {
        console.warn('Could not get user signup date:', error);
        return 0;
      }

      const signupDate = new Date(data.created_at);
      const now = new Date();
      const daysDiff = Math.floor((now - signupDate) / (1000 * 60 * 60 * 24));

      return daysDiff;
    } catch (error) {
      console.error('Error calculating days since signup:', error);
      return 0;
    }
  }

  /**
   * Check if user has completed a survey
   */
  static async hasCompletedSurvey(userEmail, surveyID) {
    try {
      const { data, error } = await supabase
        .from('tbl_survey_responses')
        .select('responseID')
        .eq('userEmail', userEmail)
        .eq('surveyID', surveyID)
        .single();

      return !error && !!data;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get user's survey status
   */
  static async getSurveyStatus(userEmail, surveyID) {
    try {
      const { data, error } = await supabase
        .from('tbl_user_survey_status')
        .select('*')
        .eq('userEmail', userEmail)
        .eq('surveyID', surveyID)
        .single();

      if (error || !data) {
        return {
          showCount: 0,
          status: 'pending',
          lastShownAt: null,
        };
      }

      return data;
    } catch (error) {
      console.error('Error getting survey status:', error);
      return {
        showCount: 0,
        status: 'pending',
        lastShownAt: null,
      };
    }
  }

  /**
   * Update user's survey status
   */
  static async updateSurveyStatus(userEmail, surveyID, status, increment = false) {
    try {
      const existingStatus = await this.getSurveyStatus(userEmail, surveyID);

      const updateData = {
        userEmail,
        surveyID,
        status,
        updated_at: new Date().toISOString(),
      };

      if (status === 'shown') {
        updateData.lastShownAt = new Date().toISOString();
        updateData.showCount = increment ? (existingStatus.showCount || 0) + 1 : existingStatus.showCount || 1;
      } else if (status === 'dismissed') {
        updateData.dismissedAt = new Date().toISOString();
      } else if (status === 'completed') {
        updateData.completedAt = new Date().toISOString();
      }

      const { error } = await supabase
        .from('tbl_user_survey_status')
        .upsert(updateData, {
          onConflict: 'userEmail,surveyID',
        });

      if (error) {
        console.error('Error updating survey status:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error updating survey status:', error);
      return false;
    }
  }

  /**
   * Get pending survey for user (if any)
   */
  static async getPendingSurvey(userEmail) {
    try {
      const daysSinceSignup = await this.getDaysSinceSignup(userEmail);
      console.log(`👤 User has been active for ${daysSinceSignup} days`);

      // Get all active surveys
      const { data: surveys, error } = await supabase
        .from('tbl_surveys')
        .select('*')
        .eq('isActive', true)
        .lte('startDate', new Date().toISOString())
        .or(`endDate.is.null,endDate.gte.${new Date().toISOString()}`)
        .lte('showAfterDays', daysSinceSignup)
        .order('isPriority', { ascending: false })
        .order('surveyID', { ascending: true });

      if (error || !surveys || surveys.length === 0) {
        console.log('📋 No active surveys available');
        return null;
      }

      // Filter surveys user hasn't completed and hasn't exceeded show count
      for (const survey of surveys) {
        // Check if user completed this survey
        const hasCompleted = await this.hasCompletedSurvey(userEmail, survey.surveyID);
        if (hasCompleted) {
          console.log(`⏭️ Survey ${survey.surveyID} already completed`);
          continue;
        }

        // Check show count
        const status = await this.getSurveyStatus(userEmail, survey.surveyID);
        if (status.showCount >= survey.maxShowCount) {
          console.log(`⏭️ Survey ${survey.surveyID} reached max show count`);
          continue;
        }

        // Check if dismissed recently (don't show for 7 days after dismiss)
        if (status.status === 'dismissed' && status.dismissedAt) {
          const dismissedDate = new Date(status.dismissedAt);
          const daysSinceDismiss = Math.floor((Date.now() - dismissedDate) / (1000 * 60 * 60 * 24));
          if (daysSinceDismiss < 7) {
            console.log(`⏭️ Survey ${survey.surveyID} dismissed recently`);
            continue;
          }
        }

        console.log(`✅ Found pending survey: ${survey.surveyTitle}`);
        return survey;
      }

      console.log('📋 No pending surveys for this user');
      return null;
    } catch (error) {
      console.error('❌ Error getting pending survey:', error);
      return null;
    }
  }

  /**
   * Submit survey response
   */
  static async submitSurveyResponse(userEmail, surveyID, answers) {
    try {
      const appVersion = Application.nativeApplicationVersion;

      const { error } = await supabase.from('tbl_survey_responses').insert({
        surveyID,
        userEmail,
        answers,
        appVersion,
        completedAt: new Date().toISOString(),
      });

      if (error) {
        console.error('❌ Error submitting survey:', error);
        return { success: false, error: error.message };
      }

      // Update user survey status
      await this.updateSurveyStatus(userEmail, surveyID, 'completed');

      console.log('✅ Survey response submitted');
      return { success: true };
    } catch (error) {
      console.error('❌ Error submitting survey:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Dismiss survey (user clicked "Later")
   */
  static async dismissSurvey(userEmail, surveyID) {
    try {
      await this.updateSurveyStatus(userEmail, surveyID, 'dismissed');
      console.log('⏭️ Survey dismissed');
      return true;
    } catch (error) {
      console.error('Error dismissing survey:', error);
      return false;
    }
  }

  /**
   * Check if we should show survey (respects timing interval)
   */
  static async shouldCheckForSurvey() {
    try {
      const lastCheck = await AsyncStorage.getItem(SURVEY_CHECK_KEY);
      if (!lastCheck) return true;

      const timeSinceLastCheck = Date.now() - parseInt(lastCheck);
      return timeSinceLastCheck > SURVEY_CHECK_INTERVAL;
    } catch (error) {
      console.error('Error checking survey timing:', error);
      return true;
    }
  }

  /**
   * Check and show survey (call on app startup or after certain actions)
   */
  static async checkAndShowSurvey(userEmail, forceCheck = false) {
    try {
      if (!userEmail) {
        console.log('⏭️ No user email provided');
        return { shouldShow: false };
      }

      // Check if enough time has passed
      if (!forceCheck) {
        const shouldCheck = await this.shouldCheckForSurvey();
        if (!shouldCheck) {
          console.log('⏭️ Skipping survey check (checked recently)');
          return { shouldShow: false };
        }
      }

      // Update last check time
      await AsyncStorage.setItem(SURVEY_CHECK_KEY, Date.now().toString());

      console.log('🔍 Checking for pending surveys...');

      // Get pending survey
      const survey = await this.getPendingSurvey(userEmail);

      if (!survey) {
        return { shouldShow: false };
      }

      // Show survey prompt with Google Form redirect
      const result = await this.showSurveyPrompt(
        userEmail,
        survey.surveyTitle,
        survey.surveyDescription
      );

      if (result.action === 'opened') {
        // Mark as shown and completed (user opened the form)
        await this.updateSurveyStatus(userEmail, survey.surveyID, 'shown', true);
        // Optionally mark as completed since user opened the form
        // await this.updateSurveyStatus(userEmail, survey.surveyID, 'completed');
        
        console.log('📋 Survey form opened in browser');
        return { shouldShow: true, action: 'opened', survey };
      } else if (result.action === 'dismissed') {
        // User clicked "Later"
        await this.dismissSurvey(userEmail, survey.surveyID);
        return { shouldShow: true, action: 'dismissed', survey };
      }

      return { shouldShow: false };
    } catch (error) {
      console.error('❌ Error checking for survey:', error);
      return { shouldShow: false, error: error.message };
    }
  }

  /**
   * For testing: Reset survey check timer
   */
  static async resetSurveyCheckTimer() {
    await AsyncStorage.removeItem(SURVEY_CHECK_KEY);
    console.log('🗑️ Reset survey check timer');
  }

  /**
   * For testing: Clear all survey status for a user
   */
  static async clearUserSurveyStatus(userEmail) {
    try {
      const { error } = await supabase
        .from('tbl_user_survey_status')
        .delete()
        .eq('userEmail', userEmail);

      if (error) {
        console.error('Error clearing survey status:', error);
        return false;
      }

      console.log('🗑️ Cleared all survey status for user');
      return true;
    } catch (error) {
      console.error('Error clearing survey status:', error);
      return false;
    }
  }
}

export default SurveyService;
