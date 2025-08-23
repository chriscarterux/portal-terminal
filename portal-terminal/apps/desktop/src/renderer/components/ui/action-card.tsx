import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface IActionCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  onClick?: () => void;
  className?: string;
}

export const ActionCard: React.FC<IActionCardProps> = ({
  title,
  description,
  icon: Icon,
  onClick,
  className = '',
}) => {
  return (
    <div
      className={`action-card ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : 'presentation'}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      } : undefined}
    >
      <Icon className="action-card-icon" />
      <h3 className="text-lg font-semibold text-portal-text mb-2">
        {title}
      </h3>
      <p className="text-portal-muted text-sm leading-relaxed">
        {description}
      </p>
    </div>
  );
};