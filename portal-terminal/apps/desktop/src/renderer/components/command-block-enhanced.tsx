import React, { useState, useRef } from 'react';
import {
  ClipboardDocumentIcon,
  ShareIcon,
  BookmarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  XMarkIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkSolidIcon } from '@heroicons/react/24/solid';

export interface ICommandBlock {
  id: string;
  command: string;
  output: string;
  exitCode: number;
  startTime: Date;
  endTime?: Date;
  workingDirectory: string;
  
  // AI enhancements
  aiSummary?: string;
  aiSuggestions?: string[];
  errorAnalysis?: {
    diagnosis: string;
    suggestions: string[];
    severity: 'low' | 'medium' | 'high';
  };
  
  // MCP enhancements
  mcpContext?: {
    relevantFiles?: string[];
    relatedCommands?: string[];
    documentation?: string[];
  };
  
  // UI state
  isExpanded?: boolean;
  isBookmarked?: boolean;
}

interface CommandBlockEnhancedProps {
  block: ICommandBlock;
  onToggleExpanded?: (id: string) => void;
  onToggleBookmark?: (id: string) => void;
  onCopyOutput?: (output: string) => void;
  onShareBlock?: (block: ICommandBlock) => void;
  onDeleteBlock?: (id: string) => void;
  className?: string;
}

export const CommandBlockEnhanced: React.FC<CommandBlockEnhancedProps> = ({
  block,
  onToggleExpanded,
  onToggleBookmark,
  onCopyOutput,
  onShareBlock,
  onDeleteBlock,
  className = '',
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);
  
  const executionTime = block.endTime 
    ? block.endTime.getTime() - block.startTime.getTime()
    : Date.now() - block.startTime.getTime();
  
  const isRunning = !block.endTime;
  const hasError = block.exitCode !== 0;
  const hasAIEnhancements = !!(block.aiSummary || block.aiSuggestions?.length || block.errorAnalysis);
  const hasMCPContext = !!(block.mcpContext && Object.keys(block.mcpContext).length > 0);

  const getStatusIcon = () => {
    if (isRunning) {
      return <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />;
    } else if (hasError) {
      return <ExclamationTriangleIcon className="w-4 h-4 text-red-400" />;
    } else {
      return <CheckCircleIcon className="w-4 h-4 text-green-400" />;
    }
  };

  const getStatusText = () => {
    if (isRunning) return 'Running...';
    if (hasError) return `Exited with code ${block.exitCode}`;
    return 'Completed successfully';
  };

  const formatExecutionTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  };

  const handleCopyOutput = async () => {
    try {
      await navigator.clipboard.writeText(block.output);
      onCopyOutput?.(block.output);
      // TODO: Show toast notification
    } catch (error) {
      console.error('Failed to copy output:', error);
    }
  };

  const getSeverityColor = (severity: 'low' | 'medium' | 'high') => {
    switch (severity) {
      case 'low':
        return 'text-yellow-400 bg-yellow-400/10';
      case 'medium':
        return 'text-orange-400 bg-orange-400/10';
      case 'high':
        return 'text-red-400 bg-red-400/10';
      default:
        return 'text-gray-400 bg-gray-400/10';
    }
  };

  return (
    <div
      className={`bg-portal-card border border-portal-border rounded-xl overflow-hidden 
                  transition-all hover:border-portal-border-hover ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Command Header */}
      <div className="flex items-center justify-between p-4 border-b border-portal-border bg-portal-muted/30">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {getStatusIcon()}
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-mono text-portal-text-primary truncate">
                {block.command}
              </span>
              
              {/* AI/MCP Enhancement Indicators */}
              <div className="flex items-center gap-1">
                {hasAIEnhancements && (
                  <div className="flex items-center gap-1 px-1.5 py-0.5 bg-portal-primary/10 
                                  text-portal-primary rounded-full text-xs">
                    <SparklesIcon className="w-3 h-3" />
                    <span>AI</span>
                  </div>
                )}
                
                {hasMCPContext && (
                  <div className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-500/10 
                                  text-blue-400 rounded-full text-xs">
                    <div className="w-2 h-2 bg-blue-400 rounded-full" />
                    <span>MCP</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-4 text-xs text-portal-text-secondary">
              <span>{getStatusText()}</span>
              <span className="flex items-center gap-1">
                <ClockIcon className="w-3 h-3" />
                {formatExecutionTime(executionTime)}
              </span>
              <span>{block.workingDirectory}</span>
              <span>{block.startTime.toLocaleTimeString()}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className={`flex items-center gap-1 transition-opacity ${
          isHovered ? 'opacity-100' : 'opacity-0'
        }`}>
          <button
            onClick={handleCopyOutput}
            className="p-1.5 hover:bg-portal-muted/50 rounded-lg transition-colors"
            title="Copy output"
          >
            <ClipboardDocumentIcon className="w-4 h-4 text-portal-text-secondary" />
          </button>
          
          <button
            onClick={() => onShareBlock?.(block)}
            className="p-1.5 hover:bg-portal-muted/50 rounded-lg transition-colors"
            title="Share block"
          >
            <ShareIcon className="w-4 h-4 text-portal-text-secondary" />
          </button>
          
          <button
            onClick={() => onToggleBookmark?.(block.id)}
            className="p-1.5 hover:bg-portal-muted/50 rounded-lg transition-colors"
            title={block.isBookmarked ? "Remove bookmark" : "Bookmark block"}
          >
            {block.isBookmarked ? (
              <BookmarkSolidIcon className="w-4 h-4 text-portal-primary" />
            ) : (
              <BookmarkIcon className="w-4 h-4 text-portal-text-secondary" />
            )}
          </button>
          
          {block.output && (
            <button
              onClick={() => onToggleExpanded?.(block.id)}
              className="p-1.5 hover:bg-portal-muted/50 rounded-lg transition-colors"
              title={block.isExpanded ? "Collapse" : "Expand"}
            >
              {block.isExpanded ? (
                <ChevronUpIcon className="w-4 h-4 text-portal-text-secondary" />
              ) : (
                <ChevronDownIcon className="w-4 h-4 text-portal-text-secondary" />
              )}
            </button>
          )}
          
          <button
            onClick={() => onDeleteBlock?.(block.id)}
            className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors"
            title="Delete block"
          >
            <XMarkIcon className="w-4 h-4 text-portal-text-secondary hover:text-red-400" />
          </button>
        </div>
      </div>

      {/* AI Summary (if available) */}
      {block.aiSummary && (
        <div className="px-4 py-3 bg-portal-primary/5 border-b border-portal-border">
          <div className="flex items-start gap-2">
            <SparklesIcon className="w-4 h-4 text-portal-primary mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-xs font-medium text-portal-primary mb-1">AI Summary</div>
              <p className="text-sm text-portal-text-primary">{block.aiSummary}</p>
            </div>
          </div>
        </div>
      )}

      {/* Error Analysis (if available) */}
      {block.errorAnalysis && (
        <div className="px-4 py-3 bg-red-500/5 border-b border-portal-border">
          <div className="flex items-start gap-2">
            <ExclamationTriangleIcon className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="text-xs font-medium text-red-400">Error Analysis</div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  getSeverityColor(block.errorAnalysis.severity)
                }`}>
                  {block.errorAnalysis.severity} severity
                </span>
              </div>
              
              <p className="text-sm text-portal-text-primary mb-2">
                {block.errorAnalysis.diagnosis}
              </p>
              
              {block.errorAnalysis.suggestions.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs font-medium text-portal-text-secondary">Suggestions:</div>
                  {block.errorAnalysis.suggestions.map((suggestion, index) => (
                    <div key={index} className="text-sm text-portal-text-primary">
                      • {suggestion}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Command Output */}
      {block.output && (
        <div 
          ref={outputRef}
          className={`px-4 py-3 bg-portal-secondary/50 font-mono text-sm 
                      text-portal-text-primary whitespace-pre-wrap transition-all ${
            block.isExpanded ? 'max-h-none' : 'max-h-32 overflow-hidden'
          }`}
        >
          {block.output}
          
          {/* Fade overlay when collapsed */}
          {!block.isExpanded && block.output.length > 200 && (
            <div className="absolute bottom-0 left-0 right-0 h-8 
                            bg-gradient-to-t from-portal-secondary/50 to-transparent pointer-events-none" />
          )}
        </div>
      )}

      {/* AI Suggestions (if available) */}
      {block.aiSuggestions && block.aiSuggestions.length > 0 && (
        <div className="px-4 py-3 border-t border-portal-border bg-portal-primary/5">
          <div className="flex items-start gap-2">
            <SparklesIcon className="w-4 h-4 text-portal-primary mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-xs font-medium text-portal-primary mb-2">AI Suggestions</div>
              <div className="space-y-1">
                {block.aiSuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    className="text-sm text-portal-text-primary hover:text-portal-primary 
                               text-left block transition-colors"
                    onClick={() => {
                      // TODO: Execute suggestion or copy to input
                    }}
                  >
                    • {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MCP Context (if available) */}
      {block.mcpContext && (
        <div className="px-4 py-3 border-t border-portal-border bg-blue-500/5">
          <div className="flex items-start gap-2">
            <div className="w-4 h-4 bg-blue-400 rounded-full mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-xs font-medium text-blue-400 mb-2">Enhanced Context</div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                {block.mcpContext.relevantFiles && block.mcpContext.relevantFiles.length > 0 && (
                  <div>
                    <div className="font-medium text-portal-text-secondary mb-1">Relevant Files</div>
                    {block.mcpContext.relevantFiles.map((file, index) => (
                      <div key={index} className="text-portal-text-primary truncate">
                        {file}
                      </div>
                    ))}
                  </div>
                )}
                
                {block.mcpContext.relatedCommands && block.mcpContext.relatedCommands.length > 0 && (
                  <div>
                    <div className="font-medium text-portal-text-secondary mb-1">Related Commands</div>
                    {block.mcpContext.relatedCommands.map((cmd, index) => (
                      <button
                        key={index}
                        className="text-portal-text-primary hover:text-blue-400 
                                   text-left block truncate transition-colors"
                        onClick={() => {
                          // TODO: Copy command to input
                        }}
                      >
                        {cmd}
                      </button>
                    ))}
                  </div>
                )}
                
                {block.mcpContext.documentation && block.mcpContext.documentation.length > 0 && (
                  <div>
                    <div className="font-medium text-portal-text-secondary mb-1">Documentation</div>
                    {block.mcpContext.documentation.map((doc, index) => (
                      <div key={index} className="text-portal-text-primary truncate">
                        {doc}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Running Indicator */}
      {isRunning && (
        <div className="px-4 py-2 bg-blue-500/10 border-t border-portal-border">
          <div className="flex items-center gap-2 text-xs text-blue-400">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
            <span>Command is still running...</span>
          </div>
        </div>
      )}
    </div>
  );
};