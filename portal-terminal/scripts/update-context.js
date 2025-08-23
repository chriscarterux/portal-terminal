#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔄 Updating Portal Terminal development context...');

// Read current git status
const { execSync } = require('child_process');

try {
  const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
  const gitBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  
  console.log(`📍 Current branch: ${gitBranch}`);
  
  if (gitStatus.trim()) {
    console.log('📝 Modified files:');
    gitStatus.split('\n').filter(line => line.trim()).forEach(line => {
      console.log(`   ${line}`);
    });
  } else {
    console.log('✅ Working directory clean');
  }
} catch (error) {
  console.log('⚠️  Not in a git repository or git not available');
}

// Check build status
try {
  const packageDirs = ['packages/terminal-core', 'apps/desktop'];
  
  packageDirs.forEach(dir => {
    const distPath = path.join(dir, 'dist');
    if (fs.existsSync(distPath)) {
      console.log(`✅ Built: ${dir}`);
    } else {
      console.log(`⚠️  Not built: ${dir}`);
    }
  });
} catch (error) {
  console.log('⚠️  Could not check build status');
}

console.log('');
console.log('🎯 Context update complete!');
console.log('');