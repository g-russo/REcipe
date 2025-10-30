import { StyleSheet } from 'react-native';

export const globalStyles = StyleSheet.create({
  // Background gradient (simulated with solid green color)
  backgroundContainer: {
    flex: 1,
    backgroundColor: '#81A969', // Green color from Figma design
  },

  // Main content card
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    flex: 1,
    marginTop: '50%', // Adjust based on screen
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 20,
    elevation: 5,
  },

  // Welcome screen specific card
  welcomeCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    flex: 1,
    marginTop: '110%',
    paddingHorizontal: 24,
    paddingTop: 50,
    paddingBottom: 40,
    elevation: 5,
    overflow: 'hidden',
  },

  // Typography
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#2C3E50',
    marginBottom: 16,
    marginTop: 50,
  },

  subtitle: {
    fontSize: 16,
    color: '#7F8C8D',
    lineHeight: 24,
    marginBottom: 70,
  },

  // Input styles
  inputContainer: {
    marginBottom: 20,
  },

  inputLabel: {
    fontSize: 16,
    color: '#2C3E50',
    marginBottom: 8,
    fontWeight: '500',
  },

  input: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#2C3E50',
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },

  inputFocused: {
    borderColor: '#81A969',
    backgroundColor: '#FFFFFF',
  },

  // Primary button style
  primaryButton: {
    backgroundColor: '#81A969',
    borderRadius: 50,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Secondary button (text only)
  secondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },

  secondaryButtonText: {
    color: '#81A969',
    fontSize: 16,
    fontWeight: '500',
  },

  // Back button
  backButton: {
    position: 'absolute',
    top: 50,
    left: 24,
    width: 48,
    height: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },

  // Links and text
  linkText: {
    color: '#8DB896',
    fontSize: 16,
    textAlign: 'center',
  },

  grayText: {
    color: '#7F8C8D',
    fontSize: 16,
    textAlign: 'center',
  },

  // OTP specific styles
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 32,
    paddingHorizontal: 16,
  },

  otpBox: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
    borderWidth: 2,
    borderColor: '#E9ECEF',
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '600',
    color: '#2C3E50',
  },

  otpBoxFilled: {
    borderColor: '#81A969',
    backgroundColor: '#FFFFFF',
  },

  // Checkbox styles
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },

  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#81A969',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  checkboxChecked: {
    backgroundColor: '#81A969',
  },

  checkboxText: {
    fontSize: 14,
    color: '#2C3E50',
  },

  // Spacing utilities
  spacingLarge: {
    marginVertical: 24,
  },

  spacingMedium: {
    marginVertical: 16,
  },

  spacingSmall: {
    marginVertical: 8,
  },

  // Form specific
  formContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },

  formContent: {
    flex: 1,
  },

  formActions: {
    marginTop: 'auto',
    paddingTop: 20,
  },
});