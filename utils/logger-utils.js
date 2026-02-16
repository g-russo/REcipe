/**
 * logger-utils.js
 * Utility functions for structured logging of AI results.
 */

export const LogAIResult = (result, label = '🔍 Recognition Results') => {
  if (!result || !result.success) {
    console.error(`❌ ${label} Failed:`, result?.error || 'Unknown error');
    return;
  }

  console.log(`\n🍽️ ===== ${label} =====`);
  console.log(`📊 Total Detections: ${result.detection_count || 0}`);

  // 1. Gemini Prediction (Primary)
  if (result.gemini_prediction) {
    console.log('\n🤖 --- Gemini Analysis ---');
    const gemini = Array.isArray(result.gemini_prediction) 
      ? result.gemini_prediction 
      : [result.gemini_prediction];
    
    gemini.forEach((p, index) => {
      console.log(`[${index + 1}] ${p.name} (${(p.confidence * 100).toFixed(1)}%)`);
      if (p.reason) console.log(`    Reason: ${p.reason.substring(0, 100)}...`);
    });
  }

  // 2. Local Model Predictions
  const logModelResults = (name, data) => {
    if (data && data.length > 0) {
      console.log(`\n🧠 --- ${name} ---`);
      data.slice(0, 5).forEach(item => {
        const itemName = item.class || item.name;
        console.log(`   • ${itemName}: ${(item.confidence * 100).toFixed(1)}%`);
      });
    }
  };

  logModelResults('YOLOv8 Detector', result.detections);
  logModelResults('Food101 Classifier', result.food101_predictions);
  logModelResults('Filipino Classifier', result.filipino_predictions);
  logModelResults('Ingredient Detector', result.ingredient_predictions);

  console.log(`=============================\n`);
};

export const LogSafetyAnalysis = (prediction) => {
  if (!prediction) return;
  
  console.log(`\n🛡️ ===== Safety Analysis Results =====`);
  console.log(`🏷️ Category: ${prediction.category}`);
  console.log(`⏳ Shelf Life: ${prediction.shelfLifeDays} days`);
  console.log(`🧩 Condition: ${prediction.food_condition || 'N/A'}`);
  console.log(`✅ Safe to Eat: ${prediction.is_safe ? 'YES' : 'NO'}`);
  
  if (!prediction.is_safe && prediction.safety_reason) {
    console.log(`⚠️ Safety Reason: ${prediction.safety_reason}`);
  }

  if (prediction.storage_tips) {
    console.log(`📦 Storage Tips: ${prediction.storage_tips}`);
  }
  
  if (prediction.reasoning) {
    console.log(`📝 Reasoning: ${prediction.reasoning}`);
  }
  console.log(`====================================\n`);
};
