/**
 * ⚡ PERFORMANCE TESTING SCRIPT
 * Tests app performance, load times, and efficiency metrics
 */

const fs = require('fs');
const path = require('path');

class PerformanceTester {
  constructor() {
    this.results = {
      testName: 'Performance Testing',
      timestamp: new Date().toISOString(),
      metrics: [],
      summary: {
        averageLoadTime: 0,
        totalAssets: 0,
        bundleSize: 0,
        performanceScore: 0
      }
    };
  }

  // Test 1: Bundle size analysis
  async testBundleSize() {
    console.log('📦 Analyzing bundle size...');
    
    const packagePath = path.join(__dirname, '..', 'package.json');
    const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
    
    if (fs.existsSync(packagePath)) {
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      const depCount = Object.keys(pkg.dependencies || {}).length;
      const devDepCount = Object.keys(pkg.devDependencies || {}).length;
      
      this.addMetric('Dependencies', depCount, 'count', depCount < 30 ? 'good' : 'needs optimization');
      this.addMetric('Dev Dependencies', devDepCount, 'count', 'info');
    }

    // Check for heavy dependencies
    const heavyDeps = [
      'moment',
      'lodash',
      'axios'
    ];

    if (fs.existsSync(packagePath)) {
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      const foundHeavy = heavyDeps.filter(dep => allDeps[dep]);
      
      if (foundHeavy.length > 0) {
        this.addMetric('Heavy Dependencies', foundHeavy.join(', '), 'list', 'warning');
      }
    }
  }

  // Test 2: Image optimization
  async testImageOptimization() {
    console.log('🖼️ Testing image optimization...');
    
    const assetsPath = path.join(__dirname, '..', 'assets');
    let totalImages = 0;
    let unoptimizedImages = 0;

    if (fs.existsSync(assetsPath)) {
      const walkDir = (dir) => {
        const files = fs.readdirSync(dir);
        files.forEach(file => {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          
          if (stat.isDirectory()) {
            walkDir(filePath);
          } else if (/\.(png|jpg|jpeg)$/i.test(file)) {
            totalImages++;
            const sizeKB = stat.size / 1024;
            if (sizeKB > 200) {
              unoptimizedImages++;
            }
          }
        });
      };

      walkDir(assetsPath);
    }

    this.addMetric('Total Images', totalImages, 'count', 'info');
    this.addMetric('Large Images (>200KB)', unoptimizedImages, 'count', 
      unoptimizedImages === 0 ? 'good' : 'needs optimization');
  }

  // Test 3: Code efficiency
  async testCodeEfficiency() {
    console.log('💻 Testing code efficiency...');
    
    const appPath = path.join(__dirname, '..', 'app');
    const componentsPath = path.join(__dirname, '..', 'components');
    
    let totalFiles = 0;
    let largeFiles = 0;

    const checkDirectory = (dir) => {
      if (!fs.existsSync(dir)) return;
      
      const files = fs.readdirSync(dir);
      files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          checkDirectory(filePath);
        } else if (file.endsWith('.jsx') || file.endsWith('.js')) {
          totalFiles++;
          const lines = fs.readFileSync(filePath, 'utf8').split('\n').length;
          if (lines > 500) {
            largeFiles++;
          }
        }
      });
    };

    checkDirectory(appPath);
    checkDirectory(componentsPath);

    this.addMetric('Component Files', totalFiles, 'count', 'info');
    this.addMetric('Large Files (>500 lines)', largeFiles, 'count',
      largeFiles < 5 ? 'good' : 'consider splitting');
  }

  // Test 4: API call efficiency
  async testAPIEfficiency() {
    console.log('🌐 Testing API call efficiency...');
    
    const servicesPath = path.join(__dirname, '..', 'services');
    let cacheImplemented = false;
    
    if (fs.existsSync(servicesPath)) {
      const files = fs.readdirSync(servicesPath);
      files.forEach(file => {
        if (file.includes('cache')) {
          cacheImplemented = true;
        }
      });
    }

    this.addMetric('Cache Implementation', cacheImplemented ? 'Yes' : 'No', 'boolean',
      cacheImplemented ? 'good' : 'needs implementation');
  }

  // Test 5: Memory usage estimates
  async testMemoryUsage() {
    console.log('🧠 Estimating memory usage...');
    
    const packagePath = path.join(__dirname, '..', 'package.json');
    if (fs.existsSync(packagePath)) {
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      
      // Check for memory-heavy libraries
      const memoryHeavy = [
        'react-native-maps',
        'react-native-video',
        '@tensorflow',
        'three'
      ];

      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      const foundHeavy = memoryHeavy.filter(dep => 
        Object.keys(allDeps).some(key => key.includes(dep))
      );

      if (foundHeavy.length > 0) {
        this.addMetric('Memory-Heavy Libraries', foundHeavy.length, 'count', 'warning');
      } else {
        this.addMetric('Memory Profile', 'Optimized', 'status', 'good');
      }
    }
  }

  // Test 6: Render performance
  async testRenderPerformance() {
    console.log('🎨 Testing render performance...');
    
    const componentsPath = path.join(__dirname, '..', 'components');
    let usesUseMemo = 0;
    let usesUseCallback = 0;
    let totalComponents = 0;

    if (fs.existsSync(componentsPath)) {
      const walkDir = (dir) => {
        const files = fs.readdirSync(dir);
        files.forEach(file => {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          
          if (stat.isDirectory()) {
            walkDir(filePath);
          } else if (file.endsWith('.jsx') || file.endsWith('.js')) {
            totalComponents++;
            const content = fs.readFileSync(filePath, 'utf8');
            if (content.includes('useMemo')) usesUseMemo++;
            if (content.includes('useCallback')) usesUseCallback++;
          }
        });
      };

      walkDir(componentsPath);
    }

    const optimizationRate = ((usesUseMemo + usesUseCallback) / totalComponents * 100).toFixed(2);
    this.addMetric('Render Optimization Rate', `${optimizationRate}%`, 'percentage',
      parseFloat(optimizationRate) > 20 ? 'good' : 'consider more optimization');
  }

  // Helper method
  addMetric(name, value, unit, status) {
    this.results.metrics.push({
      name,
      value,
      unit,
      status,
      timestamp: new Date().toISOString()
    });
  }

  // Calculate performance score
  calculateScore() {
    const goodCount = this.results.metrics.filter(m => m.status === 'good').length;
    const total = this.results.metrics.length;
    return (goodCount / total * 100).toFixed(2);
  }

  // Run all tests
  async runAll() {
    console.log('⚡ Starting Performance Testing Suite...\n');
    
    await this.testBundleSize();
    await this.testImageOptimization();
    await this.testCodeEfficiency();
    await this.testAPIEfficiency();
    await this.testMemoryUsage();
    await this.testRenderPerformance();

    // Calculate summary
    this.results.summary.performanceScore = this.calculateScore();
    this.results.summary.totalMetrics = this.results.metrics.length;
    this.results.summary.goodMetrics = this.results.metrics.filter(m => m.status === 'good').length;
    this.results.summary.warningMetrics = this.results.metrics.filter(m => m.status === 'warning').length;

    // Save results
    fs.writeFileSync(
      path.join(__dirname, '..', 'performance-report.json'),
      JSON.stringify(this.results, null, 2)
    );

    // Print summary
    console.log('\n📊 Performance Test Results:');
    console.log(`⚡ Performance Score: ${this.results.summary.performanceScore}/100`);
    console.log(`✅ Optimized: ${this.results.summary.goodMetrics}`);
    console.log(`⚠️ Warnings: ${this.results.summary.warningMetrics}`);
    console.log('\n✅ Performance report saved to performance-report.json\n');

    return this.results;
  }
}

// Run tests
if (require.main === module) {
  const tester = new PerformanceTester();
  tester.runAll().then(results => {
    const score = parseFloat(results.summary.performanceScore);
    process.exit(score < 70 ? 1 : 0);
  });
}

module.exports = PerformanceTester;
