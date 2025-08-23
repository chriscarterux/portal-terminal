import React from 'react';
import { LucideIcon, ChevronDown, ChevronRight } from 'lucide-react';

export interface ISidebarSectionProps {
  title: string;
  icon?: LucideIcon;
  isCollapsible?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
  children?: React.ReactNode;
  className?: string;
}

export const SidebarSection: React.FC<ISidebarSectionProps> = ({
  title,
  icon: Icon,
  isCollapsible = false,
  isExpanded = true,
  onToggle,
  children,
  className = '',
}) => {
  const handleToggle = () => {
    if (isCollapsible && onToggle) {
      onToggle();
    }
  };

  return (
    <div className={`mb-4 ${className}`}>
      <div
        className={`flex items-center justify-between px-3 py-2 text-xs font-semibold text-portal-muted uppercase tracking-wider ${
          isCollapsible ? 'cursor-pointer hover:text-portal-text transition-colors' : ''
        }`}
        onClick={handleToggle}
        role={isCollapsible ? 'button' : 'heading'}
        tabIndex={isCollapsible ? 0 : undefined}
        onKeyDown={isCollapsible ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggle();
          }
        } : undefined}
      >
        <div className="flex items-center">
          {Icon && <Icon className="w-4 h-4 mr-2" />}
          <span>{title}</span>
        </div>
        {isCollapsible && (
          <div className="transition-transform duration-150">
            {isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </div>
        )}
      </div>
      
      {(!isCollapsible || isExpanded) && (
        <div className="space-y-1 animate-fade-in">
          {children}
        </div>
      )}
    </div>
  );
};