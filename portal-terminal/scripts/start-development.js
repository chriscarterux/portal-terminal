#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');

console.log('🚀 Starting Portal Terminal development environment...');

// Check if dependencies are installed
if (!fs.existsSync('node_modules')) {
  console.log('📦 Installing dependencies...');
  const install = spawn('npm', ['install'], { stdio: 'inherit' });
  
  install.on('close', (code) => {
    if (code === 0) {
      startDevelopment();
    } else {
      console.error('❌ Failed to install dependencies');
      process.exit(1);
    }
  });
} else {
  startDevelopment();
}

function startDevelopment() {
  console.log('🔨 Building packages...');
  
  const build = spawn('npm', ['run', 'build:packages'], { stdio: 'inherit' });
  
  build.on('close', (code) => {
    if (code === 0) {
      console.log('✅ Packages built successfully');
      console.log('🎯 Starting development server...');
      
      // Start development server
      const dev = spawn('npm', ['run', 'dev'], { stdio: 'inherit' });
      
      dev.on('close', (code) => {
        console.log(`Development server exited with code ${code}`);
      });
    } else {
      console.error('❌ Failed to build packages');
      process.exit(1);
    }
  });
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down development environment...');
  process.exit(0);
});