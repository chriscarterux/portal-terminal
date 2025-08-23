# @portal/ai-providers

High-performance AI model integration for Portal Terminal featuring local ONNX models and external provider support.

## Features

### 🚀 Local AI Models (ONNX Runtime)
- **GPT-OSS-20B**: Optimized for <500ms response time
- **GPT-OSS-120B**: High-quality responses with full context
- **Performance Optimization**: CPU + GPU acceleration
- **Memory Management**: Efficient resource usage

### 🌐 External Providers
- **OpenAI**: GPT-4, GPT-3.5 Turbo
- **Anthropic**: Claude 3 Sonnet, Haiku
- **Google**: Gemini Pro
- **DeepSeek**: DeepSeek Coder
- **Qwen**: Qwen2.5 Coder

### ⚡ Performance Features
- **Sub-500ms Responses**: 20B model optimized for terminal use
- **Intelligent Caching**: Response caching with LRU eviction
- **Queue Management**: Request prioritization and batching
- **Auto-optimization**: Dynamic performance tuning

## System Requirements

### Minimum (20B Model)
- **Memory**: 8GB RAM
- **CPU**: 4+ cores
- **Storage**: 10GB free space

### Recommended (120B Model)  
- **Memory**: 32GB RAM
- **CPU**: 8+ cores
- **GPU**: Metal (macOS), CUDA (NVIDIA), DirectML (Windows)
- **Storage**: 50GB free space

## Quick Start

```typescript
import { ModelManager, AITerminalIntegration } from '@portal/ai-providers';

// Initialize AI integration
const ai = new AITerminalIntegration({
  enabledProviders: ['gpt-oss-20b', 'gpt-oss-120b'],
  defaultModel: 'gpt-oss-20b',
  responseTimeout: 5000,
  enableCaching: true,
});

await ai.initialize();

// Get command suggestions (fast)
const suggestions = await ai.generateCommandSuggestion('git', context);

// Explain command (detailed)
const explanation = await ai.explainCommand('rm -rf folder', context);

// Analyze errors
const analysis = await ai.analyzeError('npm install', errorOutput, context);
```

## Performance Optimization

### Automatic System Analysis
```bash
node scripts/test-ai-models.js
```

Example output:
```
🤖 Portal Terminal - AI Model Testing

💻 System Info:
   CPU: Apple M4 (10 cores)
   Memory: 2GB free / 32GB total
   GPU: ✅ Available

🎯 Performance Targets:
   20B <500ms target: ✅ Expected to meet
```

### Model-Specific Optimizations

**GPT-OSS-20B (Speed Priority)**
- Target: <500ms response time
- Tokens: Limited to 256 for speed
- Temperature: 0.3 for consistency
- Threads: Up to 8 cores
- Cache: Aggressive caching

**GPT-OSS-120B (Quality Priority)**
- Target: <5s response time
- Tokens: Up to 1024 for detail
- Temperature: 0.7 for creativity
- Threads: 4 cores to avoid memory pressure
- Cache: LRU caching

## Prompt Engineering

### Terminal-Optimized Templates

**Command Help Template**
```
Context: {command} in {workingDirectory}
Shell: {shellType}
Recent: {recentCommands}

Provide concise, actionable guidance.
```

**Error Analysis Template**
```
Command: {command}
Error: {errorOutput}
Context: {projectContext}

Analyze and provide step-by-step fixes.
```

### Context Integration
- **MCP Context**: Enhanced with Model Context Protocol data
- **Git Context**: Repository state and history
- **Project Context**: Dependencies and structure
- **Shell Context**: Recent commands and environment

## Model Downloads

```bash
# Create models directory
mkdir models/

# Download GPT-OSS models (example URLs)
# GPT-OSS-20B: ~8GB download
# GPT-OSS-120B: ~32GB download
wget https://huggingface.co/microsoft/gpt-oss-20b/resolve/main/model.onnx models/gpt-oss-20b.onnx
wget https://huggingface.co/microsoft/gpt-oss-120b/resolve/main/model.onnx models/gpt-oss-120b.onnx
```

## Performance Monitoring

```typescript
// Real-time performance tracking
const status = await ai.getAIStatus();
console.log(`Models ready: ${status.availableModels.length}`);
console.log(`Avg response time: ${status.performance.avgResponseTime}ms`);

// Benchmark models
const benchmarks = await ai.benchmarkModels();
console.log(`20B model: ${benchmarks['gpt-oss-20b'].avgResponseTime}ms`);
```

## Configuration

Set up external providers with environment variables:

```bash
# .env file
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
GOOGLE_API_KEY=your_google_key
DEEPSEEK_API_KEY=your_deepseek_key
QWEN_API_KEY=your_qwen_key
```

## Architecture

```
AI Providers Package
├── ModelManager - Central AI coordination
├── LocalONNXProvider - ONNX Runtime integration
├── ExternalProvider - API-based providers  
├── PromptEngineer - Context-aware prompts
├── PerformanceOptimizer - Speed optimization
└── FastInferenceEngine - <500ms responses
```

Portal Terminal's AI integration provides both blazing-fast local inference and comprehensive external provider support!