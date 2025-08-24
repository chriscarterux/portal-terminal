import React from 'react';
import { MainContent } from './main-content';

export interface ISimpleAppLayoutProps {
  children?: React.ReactNode;
  showWelcomeScreen?: boolean;
  onStartTerminal?: () => void;
}

export const SimpleAppLayout: React.FC<ISimpleAppLayoutProps> = ({ 
  children, 
  showWelcomeScreen = true,
  onStartTerminal
}) => {
  return (
    <div className="flex h-full bg-portal-secondary">
      {/* Simplified - no sidebar for now */}
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Simple Top Bar */}
        <div className="h-12 border-b border-portal-border bg-portal-secondary flex items-center px-4">
          <div className="flex-1">
            <span className="text-sm font-medium text-portal-text">
              Portal Terminal
            </span>
          </div>
          
          {/* Status indicators */}
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1 text-xs text-portal-muted">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>AI Ready</span>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          {showWelcomeScreen ? (
            <MainContent onStartTerminal={onStartTerminal} />
          ) : (
            children || <MainContent onStartTerminal={onStartTerminal} />
          )}
        </div>
      </div>
    </div>
  );
};