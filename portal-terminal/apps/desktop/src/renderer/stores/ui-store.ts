import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export interface IUIState {
  // Sidebar state
  isSidebarCollapsed: boolean;
  activeSidebarSection: string | null;
  
  // Workspace state
  selectedWorkspace: string;
  
  // MCP Servers state
  mcpServers: IMCPServer[];
  
  // AI Model selection
  selectedAIModel: string;
  availableAIModels: IAIModel[];
  aiModelDropdownOpen: boolean;
  
  // Command Input state
  currentCommand: string;
  commandHistory: string[];
  historyIndex: number;
  naturalLanguageEnabled: boolean;
  aiSuggestionsEnabled: boolean;
  
  // Terminal state
  workingDirectory: string;
  gitBranch: string | null;
  gitStatus: string | null;
  
  // UI preferences
  theme: 'dark' | 'light';
  
  // Actions
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setActiveSidebarSection: (section: string | null) => void;
  setSelectedWorkspace: (workspace: string) => void;
  updateMCPServers: (servers: IMCPServer[]) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  
  // AI Actions
  setSelectedAIModel: (model: string) => void;
  setAIModelDropdownOpen: (open: boolean) => void;
  updateAvailableAIModels: (models: IAIModel[]) => void;
  
  // Command Actions
  setCurrentCommand: (command: string) => void;
  addToHistory: (command: string) => void;
  navigateHistory: (direction: 'up' | 'down') => void;
  clearCurrentCommand: () => void;
  setNaturalLanguageEnabled: (enabled: boolean) => void;
  setAISuggestionsEnabled: (enabled: boolean) => void;
  
  // Terminal Actions
  updateTerminalContext: (context: Partial<ITerminalContext>) => void;
}

export interface IMCPServer {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  type: string;
  lastConnected?: string;
}

export interface IAIModel {
  id: string;
  name: string;
  displayName: string;
  provider: 'openai' | 'anthropic' | 'google' | 'deepseek' | 'qwen' | 'local';
  type: 'basic' | 'reasoning-low' | 'reasoning-medium' | 'reasoning-high' | 'local';
  available: boolean;
  description?: string;
  contextLength?: number;
  estimatedSpeed?: number;
}

export interface ITerminalContext {
  workingDirectory: string;
  gitBranch: string | null;
  gitStatus: string | null;
  shell: string;
  projectType?: string;
}

export const useUIStore = create<IUIState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    isSidebarCollapsed: false,
    activeSidebarSection: null,
    selectedWorkspace: 'Personal',
    
    // AI Model state
    selectedAIModel: 'auto-claude-sonnet',
    availableAIModels: [
      {
        id: 'auto-claude-sonnet',
        name: 'auto',
        displayName: 'auto (Claude 4 sonnet)',
        provider: 'anthropic',
        type: 'reasoning-medium',
        available: true,
        description: 'Intelligent model selection',
        contextLength: 200000,
        estimatedSpeed: 45,
      },
      {
        id: 'gpt-4o-basic',
        name: 'gpt-4o',
        displayName: 'gpt-4o (basic model)',
        provider: 'openai',
        type: 'basic',
        available: true,
        contextLength: 128000,
        estimatedSpeed: 50,
      },
      {
        id: 'gpt-4o-reasoning-low',
        name: 'gpt-4o',
        displayName: 'gpt-4o (low reasoning)',
        provider: 'openai',
        type: 'reasoning-low',
        available: true,
        contextLength: 128000,
        estimatedSpeed: 45,
      },
      {
        id: 'gpt-4o-reasoning-medium',
        name: 'gpt-4o',
        displayName: 'gpt-4o (medium reasoning)',
        provider: 'openai',
        type: 'reasoning-medium',
        available: true,
        contextLength: 128000,
        estimatedSpeed: 40,
      },
      {
        id: 'gpt-4o-reasoning-high',
        name: 'gpt-4o',
        displayName: 'gpt-4o (high reasoning)',
        provider: 'openai',
        type: 'reasoning-high',
        available: true,
        contextLength: 128000,
        estimatedSpeed: 30,
      },
      {
        id: 'claude-4-sonnet',
        name: 'claude-4-sonnet',
        displayName: 'claude 4 sonnet',
        provider: 'anthropic',
        type: 'reasoning-medium',
        available: true,
        contextLength: 200000,
        estimatedSpeed: 45,
      },
      {
        id: 'claude-4-opus',
        name: 'claude-4-opus',
        displayName: 'claude 4 opus',
        provider: 'anthropic',
        type: 'reasoning-high',
        available: true,
        contextLength: 200000,
        estimatedSpeed: 25,
      },
      {
        id: 'claude-4.1-opus',
        name: 'claude-4.1-opus',
        displayName: 'claude 4.1 opus',
        provider: 'anthropic',
        type: 'reasoning-high',
        available: true,
        contextLength: 200000,
        estimatedSpeed: 30,
      },
      {
        id: 'o1-mini',
        name: 'o1-mini',
        displayName: 'o1-mini',
        provider: 'openai',
        type: 'reasoning-high',
        available: true,
        contextLength: 128000,
        estimatedSpeed: 20,
      },
      {
        id: 'o1',
        name: 'o1',
        displayName: 'o1',
        provider: 'openai',
        type: 'reasoning-high',
        available: true,
        contextLength: 128000,
        estimatedSpeed: 15,
      },
      {
        id: 'o3',
        name: 'o3',
        displayName: 'o3',
        provider: 'openai',
        type: 'reasoning-high',
        available: true,
        contextLength: 128000,
        estimatedSpeed: 10,
      },
      {
        id: 'gemini-2.5-pro',
        name: 'gemini-2.5-pro',
        displayName: 'gemini 2.5 pro',
        provider: 'google',
        type: 'reasoning-medium',
        available: true,
        contextLength: 1000000,
        estimatedSpeed: 40,
      },
      {
        id: 'gpt-oss-120b-local',
        name: 'gpt-oss-120b',
        displayName: 'GPT-OSS-120B (Local)',
        provider: 'local',
        type: 'local',
        available: false,
        description: 'High-quality local model',
        contextLength: 8192,
        estimatedSpeed: 15,
      },
      {
        id: 'gpt-oss-20b-local',
        name: 'gpt-oss-20b',
        displayName: 'GPT-OSS-20B (Local)',
        provider: 'local',
        type: 'local',
        available: false,
        description: 'Fast local model',
        contextLength: 4096,
        estimatedSpeed: 60,
      },
    ],
    aiModelDropdownOpen: false,
    
    // Command Input state
    currentCommand: '',
    commandHistory: [],
    historyIndex: -1,
    naturalLanguageEnabled: true,
    aiSuggestionsEnabled: true,
    
    // Terminal state
    workingDirectory: '~/Documents/GitHub/portal',
    gitBranch: 'main',
    gitStatus: 'clean',
    
    mcpServers: [
      {
        id: 'context7',
        name: 'Context7',
        status: 'connected',
        type: 'Documentation',
        lastConnected: new Date().toISOString(),
      },
      {
        id: 'memory-bank',
        name: 'Memory Bank',
        status: 'connected',
        type: 'Persistent Context',
        lastConnected: new Date().toISOString(),
      },
      {
        id: 'filesystem',
        name: 'Filesystem',
        status: 'connected',
        type: 'Project-aware',
        lastConnected: new Date().toISOString(),
      },
      {
        id: 'github',
        name: 'GitHub Integration',
        status: 'connected',
        type: 'Repository',
        lastConnected: new Date().toISOString(),
      },
      {
        id: 'health-monitor',
        name: 'Health Monitor',
        status: 'connected',
        type: 'System Health',
        lastConnected: new Date().toISOString(),
      },
      {
        id: 'tool-discovery',
        name: 'Tool Discovery',
        status: 'connected',
        type: 'Auto-detection',
        lastConnected: new Date().toISOString(),
      },
      {
        id: 'resource-access',
        name: 'Resource Access',
        status: 'connected',
        type: 'Project Resources',
        lastConnected: new Date().toISOString(),
      },
      {
        id: 'workflow-engine',
        name: 'Workflow Engine',
        status: 'connected',
        type: 'Automation',
        lastConnected: new Date().toISOString(),
      },
    ],
    theme: 'dark',
    
    // Actions
    toggleSidebar: () => set((state) => ({ 
      isSidebarCollapsed: !state.isSidebarCollapsed,
      activeSidebarSection: state.isSidebarCollapsed ? state.activeSidebarSection : null,
    })),
    
    setSidebarCollapsed: (collapsed: boolean) => set({ 
      isSidebarCollapsed: collapsed,
      activeSidebarSection: collapsed ? null : get().activeSidebarSection,
    }),
    
    setActiveSidebarSection: (section: string | null) => set((state) => ({
      activeSidebarSection: state.activeSidebarSection === section ? null : section,
    })),
    
    setSelectedWorkspace: (workspace: string) => set({ selectedWorkspace: workspace }),
    
    updateMCPServers: (servers: IMCPServer[]) => set({ mcpServers: servers }),
    
    setTheme: (theme: 'dark' | 'light') => set({ theme }),
    
    // AI Actions
    setSelectedAIModel: (model: string) => set({ selectedAIModel: model }),
    
    setAIModelDropdownOpen: (open: boolean) => set({ aiModelDropdownOpen: open }),
    
    updateAvailableAIModels: (models: IAIModel[]) => set({ availableAIModels: models }),
    
    // Command Actions
    setCurrentCommand: (command: string) => set({ 
      currentCommand: command,
      historyIndex: -1, // Reset history navigation when typing
    }),
    
    addToHistory: (command: string) => {
      if (!command.trim()) return;
      
      set((state) => ({
        commandHistory: [
          ...state.commandHistory.filter(cmd => cmd !== command), // Remove duplicate
          command, // Add to end
        ].slice(-100), // Keep only last 100 commands
        historyIndex: -1,
        currentCommand: '',
      }));
    },
    
    navigateHistory: (direction: 'up' | 'down') => {
      const state = get();
      const { commandHistory, historyIndex } = state;
      
      if (commandHistory.length === 0) return;
      
      let newIndex = historyIndex;
      
      if (direction === 'up') {
        newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
      } else {
        newIndex = historyIndex === -1 ? -1 : Math.min(commandHistory.length - 1, historyIndex + 1);
        if (newIndex === commandHistory.length - 1 && historyIndex === commandHistory.length - 1) {
          newIndex = -1; // Go back to empty
        }
      }
      
      set({
        historyIndex: newIndex,
        currentCommand: newIndex === -1 ? '' : commandHistory[newIndex],
      });
    },
    
    clearCurrentCommand: () => set({ 
      currentCommand: '',
      historyIndex: -1,
    }),
    
    setNaturalLanguageEnabled: (enabled: boolean) => set({ naturalLanguageEnabled: enabled }),
    
    setAISuggestionsEnabled: (enabled: boolean) => set({ aiSuggestionsEnabled: enabled }),
    
    // Terminal Actions
    updateTerminalContext: (context: Partial<ITerminalContext>) => set((state) => ({
      workingDirectory: context.workingDirectory ?? state.workingDirectory,
      gitBranch: context.gitBranch ?? state.gitBranch,
      gitStatus: context.gitStatus ?? state.gitStatus,
    })),
  }))
);

// Selectors for better performance
export const selectSidebarState = (state: IUIState) => ({
  isCollapsed: state.isSidebarCollapsed,
  activeSection: state.activeSidebarSection,
});

export const selectWorkspaceState = (state: IUIState) => ({
  selectedWorkspace: state.selectedWorkspace,
});

export const selectMCPState = (state: IUIState) => ({
  servers: state.mcpServers,
  connectedCount: state.mcpServers.filter(s => s.status === 'connected').length,
  totalCount: state.mcpServers.length,
});

export const selectAIState = (state: IUIState) => ({
  selectedModel: state.selectedAIModel,
  availableModels: state.availableAIModels,
  dropdownOpen: state.aiModelDropdownOpen,
  naturalLanguageEnabled: state.naturalLanguageEnabled,
  aiSuggestionsEnabled: state.aiSuggestionsEnabled,
});

export const selectCommandState = (state: IUIState) => ({
  currentCommand: state.currentCommand,
  commandHistory: state.commandHistory,
  historyIndex: state.historyIndex,
  hasHistory: state.commandHistory.length > 0,
});

export const selectTerminalContext = (state: IUIState) => ({
  workingDirectory: state.workingDirectory,
  gitBranch: state.gitBranch,
  gitStatus: state.gitStatus,
  displayDirectory: state.workingDirectory.replace(process.env.HOME || '~', '~'),
});