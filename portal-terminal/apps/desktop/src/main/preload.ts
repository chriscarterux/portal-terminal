import { contextBridge, ipcRenderer } from 'electron';
import type { IElectronAPI } from '../shared/types';

const electronAPI: IElectronAPI = {
  terminal: {
    create: (options) => ipcRenderer.invoke('terminal:create', options),
    createIntegrated: (options) => ipcRenderer.invoke('terminal:create-integrated', options),
    write: (terminalId, data) => ipcRenderer.invoke('terminal:write', terminalId, data),
    resize: (terminalId, cols, rows) => ipcRenderer.invoke('terminal:resize', terminalId, cols, rows),
    kill: (terminalId) => ipcRenderer.invoke('terminal:kill', terminalId),
    executeCommand: (terminalId, command) => ipcRenderer.invoke('terminal:execute-command', terminalId, command),
    executeEnhanced: (terminalId, command, options) => ipcRenderer.invoke('terminal:execute-enhanced', terminalId, command, options),
    getSystemStatus: (terminalId) => ipcRenderer.invoke('terminal:get-system-status', terminalId),
    getContext: (terminalId) => ipcRenderer.invoke('terminal:get-context', terminalId),
    getPerformanceMetrics: (terminalId) => ipcRenderer.invoke('terminal:get-performance-metrics', terminalId),
    healthCheck: (terminalId) => ipcRenderer.invoke('terminal:health-check', terminalId),
    onData: (callback) => {
      ipcRenderer.on('terminal:data', (_, terminalId, data) => callback(terminalId, data));
    },
    onExit: (callback) => {
      ipcRenderer.on('terminal:exit', (_, terminalId, exitCode) => callback(terminalId, exitCode));
    },
    onCommandComplete: (callback) => {
      ipcRenderer.on('terminal:command-complete', (_, terminalId, block) => callback(terminalId, block));
    },
  },
  ai: {
    getSuggestions: (terminalId, command) => ipcRenderer.invoke('ai:get-suggestions', terminalId, command),
    getContextualHelp: (terminalId, query) => ipcRenderer.invoke('ai:get-contextual-help', terminalId, query),
    onSuggestion: (callback) => {
      ipcRenderer.on('ai:suggestion', (_, terminalId, suggestion) => callback(terminalId, suggestion));
    },
  },
  mcp: {
    getContext: (terminalId) => ipcRenderer.invoke('mcp:get-context', terminalId),
    searchContext: (terminalId, query) => ipcRenderer.invoke('mcp:search-context', terminalId, query),
    getHealthReport: (terminalId) => ipcRenderer.invoke('mcp:get-health-report', terminalId),
    callTool: (terminalId, toolCall) => ipcRenderer.invoke('mcp:call-tool', terminalId, toolCall),
    readResource: (terminalId, request) => ipcRenderer.invoke('mcp:read-resource', terminalId, request),
    onContextUpdate: (callback) => {
      ipcRenderer.on('mcp:context-update', (_, terminalId, context) => callback(terminalId, context));
    },
  },
  window: {
    close: () => ipcRenderer.invoke('window:close'),
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);