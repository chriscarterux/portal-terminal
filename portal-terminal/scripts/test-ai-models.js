#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

console.log('🤖 Portal Terminal - AI Model Testing\n');

async function testSystemCapabilities() {
  console.log('🔍 Analyzing system capabilities...');
  
  // Mock the performance optimizer analysis
  const os = require('os');
  const cpus = os.cpus();
  const totalMemoryGB = Math.round(os.totalmem() / (1024 * 1024 * 1024));
  const freeMemoryGB = Math.round(os.freemem() / (1024 * 1024 * 1024));
  
  console.log(`💻 System Info:`);
  console.log(`   CPU: ${cpus[0]?.model || 'Unknown'} (${cpus.length} cores)`);
  console.log(`   Memory: ${freeMemoryGB}GB free / ${totalMemoryGB}GB total`);
  console.log(`   Platform: ${os.platform()} ${os.arch()}`);
  
  // Check GPU availability
  const hasGPU = process.platform === 'darwin' || 
                 process.env.CUDA_VISIBLE_DEVICES !== undefined ||
                 process.env.ROCm_VISIBLE_DEVICES !== undefined;
  
  console.log(`   GPU: ${hasGPU ? '✅ Available' : '❌ Not detected'}`);
  
  // Model capability analysis
  const can20B = totalMemoryGB >= 8;
  const can120B = totalMemoryGB >= 32;
  
  console.log(`\n🧠 Model Capabilities:`);
  console.log(`   GPT-OSS-20B: ${can20B ? '✅ Can run' : '❌ Insufficient memory'}`);
  console.log(`   GPT-OSS-120B: ${can120B ? '✅ Can run' : '❌ Insufficient memory'}`);
  
  // Performance estimates
  let speed20B = 5; // base tokens/sec
  let speed120B = 1;
  
  if (hasGPU) {
    speed20B *= 3;
    speed120B *= 2;
  }
  
  if (cpus.length > 8) {
    speed20B *= 1.5;
    speed120B *= 1.3;
  }
  
  console.log(`\n⚡ Performance Estimates:`);
  console.log(`   GPT-OSS-20B: ~${Math.round(speed20B)} tokens/sec (~${Math.round(1000/speed20B*10)}ms for 10 tokens)`);
  console.log(`   GPT-OSS-120B: ~${Math.round(speed120B)} tokens/sec (~${Math.round(1000/speed120B*10)}ms for 10 tokens)`);
  
  // Target validation
  const meets20BTarget = (1000 / speed20B * 10) < 500; // 10 tokens in <500ms
  console.log(`\n🎯 Performance Targets:`);
  console.log(`   20B <500ms target: ${meets20BTarget ? '✅ Expected to meet' : '⚠️  May not meet'}`);
  
  return {
    can20B,
    can120B,
    hasGPU,
    estimatedSpeed20B: speed20B,
    meets20BTarget,
    recommendations: generateRecommendations(totalMemoryGB, cpus.length, hasGPU),
  };
}

function generateRecommendations(memoryGB, cpuCount, hasGPU) {
  const recommendations = [];
  
  if (memoryGB < 8) {
    recommendations.push('💡 Upgrade to 8GB+ RAM to run local AI models');
  } else if (memoryGB < 16) {
    recommendations.push('💡 Consider 16GB+ RAM for optimal 20B model performance');
  }
  
  if (!hasGPU) {
    recommendations.push('💡 GPU acceleration would significantly improve performance');
  }
  
  if (cpuCount < 4) {
    recommendations.push('💡 More CPU cores would improve inference speed');
  }
  
  if (memoryGB >= 32 && hasGPU) {
    recommendations.push('🚀 Your system is excellent for running both 20B and 120B models!');
  } else if (memoryGB >= 8 && cpuCount >= 4) {
    recommendations.push('✅ Your system is well-suited for the 20B model');
  }
  
  return recommendations;
}

async function testModelAvailability() {
  console.log('\n📦 Checking model availability...');
  
  const modelsDir = path.join(process.cwd(), 'models');
  const modelFiles = [
    'gpt-oss-20b.onnx',
    'gpt-oss-120b.onnx',
  ];
  
  for (const modelFile of modelFiles) {
    const modelPath = path.join(modelsDir, modelFile);
    try {
      await fs.promises.access(modelPath);
      const stats = await fs.promises.stat(modelPath);
      const sizeGB = (stats.size / (1024 * 1024 * 1024)).toFixed(1);
      console.log(`   ✅ ${modelFile}: Available (${sizeGB}GB)`);
    } catch {
      console.log(`   ❌ ${modelFile}: Not found`);
      console.log(`      Download from: https://huggingface.co/microsoft/gpt-oss-${modelFile.includes('20b') ? '20b' : '120b'}`);
    }
  }
}

async function testExternalProviders() {
  console.log('\n🌐 Checking external AI providers...');
  
  const providers = [
    { name: 'OpenAI', env: 'OPENAI_API_KEY' },
    { name: 'Anthropic', env: 'ANTHROPIC_API_KEY' },
    { name: 'Google', env: 'GOOGLE_API_KEY' },
    { name: 'DeepSeek', env: 'DEEPSEEK_API_KEY' },
    { name: 'Qwen', env: 'QWEN_API_KEY' },
  ];
  
  for (const provider of providers) {
    const hasKey = !!process.env[provider.env];
    console.log(`   ${hasKey ? '✅' : '❌'} ${provider.name}: ${hasKey ? 'API key configured' : 'No API key'}`);
  }
}

async function generateTestReport() {
  const capabilities = await testSystemCapabilities();
  await testModelAvailability();
  await testExternalProviders();
  
  console.log('\n📋 Summary Report:');
  console.log('='.repeat(50));
  
  if (capabilities.can20B && capabilities.meets20BTarget) {
    console.log('🚀 System ready for high-performance local AI');
    console.log('   Recommended: Use GPT-OSS-20B for <500ms responses');
  } else if (capabilities.can20B) {
    console.log('⚡ System can run local AI with moderate performance');
    console.log('   Recommended: Use GPT-OSS-20B with adjusted expectations');
  } else {
    console.log('🌐 System best suited for external AI providers');
    console.log('   Recommended: Use OpenAI or Anthropic APIs');
  }
  
  console.log('\n🎯 Next Steps:');
  for (const rec of capabilities.recommendations) {
    console.log(`   ${rec}`);
  }
  
  console.log('\n🔧 To download models:');
  console.log('   mkdir models/');
  console.log('   # Download ONNX models from Hugging Face');
  console.log('   # Configure API keys in .env file');
  
  console.log('\n✨ Ready to start Portal Terminal with AI support!');
}

generateTestReport().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});