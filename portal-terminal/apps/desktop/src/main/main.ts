import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { PortalTerminal, IntegratedTerminal } from '@portal/terminal-core';
import { AITerminalIntegration } from '@portal/ai-providers';
import { WorkingMCPClient } from '@portal/mcp-client';
import type { ITerminalCreateOptions } from '../shared/types';

let mainWindow: BrowserWindow | null = null;
const terminals = new Map<string, PortalTerminal>();
const integratedTerminals = new Map<string, IntegratedTerminal>();
const aiIntegrations = new Map<string, AITerminalIntegration>();
const mcpClients = new Map<string, WorkingMCPClient>();

const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'hiddenInset',
    show: false,
    vibrancy: 'under-window',
    visualEffectState: 'active',
  });

  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    // Clean up all terminals
    terminals.forEach(terminal => terminal.destroy());
    terminals.clear();
  });
};

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Enhanced terminal creation with full integration
ipcMain.handle('terminal:create-integrated', async (event, options: any = {}) => {
  const terminalId = Date.now().toString();
  
  // Create integrated terminal with AI and MCP
  const terminal = new IntegratedTerminal({
    ...options,
    aiEnabled: true,
    mcpEnabled: true,
    autoSuggestions: true,
    errorAnalysis: true,
    performanceMonitoring: true,
  });

  // Create AI integration
  const aiIntegration = new AITerminalIntegration({
    enabledProviders: ['gpt-oss-20b', 'gpt-oss-120b', 'openai'],
    defaultModel: 'gpt-oss-20b',
    responseTimeout: 10000,
    enableCaching: true,
  });

  // Create MCP client
  const mcpClient = new WorkingMCPClient();

  try {
    // Initialize all components
    await Promise.all([
      aiIntegration.initialize(),
      mcpClient.connect(),
    ]);

    // Set up terminal event listeners
    terminal.onData((data: string) => {
      mainWindow?.webContents.send('terminal:data', terminalId, data);
    });
    
    terminal.onExit((exitCode: number) => {
      mainWindow?.webContents.send('terminal:exit', terminalId, exitCode);
      cleanup(terminalId);
    });

    // AI suggestion events
    terminal.onAISuggestion?.((suggestion: string) => {
      mainWindow?.webContents.send('ai:suggestion', terminalId, suggestion);
    });

    // MCP context events  
    terminal.onMCPUpdate?.((context: any) => {
      mainWindow?.webContents.send('mcp:context-update', terminalId, context);
    });

    // Command completion events
    terminal.onCommandComplete?.((block: any) => {
      mainWindow?.webContents.send('terminal:command-complete', terminalId, block);
    });
    
    terminal.start();
    
    // Store references
    integratedTerminals.set(terminalId, terminal);
    aiIntegrations.set(terminalId, aiIntegration);
    mcpClients.set(terminalId, mcpClient);
    
    console.log(`✅ Integrated terminal ${terminalId} created successfully`);
    return terminalId;
    
  } catch (error) {
    console.error('Failed to create integrated terminal:', error);
    throw error;
  }
});

// Legacy terminal creation (for compatibility)
ipcMain.handle('terminal:create', async (event, options: ITerminalCreateOptions = {}) => {
  const terminalId = Date.now().toString();
  const terminal = new PortalTerminal({
    ...options,
    enableAllFeatures: true,
    aiProvider: 'gpt-oss-20b',
    mcpServers: ['context7', 'memory', 'filesystem'],
    theme: 'dark',
  });
  
  // Set up terminal event listeners
  terminal.onData((data: string) => {
    mainWindow?.webContents.send('terminal:data', terminalId, data);
  });
  
  terminal.onExit((exitCode: number) => {
    mainWindow?.webContents.send('terminal:exit', terminalId, exitCode);
    terminals.delete(terminalId);
  });
  
  terminal.start();
  terminals.set(terminalId, terminal);
  
  return terminalId;
});

ipcMain.handle('terminal:write', async (event, terminalId: string, data: string) => {
  const terminal = terminals.get(terminalId);
  if (terminal) {
    await terminal.write(data);
  }
});

ipcMain.handle('terminal:resize', async (event, terminalId: string, cols: number, rows: number) => {
  const terminal = terminals.get(terminalId);
  if (terminal) {
    terminal.resize(cols, rows);
  }
});

ipcMain.handle('terminal:kill', async (event, terminalId: string) => {
  const terminal = terminals.get(terminalId);
  if (terminal) {
    terminal.destroy();
    terminals.delete(terminalId);
  }
});

// Command execution with MCP enhancement
ipcMain.handle('terminal:execute-command', async (event, terminalId: string, command: string) => {
  const terminal = terminals.get(terminalId);
  if (terminal) {
    const block = await terminal.executeCommand(command);
    return block.toJSON();
  }
  throw new Error(`Terminal ${terminalId} not found`);
});

// Enhanced AI integration handlers
ipcMain.handle('ai:get-suggestions', async (event, terminalId: string, command: string) => {
  const aiIntegration = aiIntegrations.get(terminalId);
  const terminal = integratedTerminals.get(terminalId);
  
  if (aiIntegration && terminal) {
    try {
      const context = terminal.getTerminalContext();
      const suggestions = await aiIntegration.generateCommandSuggestion(command, {
        workingDirectory: context.workingDirectory,
        shellType: context.shellType,
        recentCommands: context.recentCommands,
        gitContext: context.gitContext,
        projectContext: context.projectContext,
      });
      
      return { suggestions: suggestions.map(s => ({ text: s, confidence: 85, type: 'suggestion' })) };
    } catch (error) {
      console.warn('AI suggestions failed:', error);
      return { suggestions: [] };
    }
  }
  
  return { suggestions: [] };
});

ipcMain.handle('ai:get-contextual-help', async (event, terminalId: string, query: string) => {
  const aiIntegration = aiIntegrations.get(terminalId);
  const terminal = integratedTerminals.get(terminalId);
  
  if (aiIntegration && terminal) {
    try {
      const context = terminal.getTerminalContext();
      const response = await aiIntegration.getContextualHelp(query, {
        workingDirectory: context.workingDirectory,
        shellType: context.shellType,
        recentCommands: context.recentCommands,
        gitContext: context.gitContext,
        projectContext: context.projectContext,
      });
      
      return response.text;
    } catch (error) {
      console.warn('AI help failed:', error);
      return 'AI help unavailable';
    }
  }
  
  return 'AI not available';
});

// Enhanced terminal execution with AI+MCP integration
ipcMain.handle('terminal:execute-enhanced', async (event, terminalId: string, command: string, options: any = {}) => {
  const terminal = integratedTerminals.get(terminalId);
  
  if (terminal) {
    try {
      const result = await terminal.executeEnhancedCommand(command, options);
      
      // Send command completion event
      mainWindow?.webContents.send('terminal:command-complete', terminalId, result.block);
      
      return result;
    } catch (error) {
      console.error('Enhanced command execution failed:', error);
      throw error;
    }
  }
  
  throw new Error('Integrated terminal not found');
});

// System status handlers
ipcMain.handle('terminal:get-system-status', async (event, terminalId: string) => {
  const terminal = integratedTerminals.get(terminalId);
  return terminal?.getSystemStatus() || null;
});

ipcMain.handle('terminal:get-context', async (event, terminalId: string) => {
  const terminal = integratedTerminals.get(terminalId);
  return terminal?.getTerminalContext() || null;
});

// Performance and health monitoring
ipcMain.handle('terminal:get-performance-metrics', async (event, terminalId: string) => {
  const terminal = integratedTerminals.get(terminalId);
  return terminal?.getPerformanceMetrics() || null;
});

ipcMain.handle('terminal:health-check', async (event, terminalId: string) => {
  const terminal = integratedTerminals.get(terminalId);
  return terminal?.healthCheck() || null;
});

// Enhanced MCP handlers
ipcMain.handle('mcp:get-context', async (event, terminalId: string) => {
  const mcpClient = mcpClients.get(terminalId);
  return mcpClient?.getContext() || null;
});

ipcMain.handle('mcp:search-context', async (event, terminalId: string, query: string) => {
  const mcpClient = mcpClients.get(terminalId);
  return mcpClient?.searchContext(query) || [];
});

ipcMain.handle('mcp:get-health-report', async (event, terminalId: string) => {
  const mcpClient = mcpClients.get(terminalId);
  return mcpClient?.getHealthReport() || null;
});

// Utility function for cleanup
function cleanup(terminalId: string): void {
  const terminal = integratedTerminals.get(terminalId);
  const aiIntegration = aiIntegrations.get(terminalId);
  const mcpClient = mcpClients.get(terminalId);
  
  Promise.all([
    terminal?.destroy(),
    aiIntegration?.destroy(),
    mcpClient?.disconnect(),
  ]).catch(console.warn);
  
  integratedTerminals.delete(terminalId);
  aiIntegrations.delete(terminalId);
  mcpClients.delete(terminalId);
}

// Window management IPC handlers
ipcMain.handle('window:close', async () => {
  mainWindow?.close();
});

ipcMain.handle('window:minimize', async () => {
  mainWindow?.minimize();
});

ipcMain.handle('window:maximize', async () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle('window:is-maximized', async () => {
  return mainWindow?.isMaximized() ?? false;
});