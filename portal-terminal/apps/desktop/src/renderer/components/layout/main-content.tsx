import React from 'react';
import { Download, Code2, Rocket, MoreHorizontal } from 'lucide-react';
import { ActionCard } from '../ui/action-card';

export interface IMainContentProps {
  className?: string;
  onStartTerminal?: () => void;
}

export const MainContent: React.FC<IMainContentProps> = ({ 
  className = '', 
  onStartTerminal 
}) => {
  const handleInstallClick = () => {
    onStartTerminal?.();
    // TODO: Implement install action with terminal
    console.log('Install clicked - starting terminal');
  };

  const handleCodeClick = () => {
    onStartTerminal?.();
    // TODO: Implement code action with terminal
    console.log('Code clicked - starting terminal');
  };

  const handleDeployClick = () => {
    onStartTerminal?.();
    // TODO: Implement deploy action with terminal
    console.log('Deploy clicked - starting terminal');
  };

  const handleMoreClick = () => {
    onStartTerminal?.();
    // TODO: Implement more actions with terminal
    console.log('Something else clicked - starting terminal');
  };

  return (
    <div className={`flex-1 flex flex-col bg-portal-secondary ${className}`}>
      {/* Header */}
      <div className="border-b border-portal-border p-6">
        <h1 className="text-2xl font-semibold text-portal-text mb-2">
          Hey there!
        </h1>
        <p className="text-portal-muted">
          Welcome to Portal Terminal. Choose an action below to get started with your AI-powered development workflow.
        </p>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6">
        <div className="max-w-4xl mx-auto">
          {/* Action Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ActionCard
              title="Install"
              description="Set up dependencies, packages, and tools for your project with intelligent suggestions"
              icon={Download}
              onClick={handleInstallClick}
            />
            
            <ActionCard
              title="Code"
              description="Start coding with AI assistance, intelligent completions, and context-aware suggestions"
              icon={Code2}
              onClick={handleCodeClick}
            />
            
            <ActionCard
              title="Deploy"
              description="Deploy your application with automated workflows and best practices guidance"
              icon={Rocket}
              onClick={handleDeployClick}
            />
            
            <ActionCard
              title="Something else?"
              description="Explore other capabilities like debugging, testing, documentation, and more"
              icon={MoreHorizontal}
              onClick={handleMoreClick}
            />
          </div>

          {/* Additional Info */}
          <div className="mt-12 text-center">
            <div className="card p-6 max-w-2xl mx-auto">
              <h3 className="text-lg font-medium text-portal-text mb-3">
                🚀 AI-Powered Terminal Experience
              </h3>
              <p className="text-portal-muted text-sm leading-relaxed">
                Portal Terminal combines the power of local AI models with MCP integration 
                to provide intelligent assistance while keeping your data private. Get started 
                by selecting an action above or use the command palette (⌘+K) for quick access.
              </p>
              <div className="flex items-center justify-center mt-4 space-x-4 text-xs text-portal-muted">
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  AI Ready
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  8 MCP Servers Connected
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  Privacy-First Design
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};