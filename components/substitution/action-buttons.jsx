import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

/**
 * Action Buttons Component
 * Reusable bottom action buttons for substitution flow
 */
const ActionButtons = ({ 
  primaryText = 'Continue',
  secondaryText = 'Cancel',
  onPressPrimary,
  onPressSecondary,
  primaryDisabled = false,
  loading = false
}) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.primaryButton, primaryDisabled && styles.buttonDisabled]}
        onPress={onPressPrimary}
        disabled={primaryDisabled || loading}
        activeOpacity={0.8}
      >
        <Text style={styles.primaryButtonText}>
          {loading ? 'Please wait...' : primaryText}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={onPressSecondary}
        disabled={loading}
        activeOpacity={0.8}
      >
        <Text style={styles.secondaryButtonText}>
          {secondaryText}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  primaryButton: {
    backgroundColor: '#6B9B6E',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDisabled: {
    backgroundColor: '#B0B0B0',
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#6B9B6E',
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#6B9B6E',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ActionButtons;
