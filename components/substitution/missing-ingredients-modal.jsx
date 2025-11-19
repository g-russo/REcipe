import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';

/**
 * Missing Ingredients Modal
 * Shows a designed modal for missing/insufficient ingredients
 */
const MissingIngredientsModal = ({
  visible,
  onClose,
  onProceed,
  onSubstitute,
  missingIngredients = [],
  insufficientIngredients = [],
}) => {
  const hasMissing = missingIngredients.length > 0;
  const hasInsufficient = insufficientIngredients.length > 0;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.iconCircle}>
                  <Ionicons name="alert-circle" size={wp('10%')} color="#FF6B6B" />
                </View>
                <Text style={styles.title}>Missing Ingredients</Text>
                <Text style={styles.subtitle}>
                  Some ingredients are not available in your pantry
                </Text>
              </View>

              {/* Ingredients List */}
              <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
                {/* Missing Ingredients */}
                {hasMissing && (
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <Ionicons name="close-circle" size={wp('5%')} color="#FF6B6B" />
                      <Text style={styles.sectionTitle}>Not in Pantry</Text>
                    </View>
                    {missingIngredients.map((ing, index) => (
                      <View key={`missing-${index}`} style={styles.ingredientItem}>
                        <View style={styles.bulletPoint} />
                        <Text style={styles.ingredientText}>
                          {typeof ing === 'string' ? ing : (ing.text || ing)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Insufficient Ingredients */}
                {hasInsufficient && (
                  <View style={[styles.section, hasMissing && styles.sectionSpacing]}>
                    <View style={styles.sectionHeader}>
                      <Ionicons name="warning" size={wp('5%')} color="#FFA726" />
                      <Text style={styles.sectionTitle}>Insufficient Quantity</Text>
                    </View>
                    {insufficientIngredients.map((ing, index) => (
                      <View key={`insufficient-${index}`} style={styles.ingredientItem}>
                        <View style={[styles.bulletPoint, { backgroundColor: '#FFA726' }]} />
                        <View style={styles.insufficientContent}>
                          <Text style={styles.ingredientText}>
                            {typeof ing === 'string' ? ing : (ing.text || ing)}
                          </Text>
                          {ing.required && (
                            <Text style={styles.quantityText}>
                              Need: {ing.required} {ing.requiredUnit} • Have: {ing.available} {ing.availableUnit}
                            </Text>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>

              {/* Question */}
              <Text style={styles.question}>
                Would you like to substitute them with ingredients from your pantry?
              </Text>

              {/* Action Buttons */}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={onProceed}
                  activeOpacity={0.7}
                >
                  <Text style={styles.secondaryButtonText}>No, Proceed</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={onSubstitute}
                  activeOpacity={0.7}
                >
                  <Ionicons name="swap-horizontal" size={wp('5%')} color="#fff" />
                  <Text style={styles.primaryButtonText}>Yes, Substitute</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp('5%'),
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: wp('5%'),
    width: '100%',
    maxHeight: hp('75%'),
    padding: wp('6%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: hp('2%'),
  },
  iconCircle: {
    width: wp('20%'),
    height: wp('20%'),
    borderRadius: wp('10%'),
    backgroundColor: '#FFE5E5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp('1.5%'),
  },
  title: {
    fontSize: wp('5.5%'),
    fontWeight: 'bold',
    color: '#333',
    marginBottom: hp('0.5%'),
  },
  subtitle: {
    fontSize: wp('3.5%'),
    color: '#666',
    textAlign: 'center',
  },
  listContainer: {
    maxHeight: hp('35%'),
    marginBottom: hp('2%'),
  },
  section: {
    marginBottom: hp('1%'),
  },
  sectionSpacing: {
    marginTop: hp('2%'),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('1%'),
    gap: wp('2%'),
  },
  sectionTitle: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#333',
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: hp('1%'),
    paddingLeft: wp('2%'),
  },
  bulletPoint: {
    width: wp('2%'),
    height: wp('2%'),
    borderRadius: wp('1%'),
    backgroundColor: '#FF6B6B',
    marginTop: hp('0.8%'),
    marginRight: wp('3%'),
  },
  ingredientText: {
    fontSize: wp('3.8%'),
    color: '#444',
    lineHeight: wp('5.5%'),
    flex: 1,
  },
  insufficientContent: {
    flex: 1,
  },
  quantityText: {
    fontSize: wp('3.2%'),
    color: '#999',
    marginTop: hp('0.3%'),
  },
  question: {
    fontSize: wp('4%'),
    color: '#555',
    textAlign: 'center',
    marginBottom: hp('2.5%'),
    lineHeight: wp('5.5%'),
  },
  actions: {
    flexDirection: 'row',
    gap: wp('3%'),
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: hp('1.8%'),
    borderRadius: wp('3%'),
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#666',
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: hp('1.8%'),
    borderRadius: wp('3%'),
    backgroundColor: '#81A969',
    alignItems: 'center',
    justifyContent: 'center',
    gap: wp('2%'),
  },
  primaryButtonText: {
    fontSize: wp('4%'),
    fontWeight: 'bold',
    color: '#fff',
  },
});

export default MissingIngredientsModal;
