import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  SafeAreaView
} from 'react-native';
import EdamamService from '../services/edamamService';

const ApiTest = () => {
  const [testResult, setTestResult] = useState('');
  const [loading, setLoading] = useState(false);

  const testApiConnection = async () => {
    setLoading(true);
    setTestResult('Testing API connection...');

    try {
      console.log('🧪 Testing Edamam API connection...');
      
      // Test with a simple search
      const result = await EdamamService.searchRecipes('chicken', {
        from: 0,
        to: 5
      });

      if (result.success) {
        const recipes = result.data.recipes;
        setTestResult(`✅ API Test Successful!\n\nFound ${recipes.length} recipes:\n\n${recipes.map((recipe, index) => 
          `${index + 1}. ${recipe.label}\n   Source: ${recipe.source}\n   Calories: ${recipe.calories}\n`
        ).join('\n')}`);
        
        console.log('✅ API test successful!');
        Alert.alert('Success! 🎉', 'Edamam API is working correctly!');
      } else {
        setTestResult(`❌ API Test Failed!\n\nError: ${result.error}`);
        console.error('❌ API test failed:', result.error);
        Alert.alert('API Test Failed', result.error);
      }
    } catch (error) {
      const errorMsg = `❌ Connection Error!\n\nError: ${error.message}`;
      setTestResult(errorMsg);
      console.error('❌ API test error:', error);
      Alert.alert('Connection Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const testCredentials = () => {
    const appId = process.env.EXPO_PUBLIC_EDAMAM_APP_ID;
    const appKey = process.env.EXPO_PUBLIC_EDAMAM_APP_KEY;

    setTestResult(`🔑 API Credentials Check:\n\nApp ID: ${appId ? '✅ Set' : '❌ Missing'}\nApp Key: ${appKey ? '✅ Set' : '❌ Missing'}\n\nApp ID Value: ${appId || 'Not found'}\nApp Key Value: ${appKey ? appKey.substring(0, 8) + '...' : 'Not found'}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Edamam API Test</Text>
        <Text style={styles.subtitle}>Test your API connection</Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={styles.button} 
          onPress={testCredentials}
        >
          <Text style={styles.buttonText}>Check Credentials</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.primaryButton]} 
          onPress={testApiConnection}
          disabled={loading}
        >
          <Text style={[styles.buttonText, styles.primaryButtonText]}>
            {loading ? 'Testing...' : 'Test API Connection'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.resultContainer}>
        <Text style={styles.resultText}>
          {testResult || 'Click "Test API Connection" to verify your Edamam API setup.'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    marginTop: 5,
  },
  buttonContainer: {
    padding: 20,
    gap: 15,
  },
  button: {
    backgroundColor: '#ecf0f1',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#3498db',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
  },
  primaryButtonText: {
    color: '#fff',
  },
  resultContainer: {
    flex: 1,
    margin: 20,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  resultText: {
    fontSize: 14,
    color: '#2c3e50',
    fontFamily: 'monospace',
    lineHeight: 20,
  },
});

export default ApiTest;
