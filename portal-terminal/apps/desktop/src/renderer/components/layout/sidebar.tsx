import React, { useState } from 'react';
import {
  Plus,
  User,
  ChevronDown,
  Server,
  Shield,
  Lightbulb,
  Workflow,
  Trash2,
  Activity,
  Circle,
  AlertCircle,
  XCircle
} from 'lucide-react';
import { useUIStore, selectSidebarState, selectMCPState } from '../../stores/ui-store';
import { Button } from '../ui/button';
import { SidebarSection } from './sidebar-section';

export interface ISidebarProps {
  className?: string;
}

export const Sidebar: React.FC<ISidebarProps> = ({ className = '' }) => {
  const { isCollapsed } = useUIStore(selectSidebarState);
  const { servers, connectedCount, totalCount } = useUIStore(selectMCPState);
  const selectedWorkspace = useUIStore((state) => state.selectedWorkspace);
  const setSelectedWorkspace = useUIStore((state) => state.setSelectedWorkspace);
  
  const [expandedSections, setExpandedSections] = useState({
    personal: true,
    mcpServers: true,
    rules: false,
    starterPrompts: false,
    starterWorkflows: false,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const starterPrompts = [
    "Fix bugs in my current directory",
    "Explain how this code works", 
    "Optimize this function",
    "Add error handling",
    "Write unit tests",
    "Refactor for better readability",
    "Add TypeScript types"
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <Circle className="w-2 h-2 fill-green-500 text-green-500" />;
      case 'error':
        return <XCircle className="w-2 h-2 fill-red-500 text-red-500" />;
      default:
        return <AlertCircle className="w-2 h-2 fill-yellow-500 text-yellow-500" />;
    }
  };

  if (isCollapsed) {
    return (
      <div className={`w-12 bg-portal-secondary border-r border-portal-border flex flex-col items-center py-4 ${className}`}>
        <Button
          variant="ghost"
          size="sm"
          icon={Plus}
          className="mb-4 w-8 h-8 p-0"
          title="Create team"
        />
        <Button
          variant="ghost" 
          size="sm"
          icon={User}
          className="w-8 h-8 p-0"
          title="Personal workspace"
        />
      </div>
    );
  }

  return (
    <div className={`w-64 bg-portal-secondary border-r border-portal-border flex flex-col ${className}`}>
      {/* Create Team Button */}
      <div className="p-4 border-b border-portal-border">
        <Button
          variant="primary"
          icon={Plus}
          fullWidth
          className="justify-center"
        >
          Create team
        </Button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-portal-border">
        <div className="p-4 space-y-2">
          
          {/* Personal Workspace Dropdown */}
          <SidebarSection
            title="Personal"
            icon={User}
            isCollapsible={true}
            isExpanded={expandedSections.personal}
            onToggle={() => toggleSection('personal')}
          >
            <div className="space-y-1 ml-6">
              <button 
                className="nav-item nav-item-active w-full text-left"
                onClick={() => setSelectedWorkspace('Personal')}
              >
                {selectedWorkspace}
              </button>
            </div>
          </SidebarSection>

          {/* MCP Servers */}
          <SidebarSection
            title="MCP Servers"
            icon={Server}
            isCollapsible={true}
            isExpanded={expandedSections.mcpServers}
            onToggle={() => toggleSection('mcpServers')}
          >
            <div className="space-y-1 ml-6">
              <div className="text-xs text-portal-muted mb-2">
                {connectedCount}/{totalCount} connected
              </div>
              {servers.map((server) => (
                <div 
                  key={server.id}
                  className="flex items-center justify-between py-1.5 px-2 rounded text-sm text-portal-text hover:bg-portal-surface/50 transition-colors"
                >
                  <div className="flex items-center">
                    {getStatusIcon(server.status)}
                    <span className="ml-2 truncate">{server.name}</span>
                  </div>
                  <span className="text-xs text-portal-muted">{server.type}</span>
                </div>
              ))}
            </div>
          </SidebarSection>

          {/* Rules */}
          <SidebarSection
            title="Rules"
            icon={Shield}
            isCollapsible={true}
            isExpanded={expandedSections.rules}
            onToggle={() => toggleSection('rules')}
          >
            <div className="space-y-1 ml-6">
              <button className="nav-item nav-item-inactive w-full text-left">
                Command validation
              </button>
              <button className="nav-item nav-item-inactive w-full text-left">
                Security policies
              </button>
              <button className="nav-item nav-item-inactive w-full text-left">
                Custom rules
              </button>
            </div>
          </SidebarSection>

          {/* Starter Prompts */}
          <SidebarSection
            title="Starter prompts"
            icon={Lightbulb}
            isCollapsible={true}
            isExpanded={expandedSections.starterPrompts}
            onToggle={() => toggleSection('starterPrompts')}
          >
            <div className="space-y-1 ml-6">
              {starterPrompts.map((prompt, index) => (
                <button
                  key={index}
                  className="nav-item nav-item-inactive w-full text-left truncate"
                  title={prompt}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </SidebarSection>

          {/* Starter Workflows */}
          <SidebarSection
            title="Starter workflows"
            icon={Workflow}
            isCollapsible={true}
            isExpanded={expandedSections.starterWorkflows}
            onToggle={() => toggleSection('starterWorkflows')}
          >
            <div className="space-y-1 ml-6">
              <button className="nav-item nav-item-inactive w-full text-left">
                Setup new project
              </button>
              <button className="nav-item nav-item-inactive w-full text-left">
                Deploy to production
              </button>
              <button className="nav-item nav-item-inactive w-full text-left">
                Run test suite
              </button>
              <button className="nav-item nav-item-inactive w-full text-left">
                Database migration
              </button>
            </div>
          </SidebarSection>

        </div>
      </div>

      {/* Footer - Trash */}
      <div className="p-4 border-t border-portal-border">
        <button className="nav-item nav-item-inactive w-full">
          <Trash2 className="w-4 h-4 mr-2" />
          Trash
        </button>
      </div>
    </div>
  );
};