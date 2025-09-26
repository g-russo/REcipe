/**
 * Performance monitoring utilities for the REcipe app
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.isEnabled = __DEV__; // Only enable in development by default
  }

  /**
   * Start timing an operation
   */
  startTiming(operationName) {
    if (!this.isEnabled) return;
    
    this.metrics.set(operationName, {
      startTime: Date.now(),
      name: operationName
    });
  }

  /**
   * End timing and log results
   */
  endTiming(operationName) {
    if (!this.isEnabled) return;
    
    const metric = this.metrics.get(operationName);
    if (!metric) {
      console.warn(`⚠️ No timing started for operation: ${operationName}`);
      return;
    }

    const duration = Date.now() - metric.startTime;
    console.log(`⏱️ ${operationName}: ${duration}ms`);
    
    // Log slow operations
    if (duration > 1000) {
      console.warn(`🐌 Slow operation detected: ${operationName} took ${duration}ms`);
    }

    this.metrics.delete(operationName);
    return duration;
  }

  /**
   * Measure async operation
   */
  async measureAsync(operationName, asyncOperation) {
    this.startTiming(operationName);
    try {
      const result = await asyncOperation();
      this.endTiming(operationName);
      return result;
    } catch (error) {
      this.endTiming(operationName);
      console.error(`❌ ${operationName} failed:`, error);
      throw error;
    }
  }

  /**
   * Measure memory usage (development only)
   */
  logMemoryUsage(context = '') {
    if (!this.isEnabled || !global.performance) return;
    
    try {
      const memInfo = global.performance.memory;
      if (memInfo) {
        console.log(`🧠 Memory ${context}:`, {
          used: `${Math.round(memInfo.usedJSHeapSize / 1024 / 1024)}MB`,
          total: `${Math.round(memInfo.totalJSHeapSize / 1024 / 1024)}MB`,
          limit: `${Math.round(memInfo.jsHeapSizeLimit / 1024 / 1024)}MB`
        });
      }
    } catch (error) {
      // Memory API not available
    }
  }

  /**
   * Enable/disable monitoring
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
  }

  /**
   * Get all active timings
   */
  getActiveTimings() {
    return Array.from(this.metrics.entries()).map(([name, metric]) => ({
      name,
      duration: Date.now() - metric.startTime
    }));
  }
}

// Export singleton instance
export default new PerformanceMonitor();

/**
 * Higher-order component for measuring component render times
 */
export const withPerformanceMonitoring = (WrappedComponent, componentName) => {
  return React.forwardRef((props, ref) => {
    React.useEffect(() => {
      PerformanceMonitor.startTiming(`${componentName} mount`);
      return () => {
        PerformanceMonitor.endTiming(`${componentName} mount`);
      };
    }, []);

    return <WrappedComponent {...props} ref={ref} />;
  });
};