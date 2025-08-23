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
  
  // UI preferences
  theme: 'dark' | 'light';
  
  // Actions
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setActiveSidebarSection: (section: string | null) => void;
  setSelectedWorkspace: (workspace: string) => void;
  updateMCPServers: (servers: IMCPServer[]) => void;
  setTheme: (theme: 'dark' | 'light') => void;
}

export interface IMCPServer {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  type: string;
  lastConnected?: string;
}

export const useUIStore = create<IUIState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    isSidebarCollapsed: false,
    activeSidebarSection: null,
    selectedWorkspace: 'Personal',
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