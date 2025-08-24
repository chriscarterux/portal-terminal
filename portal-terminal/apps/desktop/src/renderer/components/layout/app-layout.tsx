import React from 'react';
import { Menu, X } from 'lucide-react';
import { useUIStore, selectSidebarState } from '../../stores/ui-store';
import { Button } from '../ui/button';
import { Sidebar } from './sidebar';
import { MainContent } from './main-content';

export interface IAppLayoutProps {
  children?: React.ReactNode;
  showWelcomeScreen?: boolean;
  onStartTerminal?: () => void;
}

export const AppLayout: React.FC<IAppLayoutProps> = ({ 
  children, 
  showWelcomeScreen = true,
  onStartTerminal
}) => {
  const { isCollapsed } = useUIStore(selectSidebarState);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);

  return (
    <div className="flex h-full bg-portal-secondary">
      {/* Sidebar */}
      <div className={`transition-all duration-300 ${isCollapsed ? 'w-12' : 'w-64'}`}>
        <Sidebar />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar with Toggle Button */}
        <div className="h-12 border-b border-portal-border bg-portal-secondary flex items-center px-4">
          <Button
            variant="ghost"
            size="sm"
            icon={isCollapsed ? Menu : X}
            onClick={toggleSidebar}
            className="mr-4"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          />
          
          {/* Breadcrumb or Title Area */}
          <div className="flex-1">
            <span className="text-sm font-medium text-portal-text">
              Portal Terminal
            </span>
          </div>
          
          {/* Right side actions could go here */}
          <div className="flex items-center space-x-2">
            {/* Status indicators */}
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