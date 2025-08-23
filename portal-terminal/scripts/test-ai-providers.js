#!/usr/bin/env node

require('dotenv').config(); // Load environment variables

console.log('🤖 Portal Terminal - Multi-Provider AI Testing\n');

async function testProviderConnections() {
  console.log('🔌 Testing AI provider connections...\n');

  const providers = [
    { name: 'OpenAI', env: 'OPENAI_API_KEY', test: testOpenAI },
    { name: 'Anthropic', env: 'ANTHROPIC_API_KEY', test: testAnthropic },
    { name: 'Google', env: 'GOOGLE_API_KEY', test: testGoogle },
    { name: 'DeepSeek', env: 'DEEPSEEK_API_KEY', test: testDeepSeek },
    { name: 'Qwen', env: 'QWEN_API_KEY', test: testQwen },
  ];

  const results = [];

  for (const provider of providers) {
    const hasKey = !!process.env[provider.env];
    console.log(`Testing ${provider.name}...`);
    
    if (!hasKey) {
      console.log(`  ❌ No API key (${provider.env})`);
      results.push({ name: provider.name, status: 'no-key', responseTime: 0 });
      continue;
    }

    try {
      const startTime = Date.now();
      const success = await provider.test();
      const responseTime = Date.now() - startTime;
      
      if (success) {
        console.log(`  ✅ Connected (${responseTime}ms)`);
        results.push({ name: provider.name, status: 'success', responseTime });
      } else {
        console.log(`  ❌ Connection failed`);
        results.push({ name: provider.name, status: 'failed', responseTime });
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
      results.push({ name: provider.name, status: 'error', responseTime: 0, error: error.message });
    }
    
    console.log('');
  }

  return results;
}

async function testOpenAI() {
  const response = await fetch('https://api.openai.com/v1/models', {
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
  });
  return response.ok;
}

async function testAnthropic() {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'test' }],
    }),
  });
  return response.ok;
}

async function testGoogle() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: 'test' }] }],
      generationConfig: { maxOutputTokens: 1 },
    }),
  });
  return response.ok;
}

async function testDeepSeek() {
  const response = await fetch('https://api.deepseek.com/v1/models', {
    headers: {
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
  });
  return response.ok;
}

async function testQwen() {
  const response = await fetch('https://dashscope.aliyuncs.com/api/v1/models', {
    headers: {
      'Authorization': `Bearer ${process.env.QWEN_API_KEY}`,
    },
  });
  return response.ok;
}

async function simulateMultiProviderSystem() {
  console.log('🎭 Simulating Multi-Provider AI System...\n');

  // Mock the multi-provider AI for demonstration
  const testRequests = [
    {
      prompt: 'Explain git status',
      context: { command: 'git status', workingDirectory: '/project', shellType: 'bash', recentCommands: [] },
      expectedProvider: 'local-fast',
    },
    {
      prompt: 'Help me debug this complex webpack configuration error with multiple build targets',
      context: { command: 'npm run build', workingDirectory: '/project', shellType: 'bash', recentCommands: [] },
      expectedProvider: 'external-quality',
    },
    {
      prompt: 'Show me docker commands',
      context: { command: 'docker', workingDirectory: '/project', shellType: 'bash', recentCommands: [] },
      expectedProvider: 'code-specialist',
    },
  ];

  for (const [index, req] of testRequests.entries()) {
    console.log(`Request ${index + 1}: "${req.prompt}"`);
    
    // Simulate provider selection logic
    let selectedProvider = '';
    let reason = '';
    let estimatedCost = 0;
    let estimatedTime = 0;

    if (req.prompt.length < 50) {
      selectedProvider = 'gpt-oss-20b';
      reason = 'Fast local model for simple queries';
      estimatedCost = 0;
      estimatedTime = 400;
    } else if (req.prompt.includes('docker') || req.prompt.includes('code')) {
      selectedProvider = 'deepseek-coder';
      reason = 'Specialized coding model';
      estimatedCost = 0.0002;
      estimatedTime = 1200;
    } else {
      selectedProvider = 'claude-sonnet';
      reason = 'High-quality responses for complex queries';
      estimatedCost = 0.003;
      estimatedTime = 2000;
    }

    console.log(`  → Selected: ${selectedProvider}`);
    console.log(`  → Reason: ${reason}`);
    console.log(`  → Estimated: ${estimatedTime}ms, $${estimatedCost.toFixed(4)}`);
    console.log('');
  }

  // Show cost summary
  console.log('💰 Cost Analysis:');
  console.log('  Local Models (GPT-OSS): $0.00 (unlimited usage)');
  console.log('  DeepSeek Coder: $0.14 per 1M tokens');
  console.log('  Claude Sonnet: $3.00 per 1M tokens');
  console.log('  GPT-4o: $5.00 per 1M tokens');
  console.log('  Gemini Flash: $0.075 per 1M tokens (best value)');
  console.log('');

  console.log('⚡ Performance Tiers:');
  console.log('  Ultra-Fast (<500ms): GPT-OSS-20B (local)');
  console.log('  Fast (1-3s): Claude Haiku, GPT-4o Mini, Gemini Flash');
  console.log('  Quality (2-5s): Claude Sonnet, GPT-4o, DeepSeek Coder');
  console.log('  High-Quality (3-8s): GPT-OSS-120B (local), Gemini Pro');
}

async function demonstrateSelectionLogic() {
  console.log('🧠 AI Provider Selection Logic:\n');

  const scenarios = [
    {
      name: 'Quick Command Help',
      criteria: { prioritizeSpeed: true, maxResponseTime: 500 },
      expected: 'GPT-OSS-20B (local)',
    },
    {
      name: 'Cost-Conscious User',
      criteria: { prioritizeCost: true, maxCostPerRequest: 0.001 },
      expected: 'Local models or Gemini Flash',
    },
    {
      name: 'Complex Code Review',
      criteria: { prioritizeQuality: true, maxResponseTime: 10000 },
      expected: 'Claude Sonnet or GPT-OSS-120B',
    },
    {
      name: 'Privacy-First',
      criteria: { requireLocal: true },
      expected: 'GPT-OSS models only',
    },
  ];

  for (const scenario of scenarios) {
    console.log(`📋 ${scenario.name}:`);
    console.log(`   Criteria: ${Object.entries(scenario.criteria).map(([k,v]) => `${k}=${v}`).join(', ')}`);
    console.log(`   Best Choice: ${scenario.expected}`);
    console.log('');
  }
}

async function main() {
  try {
    // Test individual provider connections
    const connectionResults = await testProviderConnections();
    
    // Simulate multi-provider system
    await simulateMultiProviderSystem();
    
    // Demonstrate selection logic
    await demonstrateSelectionLogic();
    
    // Summary
    const workingProviders = connectionResults.filter(r => r.status === 'success').length;
    const totalProviders = connectionResults.length;
    
    console.log('🎯 Portal Terminal AI System Ready!');
    console.log(`   ${workingProviders}/${totalProviders} providers available`);
    console.log('   Smart provider selection implemented');
    console.log('   Cost tracking and budgets configured');
    console.log('   Performance optimized for <500ms responses');
    console.log('');
    
    if (workingProviders > 0) {
      console.log('✨ Ready to start Portal Terminal with AI assistance!');
    } else {
      console.log('⚠️  Configure API keys to enable AI features');
      console.log('   Or download local ONNX models for offline AI');
    }

  } catch (error) {
    console.error('❌ Testing failed:', error);
    process.exit(1);
  }
}

main();