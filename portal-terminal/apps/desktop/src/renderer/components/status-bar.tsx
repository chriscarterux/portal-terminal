import React, { useState, useEffect } from 'react';
import { MCPStatus } from './mcp-status';

interface IStatusBarProps {
  terminalId: string | null;
  className?: string;
}

interface ISystemStatus {
  terminal: { status: string; commands: number };
  ai: { enabled: boolean; suggestions: number; responseTime?: number };
  mcp: { enabled: boolean; servers: number };
  performance: {
    commandCount: number;
    averageResponseTime: number;
    aiSuggestionUsage: number;
    errorRate: number;
    uptime: number;
  };
  context: {
    workingDirectory: string;
    shellType: string;
    gitContext?: {
      branch: string;
      status: string;
    };
    projectContext?: {
      type: string;
    };
  };
}

export const StatusBar: React.FC<IStatusBarProps> = ({ terminalId, className = '' }) => {
  const [status, setStatus] = useState<ISystemStatus | null>(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!terminalId) return;

    const updateStatus = async () => {
      try {
        const systemStatus = await window.electronAPI.terminal.getSystemStatus(terminalId);
        setStatus(systemStatus);
      } catch (error) {
        console.warn('Failed to get system status:', error);
      }
    };

    updateStatus();
    const interval = setInterval(updateStatus, 5000);
    return () => clearInterval(interval);
  }, [terminalId]);

  if (!status || !isVisible) {
    return (
      <div className={`status-bar minimal ${className}`}>
        <button 
          className="status-toggle"
          onClick={() => setIsVisible(true)}
          title="Show status bar"
        >
          📊
        </button>
      </div>
    );
  }

  const formatUptime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  const getWorkingDirDisplay = () => {
    const wd = status.context.workingDirectory;
    const parts = wd.split('/');
    if (parts.length > 3) {
      return `.../${parts.slice(-2).join('/')}`;
    }
    return wd;
  };

  const getPerformanceColor = () => {
    if (status.performance.errorRate > 10) return '#ff6b6b';
    if (status.performance.averageResponseTime > 2000) return '#ffd93d';
    return '#00d4aa';
  };

  return (
    <div className={`status-bar ${className}`}>
      <div className="status-left">
        {/* Working Directory */}
        <div className="status-item directory">
          <span className="status-icon">📁</span>
          <span className="status-text" title={status.context.workingDirectory}>
            {getWorkingDirDisplay()}
          </span>
        </div>

        {/* Git Status */}
        {status.context.gitContext && (
          <div className="status-item git">
            <span className="status-icon">🌿</span>
            <span className="status-text">
              {status.context.gitContext.branch}
            </span>
            {status.context.gitContext.status === 'dirty' && (
              <span className="git-dirty">●</span>
            )}
          </div>
        )}

        {/* Project Type */}
        {status.context.projectContext && (
          <div className="status-item project">
            <span className="status-icon">
              {status.context.projectContext.type === 'node' ? '📦' : 
               status.context.projectContext.type === 'python' ? '🐍' :
               status.context.projectContext.type === 'rust' ? '🦀' :
               status.context.projectContext.type === 'go' ? '🐹' : '⚙️'}
            </span>
            <span className="status-text">
              {status.context.projectContext.type}
            </span>
          </div>
        )}
      </div>

      <div className="status-right">
        {/* AI Status */}
        <div className="status-item ai">
          <span className="status-icon">🤖</span>
          <span className="status-text">
            {status.ai.enabled ? 'AI Ready' : 'AI Off'}
          </span>
          {status.ai.enabled && status.ai.responseTime && (
            <span className="status-metric">
              {status.ai.responseTime}ms
            </span>
          )}
        </div>

        {/* MCP Status */}
        <MCPStatus terminalId={terminalId} />

        {/* Performance */}
        <div className="status-item performance">
          <span 
            className="status-icon"
            style={{ color: getPerformanceColor() }}
          >
            ⚡
          </span>
          <span className="status-text">
            {status.performance.commandCount} cmds
          </span>
          <span className="status-metric">
            {status.performance.averageResponseTime}ms avg
          </span>
          {status.performance.errorRate > 0 && (
            <span className="error-rate" style={{ color: '#ff6b6b' }}>
              {status.performance.errorRate}% err
            </span>
          )}
        </div>

        {/* Uptime */}
        <div className="status-item uptime">
          <span className="status-icon">⏱️</span>
          <span className="status-text">
            {formatUptime(status.performance.uptime)}
          </span>
        </div>

        {/* Hide Button */}
        <button 
          className="status-toggle"
          onClick={() => setIsVisible(false)}
          title="Hide status bar"
        >
          ✕
        </button>
      </div>

      <style jsx>{`
        .status-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 4px 16px;
          background: rgba(0, 0, 0, 0.4);
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          font-size: 11px;
          height: 28px;
          backdrop-filter: blur(10px);
        }

        .status-bar.minimal {
          justify-content: flex-end;
          padding: 4px 8px;
        }

        .status-left,
        .status-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .status-item {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 2px 6px;
          border-radius: 3px;
          transition: background 0.2s ease;
        }

        .status-item:hover {
          background: rgba(255, 255, 255, 0.05);
        }

        .status-icon {
          font-size: 11px;
        }

        .status-text {
          color: #e0e0e0;
          white-space: nowrap;
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .status-metric {
          color: #888;
          font-size: 10px;
          margin-left: 4px;
        }

        .git-dirty {
          color: #ffd93d;
          font-size: 8px;
          margin-left: 2px;
        }

        .error-rate {
          font-size: 10px;
          margin-left: 4px;
        }

        .status-toggle {
          background: none;
          border: none;
          color: #888;
          cursor: pointer;
          padding: 2px 4px;
          border-radius: 2px;
          font-size: 10px;
          transition: all 0.2s ease;
        }

        .status-toggle:hover {
          color: #e0e0e0;
          background: rgba(255, 255, 255, 0.1);
        }

        .directory {
          max-width: 200px;
        }

        .git {
          max-width: 150px;
        }

        .performance {
          gap: 2px;
        }

        .ai {
          gap: 3px;
        }
      `}</style>
    </div>
  );
};