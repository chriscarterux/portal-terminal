#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚀 Initializing Portal Terminal development environment...');

// Ensure required directories exist
const requiredDirs = [
  '.claude/memory',
  '.claude/prompts',
  'scripts',
  'tests/e2e',
];

requiredDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  }
});

// Check required memory files
const memoryFiles = [
  '.claude/memory/project-context.md',
  '.claude/memory/architecture.md',
  '.claude/memory/implementation-strategy.md',
  '.claude/memory/conventions.md',
];

memoryFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ Memory file exists: ${file}`);
  } else {
    console.log(`⚠️  Missing memory file: ${file}`);
  }
});

console.log('🎯 Portal Terminal initialization complete!');
console.log('');
console.log('Next steps:');
console.log('  npm install          # Install dependencies');
console.log('  npm run build        # Build packages');
console.log('  npm run dev          # Start development');
console.log('');