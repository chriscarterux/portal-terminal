import React, { useState, useRef, useEffect } from 'react';
import { CommandBlock as CommandBlockModel } from '@portal/terminal-core';

interface ICommandBlockProps {
  block: CommandBlockModel;
  onRerun?: (command: string) => void;
  onAIHelp?: (command: string) => void;
  aiSuggestion?: string;
  mcpContext?: any;
  className?: string;
}

interface IBlockActions {
  rerun: boolean;
  copy: boolean;
  share: boolean;
  aiHelp: boolean;
}

export const CommandBlockComponent: React.FC<ICommandBlockProps> = ({
  block,
  onRerun,
  onAIHelp,
  aiSuggestion,
  mcpContext,
  className = '',
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  const getStatusColor = () => {
    switch (block.status) {
      case 'running': return '#ffd93d';
      case 'completed': return '#00d4aa';
      case 'error': return '#ff6b6b';
      default: return '#636363';
    }
  };

  const getStatusIcon = () => {
    switch (block.status) {
      case 'running': return '⏳';
      case 'completed': return '✓';
      case 'error': return '✗';
      default: return '○';
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(block.command);
  };

  const handleCopyOutput = () => {
    navigator.clipboard.writeText(block.output);
  };

  const handleShare = () => {
    const shareData = {
      command: block.command,
      output: block.output,
      duration: block.duration,
      exitCode: block.exitCode,
    };
    navigator.clipboard.writeText(JSON.stringify(shareData, null, 2));
  };

  const isLongOutput = block.output.length > 1000 || block.output.split('\n').length > 20;

  return (
    <div 
      className={`command-block ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        borderLeft: `3px solid ${getStatusColor()}`,
        background: isHovered ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Command Header */}
      <div className="command-header">
        <div className="command-info">
          <span className="command-status" style={{ color: getStatusColor() }}>
            {getStatusIcon()}
          </span>
          <span className="command-text">
            {block.command}
          </span>
          {block.duration > 0 && (
            <span className="command-duration">
              {formatDuration(block.duration)}
            </span>
          )}
        </div>
        
        <div className="command-actions">
          {isHovered && (
            <>
              <button
                className="action-btn"
                onClick={handleCopyCommand}
                title="Copy command"
              >
                📋
              </button>
              {onRerun && (
                <button
                  className="action-btn"
                  onClick={() => onRerun(block.command)}
                  title="Rerun command"
                >
                  🔄
                </button>
              )}
              {onAIHelp && (
                <button
                  className="action-btn"
                  onClick={() => onAIHelp(block.command)}
                  title="Get AI help"
                >
                  🤖
                </button>
              )}
              <button
                className="action-btn"
                onClick={() => setShowActions(!showActions)}
                title="More actions"
              >
                ⋮
              </button>
            </>
          )}
        </div>
      </div>

      {/* AI Suggestion */}
      {aiSuggestion && (
        <div className="ai-suggestion">
          <div className="ai-suggestion-header">
            🤖 AI Suggestion
          </div>
          <div className="ai-suggestion-content">
            {aiSuggestion}
          </div>
        </div>
      )}

      {/* Command Output */}
      {block.output && (
        <div className="command-output-container">
          <div 
            ref={outputRef}
            className={`command-output ${isLongOutput && !isExpanded ? 'collapsed' : ''}`}
          >
            <pre>{isLongOutput && !isExpanded ? 
              block.output.split('\n').slice(0, 10).join('\n') + '\n...' : 
              block.output
            }</pre>
          </div>
          
          {isLongOutput && (
            <button
              className="expand-btn"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? '📤 Collapse' : '📥 Expand'} ({block.output.split('\n').length} lines)
            </button>
          )}
          
          {isHovered && (
            <button
              className="copy-output-btn"
              onClick={handleCopyOutput}
              title="Copy output"
            >
              📋
            </button>
          )}
        </div>
      )}

      {/* MCP Context (if available) */}
      {mcpContext && isHovered && (
        <div className="mcp-context">
          <div className="mcp-context-header">
            🔗 Available Context
          </div>
          <div className="mcp-context-items">
            {mcpContext.tools?.slice(0, 3).map((tool: any, idx: number) => (
              <span key={idx} className="mcp-tool-tag">
                {tool.name}
              </span>
            ))}
            {mcpContext.tools?.length > 3 && (
              <span className="mcp-more">+{mcpContext.tools.length - 3} more</span>
            )}
          </div>
        </div>
      )}

      {/* Extended Actions Panel */}
      {showActions && (
        <div className="extended-actions">
          <button onClick={handleShare} className="extended-action">
            🔗 Share Block
          </button>
          <button onClick={() => setIsExpanded(!isExpanded)} className="extended-action">
            📊 View Details
          </button>
          {block.status === 'error' && (
            <button onClick={() => onAIHelp?.(block.command)} className="extended-action">
              🔍 Analyze Error
            </button>
          )}
        </div>
      )}

      <style jsx>{`
        .command-block {
          margin: 8px 0;
          padding: 12px 16px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid rgba(255, 255, 255, 0.05);
          position: relative;
        }

        .command-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .command-info {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
        }

        .command-status {
          font-size: 14px;
          width: 16px;
          text-align: center;
        }

        .command-text {
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
          color: #e0e0e0;
          flex: 1;
        }

        .command-duration {
          font-size: 11px;
          color: #888;
          background: rgba(0, 0, 0, 0.3);
          padding: 2px 6px;
          border-radius: 3px;
        }

        .command-actions {
          display: flex;
          gap: 4px;
          opacity: 0;
          transition: opacity 0.2s ease;
        }

        .command-block:hover .command-actions {
          opacity: 1;
        }

        .action-btn {
          background: none;
          border: none;
          color: #888;
          cursor: pointer;
          padding: 4px 6px;
          border-radius: 3px;
          font-size: 12px;
          transition: all 0.2s ease;
        }

        .action-btn:hover {
          color: #e0e0e0;
          background: rgba(255, 255, 255, 0.1);
        }

        .ai-suggestion {
          margin: 8px 0;
          padding: 8px 12px;
          background: rgba(0, 212, 170, 0.1);
          border: 1px solid rgba(0, 212, 170, 0.2);
          border-radius: 6px;
        }

        .ai-suggestion-header {
          font-size: 11px;
          color: #00d4aa;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .ai-suggestion-content {
          font-size: 12px;
          color: #e0e0e0;
          line-height: 1.4;
        }

        .command-output-container {
          position: relative;
        }

        .command-output {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 4px;
          padding: 8px 12px;
          margin: 8px 0;
          position: relative;
        }

        .command-output.collapsed {
          max-height: 200px;
          overflow: hidden;
          position: relative;
        }

        .command-output.collapsed::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 40px;
          background: linear-gradient(transparent, rgba(0, 0, 0, 0.2));
          pointer-events: none;
        }

        .command-output pre {
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          color: #e0e0e0;
          margin: 0;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .expand-btn {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #888;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          cursor: pointer;
          margin-top: 4px;
          transition: all 0.2s ease;
        }

        .expand-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #e0e0e0;
        }

        .copy-output-btn {
          position: absolute;
          top: 8px;
          right: 8px;
          background: rgba(0, 0, 0, 0.7);
          border: none;
          color: #888;
          padding: 4px 6px;
          border-radius: 3px;
          font-size: 11px;
          cursor: pointer;
          opacity: 0;
          transition: all 0.2s ease;
        }

        .command-output-container:hover .copy-output-btn {
          opacity: 1;
        }

        .copy-output-btn:hover {
          color: #e0e0e0;
          background: rgba(0, 0, 0, 0.9);
        }

        .mcp-context {
          margin: 8px 0;
          padding: 8px 12px;
          background: rgba(116, 185, 255, 0.1);
          border: 1px solid rgba(116, 185, 255, 0.2);
          border-radius: 6px;
        }

        .mcp-context-header {
          font-size: 11px;
          color: #74b9ff;
          font-weight: 600;
          margin-bottom: 6px;
        }

        .mcp-context-items {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .mcp-tool-tag {
          background: rgba(116, 185, 255, 0.15);
          color: #74b9ff;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 10px;
          font-family: 'JetBrains Mono', monospace;
        }

        .mcp-more {
          color: #888;
          font-size: 10px;
          font-style: italic;
        }

        .extended-actions {
          display: flex;
          gap: 8px;
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }

        .extended-action {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #888;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .extended-action:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #e0e0e0;
        }
      `}</style>
    </div>
  );
};