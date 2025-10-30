import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RecipeCacheService from '../services/recipe-cache-service';

const { width } = Dimensions.get('window');

const ProductionCacheMonitor = () => {
  const [stats, setStats] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadStats();
    
    if (autoRefresh) {
      const interval = setInterval(loadStats, 10000); // Update every 10 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const loadStats = async () => {
    try {
      const productionStats = RecipeCacheService.getProductionStats();
      setStats(productionStats);
    } catch (error) {
      console.error('Failed to load production stats:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  const handleForceOptimization = async () => {
    Alert.alert(
      'Force Cache Optimization',
      'This will optimize cache performance. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Optimize',
          onPress: async () => {
            try {
              const newStats = await RecipeCacheService.forceOptimization();
              setStats(newStats);
              Alert.alert('Success', 'Cache optimization completed');
            } catch (error) {
              Alert.alert('Error', 'Cache optimization failed');
            }
          }
        }
      ]
    );
  };

  const handleEmergencyCleanup = () => {
    Alert.alert(
      'Emergency Cleanup',
      'This will clear non-essential caches to free memory. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Cleanup',
          style: 'destructive',
          onPress: async () => {
            try {
              const newStats = await RecipeCacheService.emergencyCleanup();
              setStats(newStats);
              Alert.alert('Success', 'Emergency cleanup completed');
            } catch (error) {
              Alert.alert('Error', 'Emergency cleanup failed');
            }
          }
        }
      ]
    );
  };

  const getHealthColor = (health) => {
    switch (health) {
      case 'EXCELLENT': return '#27ae60';
      case 'GOOD': return '#2ecc71';
      case 'WARNING': return '#f39c12';
      case 'CRITICAL': return '#e74c3c';
      default: return '#95a5a6';
    }
  };

  const getHealthIcon = (health) => {
    switch (health) {
      case 'EXCELLENT': return 'checkmark-circle';
      case 'GOOD': return 'checkmark';
      case 'WARNING': return 'warning';
      case 'CRITICAL': return 'alert-circle';
      default: return 'help-circle';
    }
  };

  const renderMetricCard = (title, value, icon, color = '#3498db', warning = false) => (
    <View style={[styles.metricCard, warning && styles.warningCard]}>
      <Ionicons name={icon} size={24} color={color} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricTitle}>{title}</Text>
    </View>
  );

  if (!stats) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading production stats...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🚀 Production Cache Monitor</Text>
        <TouchableOpacity onPress={() => setAutoRefresh(!autoRefresh)} style={styles.autoRefreshButton}>
          <Ionicons name={autoRefresh ? 'pause' : 'play'} size={20} color="#fff" />
          <Text style={styles.autoRefreshText}>
            {autoRefresh ? 'Auto' : 'Manual'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* System Health Overview */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>System Health</Text>
        <View style={[styles.healthCard, { backgroundColor: getHealthColor(stats.systemHealth) }]}>
          <Ionicons name={getHealthIcon(stats.systemHealth)} size={40} color="#fff" />
          <Text style={styles.healthStatus}>{stats.systemHealth}</Text>
        </View>
      </View>

      {/* Performance Metrics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Performance Metrics</Text>
        <View style={styles.metricsGrid}>
          {renderMetricCard(
            'Hit Rate', 
            stats.hitRate, 
            'trending-up', 
            parseFloat(stats.hitRate) > 80 ? '#27ae60' : '#e74c3c',
            parseFloat(stats.hitRate) < 70
          )}
          {renderMetricCard(
            'Response Time', 
            stats.avgResponseTime, 
            'time', 
            parseInt(stats.avgResponseTime) < 500 ? '#27ae60' : '#e74c3c',
            parseInt(stats.avgResponseTime) > 1000
          )}
          {renderMetricCard(
            'Memory Usage', 
            stats.memoryUsage, 
            'hardware-chip',
            stats.memoryWarning ? '#e74c3c' : '#27ae60',
            stats.memoryWarning
          )}
          {renderMetricCard(
            'Cache Age', 
            `${stats.cacheAgeHours}h`, 
            'calendar',
            stats.cacheExpired ? '#e74c3c' : '#27ae60',
            stats.cacheExpired
          )}
        </View>
      </View>

      {/* Cache Statistics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cache Statistics</Text>
        <View style={styles.statsContainer}>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Popular Recipes:</Text>
            <Text style={styles.statValue}>{stats.popularRecipesCount}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Search Cache:</Text>
            <Text style={styles.statValue}>{stats.searchCacheSize} / {stats.searchCacheLimit}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Similar Cache:</Text>
            <Text style={styles.statValue}>{stats.similarCacheSize} / {stats.similarCacheLimit}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Total Hits:</Text>
            <Text style={styles.statValue}>{stats.totalHits.toLocaleString()}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Total Misses:</Text>
            <Text style={styles.statValue}>{stats.totalMisses.toLocaleString()}</Text>
          </View>
        </View>
      </View>

      {/* API Usage */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>API Usage</Text>
        <View style={styles.statsContainer}>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Calls This Minute:</Text>
            <Text style={[styles.statValue, { color: stats.canMakeApiCall ? '#27ae60' : '#e74c3c' }]}>
              {stats.apiCallsThisMinute}
            </Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Monthly Limit:</Text>
            <Text style={styles.statValue}>{stats.monthlyLimit.toLocaleString()}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Can Make Call:</Text>
            <Text style={[styles.statValue, { color: stats.canMakeApiCall ? '#27ae60' : '#e74c3c' }]}>
              {stats.canMakeApiCall ? 'YES' : 'NO'}
            </Text>
          </View>
        </View>
      </View>

      {/* Background Operations */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Background Operations</Text>
        <View style={styles.statusContainer}>
          <View style={styles.statusItem}>
            <Ionicons 
              name={stats.backgroundPreloadActive ? 'checkmark-circle' : 'close-circle'} 
              size={20} 
              color={stats.backgroundPreloadActive ? '#27ae60' : '#95a5a6'} 
            />
            <Text style={styles.statusText}>Background Preloading</Text>
          </View>
          <View style={styles.statusItem}>
            <Ionicons 
              name={stats.cacheOptimizationActive ? 'checkmark-circle' : 'close-circle'} 
              size={20} 
              color={stats.cacheOptimizationActive ? '#27ae60' : '#95a5a6'} 
            />
            <Text style={styles.statusText}>Cache Optimization</Text>
          </View>
          <Text style={styles.lastOptimization}>
            Last Optimization: {new Date(stats.lastOptimization).toLocaleTimeString()}
          </Text>
        </View>
      </View>

      {/* Control Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Production Controls</Text>
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.controlButton, styles.refreshButton]} 
            onPress={handleRefresh}
            disabled={refreshing}
          >
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.buttonText}>Refresh Stats</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.controlButton, styles.optimizeButton]} 
            onPress={handleForceOptimization}
          >
            <Ionicons name="build" size={20} color="#fff" />
            <Text style={styles.buttonText}>Force Optimize</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.controlButton, styles.cleanupButton]} 
            onPress={handleEmergencyCleanup}
          >
            <Ionicons name="trash" size={20} color="#fff" />
            <Text style={styles.buttonText}>Emergency Cleanup</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#7f8c8d',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#2c3e50',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  autoRefreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3498db',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  autoRefreshText: {
    color: '#fff',
    marginLeft: 5,
    fontSize: 12,
  },
  section: {
    margin: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
  },
  healthCard: {
    alignItems: 'center',
    padding: 20,
    borderRadius: 10,
  },
  healthStatus: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 10,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricCard: {
    width: (width - 60) / 2,
    backgroundColor: '#ecf0f1',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginBottom: 10,
  },
  warningCard: {
    backgroundColor: '#fdedec',
    borderColor: '#e74c3c',
    borderWidth: 1,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginTop: 5,
  },
  metricTitle: {
    fontSize: 12,
    color: '#7f8c8d',
    textAlign: 'center',
    marginTop: 5,
  },
  statsContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 15,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  statLabel: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  statusContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 15,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statusText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#2c3e50',
  },
  lastOptimization: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 10,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    minWidth: 100,
    justifyContent: 'center',
  },
  refreshButton: {
    backgroundColor: '#3498db',
  },
  optimizeButton: {
    backgroundColor: '#27ae60',
  },
  cleanupButton: {
    backgroundColor: '#e74c3c',
  },
  buttonText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default ProductionCacheMonitor;