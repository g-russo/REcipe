import { supabase } from '../lib/supabase';
import * as Application from 'expo-application';
import * as Linking from 'expo-linking';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const UPDATE_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // Check once per day
const LAST_CHECK_KEY = 'last_update_check';
const DISMISSED_VERSION_KEY = 'dismissed_update_version';

class AppUpdateService {
  /**
   * Get current app version from app.json
   */
  static getCurrentVersion() {
    // Get from expo-application (reads from app.json)
    const versionName = Application.nativeApplicationVersion; // e.g., "1.0.0"
    const versionCode = Application.nativeBuildVersion; // e.g., "1"

    return {
      versionName,
      versionCode: parseInt(versionCode) || 1,
    };
  }

  /**
   * Check if enough time has passed since last update check
   */
  static async shouldCheckForUpdate() {
    try {
      const lastCheck = await AsyncStorage.getItem(LAST_CHECK_KEY);
      if (!lastCheck) return true;

      const timeSinceLastCheck = Date.now() - parseInt(lastCheck);
      return timeSinceLastCheck > UPDATE_CHECK_INTERVAL;
    } catch (error) {
      console.error('Error checking update timing:', error);
      return true; // Check anyway if error
    }
  }

  /**
   * Check for app updates from Supabase
   */
  static async checkForUpdates(forceCheck = false) {
    try {
      // Only check if enough time has passed (unless forced)
      if (!forceCheck) {
        const shouldCheck = await this.shouldCheckForUpdate();
        if (!shouldCheck) {
          console.log('⏭️ Skipping update check (checked recently)');
          return { hasUpdate: false };
        }
      }

      console.log('🔍 Checking for app updates...');

      const currentVersion = this.getCurrentVersion();
      console.log(`📱 Current version: ${currentVersion.versionName} (${currentVersion.versionCode})`);

      // Query latest version from Supabase
      const { data: latestVersion, error } = await supabase
        .from('tbl_app_versions')
        .select('*')
        .eq('isActive', true)
        .order('versionCode', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error('❌ Error checking for updates:', error);
        return { hasUpdate: false, error: error.message };
      }

      // Save last check time
      await AsyncStorage.setItem(LAST_CHECK_KEY, Date.now().toString());

      console.log(`🆕 Latest version: ${latestVersion.versionName} (${latestVersion.versionCode})`);

      // Compare versions
      if (latestVersion.versionCode > currentVersion.versionCode) {
        console.log('✅ Update available!');

        // Check if this version was dismissed
        const dismissedVersion = await AsyncStorage.getItem(DISMISSED_VERSION_KEY);
        const wasDismissed = dismissedVersion === latestVersion.versionCode.toString();

        return {
          hasUpdate: true,
          isForceUpdate: latestVersion.isForceUpdate,
          currentVersion: currentVersion.versionCode,
          latestVersion: latestVersion.versionCode,
          versionName: latestVersion.versionName,
          downloadUrl: latestVersion.downloadUrl,
          changelogTitle: latestVersion.changelogTitle,
          changelogDescription: latestVersion.changelogDescription,
          apkSizeMB: latestVersion.apkSizeMB,
          wasDismissed,
          minimumSupportedVersion: latestVersion.minimumSupportedVersion,
        };
      } else {
        console.log('✅ App is up to date');
        return { hasUpdate: false };
      }
    } catch (error) {
      console.error('❌ Update check failed:', error);
      return { hasUpdate: false, error: error.message };
    }
  }

  /**
   * Show update dialog to user
   */
  static async showUpdateDialog(updateInfo) {
    const {
      isForceUpdate,
      versionName,
      downloadUrl,
      changelogTitle,
      changelogDescription,
      apkSizeMB,
      latestVersion,
    } = updateInfo;

    const title = isForceUpdate ? '🚨 Update Required' : '🎉 New Version Available!';
    const message = `Version ${versionName} is now available!\n\n${changelogTitle}\n\n${changelogDescription}\n\nSize: ${apkSizeMB} MB`;

    if (isForceUpdate) {
      // Force update - no dismiss option
      Alert.alert(
        title,
        message,
        [
          {
            text: 'Update Now',
            onPress: () => this.downloadUpdate(downloadUrl),
          },
        ],
        { cancelable: false } // Can't dismiss
      );
    } else {
      // Optional update - can dismiss
      Alert.alert(
        title,
        message,
        [
          {
            text: 'Later',
            style: 'cancel',
            onPress: async () => {
              // Save dismissed version
              await AsyncStorage.setItem(DISMISSED_VERSION_KEY, latestVersion.toString());
              console.log('⏭️ User dismissed update');
            },
          },
          {
            text: 'Update Now',
            onPress: () => this.downloadUpdate(downloadUrl),
          },
        ],
        { cancelable: true }
      );
    }
  }

  /**
   * Open download URL in browser
   */
  static async downloadUpdate(downloadUrl) {
    try {
      console.log('🔗 Opening download URL:', downloadUrl);

      const canOpen = await Linking.canOpenURL(downloadUrl);
      if (canOpen) {
        await Linking.openURL(downloadUrl);
      } else {
        Alert.alert('Error', 'Cannot open download URL. Please visit our website manually.');
      }
    } catch (error) {
      console.error('❌ Error opening download URL:', error);
      Alert.alert('Error', 'Failed to open download page. Please try again.');
    }
  }

  /**
   * Check if current version is below minimum supported version
   */
  static async checkMinimumVersion() {
    try {
      const currentVersion = this.getCurrentVersion();

      const { data: latestVersion, error } = await supabase
        .from('tbl_app_versions')
        .select('minimumSupportedVersion, downloadUrl')
        .eq('isActive', true)
        .order('versionCode', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error('❌ Error checking minimum version:', error);
        return false;
      }

      if (
        latestVersion.minimumSupportedVersion &&
        currentVersion.versionCode < latestVersion.minimumSupportedVersion
      ) {
        console.log('🚨 App version below minimum supported version');

        Alert.alert(
          '🚨 Update Required',
          'Your app version is no longer supported. Please update to continue using REcipe.',
          [
            {
              text: 'Update Now',
              onPress: () => this.downloadUpdate(latestVersion.downloadUrl),
            },
          ],
          { cancelable: false }
        );

        return true; // Version blocked
      }

      return false; // Version OK
    } catch (error) {
      console.error('❌ Error checking minimum version:', error);
      return false;
    }
  }

  /**
   * Main function to run on app startup
   */
  static async checkAndNotifyUpdates(forceCheck = false) {
    try {
      // First, check if version is blocked
      const isBlocked = await this.checkMinimumVersion();

      if (isBlocked) {
        return { blocked: true };
      }

      // Then check for updates
      const updateInfo = await this.checkForUpdates(forceCheck);

      if (updateInfo.hasUpdate && !updateInfo.wasDismissed) {
        await this.showUpdateDialog(updateInfo);
        return { hasUpdate: true, updateInfo };
      }

      return { hasUpdate: false };
    } catch (error) {
      console.error('❌ Update notification failed:', error);
      return { error: error.message };
    }
  }

  /**
   * Clear dismissed version (for testing or forcing re-prompt)
   */
  static async clearDismissedVersion() {
    await AsyncStorage.removeItem(DISMISSED_VERSION_KEY);
    console.log('🗑️ Cleared dismissed version');
  }

  /**
   * Reset update check timer (for testing)
   */
  static async resetUpdateCheckTimer() {
    await AsyncStorage.removeItem(LAST_CHECK_KEY);
    console.log('🗑️ Reset update check timer');
  }
}

export default AppUpdateService;
