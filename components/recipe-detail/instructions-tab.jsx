import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function InstructionsTab({ 
  instructions, 
  loading, 
  instructionsSource, 
  recipeUrl, 
  onOpenUrl 
}) {
  return (
    <View>
      <Text style={styles.sectionTitle}>Instructions</Text>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading instructions...</Text>
        </View>
      ) : (
        <View style={styles.instructionsContainer}>
          {/* Instructions Source Indicator */}
          {instructionsSource === 'ai' && (
            <View style={styles.sourceIndicator}>
              <Ionicons name="sparkles" size={16} color="#9C27B0" />
              <Text style={styles.sourceText}>AI-generated instructions by SousChef AI</Text>
            </View>
          )}
          {instructionsSource === 'scraped' && (
            <View style={styles.sourceIndicator}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.sourceText}>Instructions from original recipe.</Text>
            </View>
          )}
          {instructionsSource === 'cached' && (
            <View style={styles.sourceIndicator}>
              <Ionicons name="flash" size={16} color="#2196F3" />
              <Text style={styles.sourceText}>Instructions loaded instantly.</Text>
            </View>
          )}
          {instructionsSource === 'fallback' && (
            <View style={styles.sourceIndicator}>
              <Ionicons name="information-circle" size={16} color="#FF9800" />
              <Text style={styles.sourceText}>General cooking steps (visit original for details)</Text>
            </View>
          )}
          
          {instructions.map((instruction, index) => (
            <View key={index} style={styles.instructionStep}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{index + 1}</Text>
              </View>
              <Text style={styles.instructionText}>{instruction}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Only show View Original Recipe button for external recipes */}
      {recipeUrl && (
        <TouchableOpacity style={styles.viewRecipeButton} onPress={onOpenUrl}>
          <Text style={styles.viewRecipeText}>View Original Recipe</Text>
          <Ionicons name="arrow-forward" size={16} color="#81A969" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
  },
  instructionsContainer: {
    marginBottom: 20,
  },
  sourceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 8,
    borderRadius: 6,
    marginBottom: 15,
  },
  sourceText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 6,
    fontStyle: 'italic',
  },
  instructionStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 15,
    paddingRight: 10,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#81A969',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  stepNumberText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  viewRecipeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  viewRecipeText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
    flex: 1,
  },
});
