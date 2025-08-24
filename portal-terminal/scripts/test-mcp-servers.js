#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Portal Terminal MCP Servers...\n');

// Load server configuration
const configPath = path.join(__dirname, '..', 'mcp-servers.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

async function testServer(serverConfig) {
  console.log(`Testing ${serverConfig.name}...`);
  
  return new Promise((resolve) => {
    const childProcess = spawn(serverConfig.command, serverConfig.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: serverConfig.cwd || process.cwd(),
      env: { ...process.env, ...serverConfig.env },
    });

    let output = '';
    let hasResponse = false;

    // Send initialization message
    const initMessage = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
        clientInfo: {
          name: 'portal-terminal-test',
          version: '0.1.0',
        },
      },
    };

    childProcess.stdout.on('data', (data) => {
      output += data.toString();
      hasResponse = true;
    });

    childProcess.stderr.on('data', (data) => {
      console.log(`  ⚠️  ${serverConfig.name} stderr:`, data.toString().trim());
    });

    childProcess.on('close', (code) => {
      if (hasResponse) {
        console.log(`  ✅ ${serverConfig.name}: Connected successfully`);
        console.log(`  📄 Response preview: ${output.slice(0, 100)}...`);
      } else {
        console.log(`  ❌ ${serverConfig.name}: No response (exit code: ${code})`);
      }
      console.log('');
      resolve();
    });

    childProcess.on('error', (error) => {
      console.log(`  ❌ ${serverConfig.name}: Failed to start - ${error.message}`);
      console.log('');
      resolve();
    });

    // Send the initialization message
    try {
      childProcess.stdin.write(JSON.stringify(initMessage) + '\n');
    } catch (error) {
      console.log(`  ❌ ${serverConfig.name}: Failed to send init message - ${error.message}`);
    }

    // Timeout after 5 seconds
    setTimeout(() => {
      if (!childProcess.killed) {
        childProcess.kill();
        if (!hasResponse) {
          console.log(`  ⏱️  ${serverConfig.name}: Timeout (no response in 5s)`);
          console.log('');
        }
        resolve();
      }
    }, 5000);
  });
}

async function runTests() {
  console.log('Testing enabled MCP servers:\n');
  
  const enabledServers = config.servers.filter(server => server.enabled);
  
  if (enabledServers.length === 0) {
    console.log('No enabled servers found in configuration.');
    return;
  }

  for (const server of enabledServers) {
    await testServer(server);
  }

  console.log('🏁 MCP Server testing complete!');
  console.log('\nNext steps:');
  console.log('  1. Install any missing MCP servers with: npm install -g <server-package>');
  console.log('  2. Configure API keys for external services (Context7, Tavily)');
  console.log('  3. Run Portal Terminal with: npm run dev');
}

runTests().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});