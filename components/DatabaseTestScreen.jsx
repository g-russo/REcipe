import React, { useState } from 'react'
import { View, Text, TouchableOpacity, Alert, StyleSheet, ScrollView } from 'react-native'
import { diagnoseDatabaseIssues, quickDatabaseCheck } from '../lib/databaseDiagnostic'

export default function DatabaseTestScreen() {
  const [testing, setTesting] = useState(false)
  const [results, setResults] = useState(null)

  const runQuickCheck = async () => {
    setTesting(true)
    try {
      const result = await quickDatabaseCheck()
      
      let message = result.message
      let title = 'Database Status'
      
      if (result.status === 'OK') {
        title = '✅ Database Ready'
      } else if (result.status === 'TABLES_MISSING') {
        title = '❌ Tables Missing'
        message += '\n\n📝 Solution: Run database/schema.sql in Supabase SQL Editor'
      } else if (result.status === 'SCHEMA_MISMATCH') {
        title = '❌ Schema Mismatch'  
        message += '\n\n📝 Solution: Run database/fix-schema.sql in Supabase SQL Editor'
      }
      
      Alert.alert(title, message)
    } catch (err) {
      Alert.alert('Error', err.message)
    }
    setTesting(false)
  }

  const runFullDiagnostic = async () => {
    setTesting(true)
    try {
      console.log('🔍 Running full database diagnostic...')
      const result = await diagnoseDatabaseIssues()
      setResults(result)
      
      if (result.errors.length === 0) {
        Alert.alert('✅ Database OK', 'All tests passed! Users will be saved to tbl_users.')
      } else {
        Alert.alert('❌ Issues Found', `${result.errors.length} issues detected. Check console for details.`)
      }
    } catch (err) {
      Alert.alert('Error', err.message)
    }
    setTesting(false)
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Database Test Panel</Text>
      <Text style={styles.subtitle}>
        Use this to check if users are being saved to tbl_users
      </Text>

      <TouchableOpacity 
        style={[styles.button, styles.primaryButton]} 
        onPress={runQuickCheck}
        disabled={testing}
      >
        <Text style={styles.buttonText}>
          {testing ? 'Checking...' : '🔍 Quick Database Check'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.button, styles.secondaryButton]} 
        onPress={runFullDiagnostic}
        disabled={testing}
      >
        <Text style={styles.buttonText}>
          {testing ? 'Running...' : '🧪 Full Diagnostic'}
        </Text>
      </TouchableOpacity>

      {results && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>Diagnostic Results:</Text>
          
          <View style={styles.resultItem}>
            <Text style={styles.resultLabel}>Tables Exist:</Text>
            <Text style={results.tablesExist ? styles.success : styles.error}>
              {results.tablesExist ? '✅ Yes' : '❌ No'}
            </Text>
          </View>
          
          <View style={styles.resultItem}>
            <Text style={styles.resultLabel}>Custom Users:</Text>
            <Text style={styles.resultValue}>{results.totalCustomUsers}</Text>
          </View>
          
          <View style={styles.resultItem}>
            <Text style={styles.resultLabel}>Errors:</Text>
            <Text style={results.errors.length === 0 ? styles.success : styles.error}>
              {results.errors.length === 0 ? '✅ None' : `❌ ${results.errors.length}`}
            </Text>
          </View>

          {results.errors.length > 0 && (
            <View style={styles.errorSection}>
              <Text style={styles.errorTitle}>Issues Found:</Text>
              {results.errors.map((error, index) => (
                <Text key={index} style={styles.errorText}>• {error}</Text>
              ))}
            </View>
          )}
        </View>
      )}

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>💡 Quick Fixes:</Text>
        <Text style={styles.infoText}>
          1. If tables are missing: Run database/schema.sql{'\n'}
          2. If schema mismatch: Run database/fix-schema.sql{'\n'}
          3. Both files are in your project folder{'\n'}
          4. Run them in Supabase Dashboard → SQL Editor
        </Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: '#666',
  },
  button: {
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    backgroundColor: '#34C759',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  resultsContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    marginTop: 20,
    marginBottom: 20,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  resultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  resultLabel: {
    fontSize: 16,
    color: '#333',
  },
  resultValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  success: {
    fontSize: 16,
    fontWeight: '600',
    color: '#34C759',
  },
  error: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
  },
  errorSection: {
    backgroundColor: '#FFF2F2',
    padding: 15,
    borderRadius: 8,
    marginTop: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF3B30',
    marginBottom: 10,
  },
  errorText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 5,
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
})
