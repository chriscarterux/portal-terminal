import React, { useState, useEffect } from 'react';
import { SparklesIcon, CommandLineIcon, LightBulbIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useUIStore, selectAIState, selectTerminalContext, selectMCPState } from '../stores/ui-store';

interface AISuggestion {
  id: string;
  type: 'completion' | 'explanation' | 'correction' | 'alternative';
  text: string;
  confidence: number;
  icon?: React.ReactNode;
  metadata?: {
    provider?: string;
    responseTime?: number;
    fromMCP?: boolean;
  };
}

interface AISuggestionsListProps {
  command: string;
  onSuggestionSelect: (suggestion: string) => void;
  onClose: () => void;
  className?: string;
}

export const AISuggestionsList: React.FC<AISuggestionsListProps> = ({
  command,
  onSuggestionSelect,
  onClose,
  className = '',
}) => {
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { selectedModel, availableModels } = useUIStore(selectAIState);
  const { workingDirectory, gitBranch } = useUIStore(selectTerminalContext);
  const { connectedCount } = useUIStore(selectMCPState);

  const selectedModelData = availableModels.find(m => m.id === selectedModel);

  // Generate suggestions when command changes
  useEffect(() => {
    if (!command.trim()) {
      setSuggestions([]);
      return;
    }

    const generateSuggestions = async () => {
      setLoading(true);
      
      try {
        // Simulate AI suggestion generation (replace with actual implementation)
        const mockSuggestions = await generateMockSuggestions(command, {
          workingDirectory,
          gitBranch,
          connectedMCPCount: connectedCount,
          selectedModel: selectedModelData?.name || 'auto',
        });
        
        setSuggestions(mockSuggestions);
        setSelectedIndex(0);
      } catch (error) {
        console.error('Failed to generate suggestions:', error);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    };

    // Debounce suggestion generation
    const timeoutId = setTimeout(generateSuggestions, 300);
    return () => clearTimeout(timeoutId);
  }, [command, workingDirectory, gitBranch, connectedCount, selectedModelData]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!suggestions.length) return;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(0, prev - 1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(suggestions.length - 1, prev + 1));
          break;
        case 'Tab':
        case 'Enter':
          e.preventDefault();
          if (suggestions[selectedIndex]) {
            onSuggestionSelect(suggestions[selectedIndex].text);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [suggestions, selectedIndex, onSuggestionSelect, onClose]);

  const getSuggestionIcon = (type: AISuggestion['type']) => {
    switch (type) {
      case 'completion':
        return <CommandLineIcon className="w-4 h-4 text-portal-primary" />;
      case 'explanation':
        return <SparklesIcon className="w-4 h-4 text-blue-400" />;
      case 'correction':
        return <ExclamationTriangleIcon className="w-4 h-4 text-yellow-400" />;
      case 'alternative':
        return <LightBulbIcon className="w-4 h-4 text-green-400" />;
      default:
        return <SparklesIcon className="w-4 h-4 text-portal-text-secondary" />;
    }
  };

  const getTypeLabel = (type: AISuggestion['type']) => {
    switch (type) {
      case 'completion':
        return 'Complete';
      case 'explanation':
        return 'Explain';
      case 'correction':
        return 'Fix';
      case 'alternative':
        return 'Alternative';
      default:
        return 'Suggestion';
    }
  };

  if (!command.trim() || (!loading && !suggestions.length)) {
    return null;
  }

  return (
    <div className={`bg-portal-card border border-portal-border rounded-xl shadow-xl 
                     backdrop-blur-sm max-w-2xl ${className}`}>
      
      {/* Header */}
      <div className="px-4 py-3 border-b border-portal-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SparklesIcon className="w-4 h-4 text-portal-primary" />
            <span className="text-sm font-medium text-portal-text-primary">
              AI Suggestions
            </span>
            {selectedModelData && (
              <span className="text-xs px-2 py-0.5 bg-portal-primary/10 text-portal-primary rounded-full">
                {selectedModelData.displayName}
              </span>
            )}
          </div>
          
          {connectedCount > 0 && (
            <div className="flex items-center gap-1 text-xs text-portal-text-secondary">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span>{connectedCount} MCP servers connected</span>
            </div>
          )}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="px-4 py-6 text-center">
          <div className="flex items-center justify-center gap-2 text-portal-text-secondary">
            <SparklesIcon className="w-4 h-4 animate-spin" />
            <span className="text-sm">Generating suggestions...</span>
          </div>
        </div>
      )}

      {/* Suggestions List */}
      {!loading && suggestions.length > 0 && (
        <div className="max-h-80 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.id}
              onClick={() => onSuggestionSelect(suggestion.text)}
              className={`w-full px-4 py-3 text-left hover:bg-portal-muted/20 transition-colors
                         border-l-2 ${
                           index === selectedIndex
                             ? 'bg-portal-primary/5 border-portal-primary'
                             : 'border-transparent'
                         }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {getSuggestionIcon(suggestion.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-portal-text-secondary uppercase tracking-wide">
                      {getTypeLabel(suggestion.type)}
                    </span>
                    
                    <div className="flex items-center gap-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        suggestion.confidence > 0.8 ? 'bg-green-400' :
                        suggestion.confidence > 0.6 ? 'bg-yellow-400' :
                        'bg-red-400'
                      }`} />
                      <span className="text-xs text-portal-text-muted">
                        {Math.round(suggestion.confidence * 100)}% confidence
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-sm text-portal-text-primary font-mono break-words">
                    {suggestion.text}
                  </div>
                  
                  {suggestion.metadata && (
                    <div className="flex items-center gap-2 mt-1 text-xs text-portal-text-muted">
                      {suggestion.metadata.provider && (
                        <span>via {suggestion.metadata.provider}</span>
                      )}
                      {suggestion.metadata.responseTime && (
                        <span>• {suggestion.metadata.responseTime}ms</span>
                      )}
                      {suggestion.metadata.fromMCP && (
                        <span>• Enhanced by MCP</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Footer */}
      {!loading && suggestions.length > 0 && (
        <div className="px-4 py-2 border-t border-portal-border text-xs text-portal-text-muted">
          <div className="flex items-center justify-between">
            <span>Use ↑↓ to navigate, Tab/Enter to select</span>
            <span>{selectedIndex + 1} of {suggestions.length}</span>
          </div>
        </div>
      )}

      {/* No Suggestions */}
      {!loading && suggestions.length === 0 && (
        <div className="px-4 py-6 text-center text-portal-text-secondary">
          <SparklesIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No suggestions available</p>
          <p className="text-xs mt-1">Try a different command or check your AI model configuration</p>
        </div>
      )}
    </div>
  );
};

// Mock suggestion generator (replace with actual AI integration)
async function generateMockSuggestions(
  command: string,
  context: {
    workingDirectory?: string;
    gitBranch?: string | null;
    connectedMCPCount: number;
    selectedModel: string;
  }
): Promise<AISuggestion[]> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
  
  const suggestions: AISuggestion[] = [];
  const lowerCommand = command.toLowerCase();
  
  // Git command suggestions
  if (lowerCommand.includes('git')) {
    if (lowerCommand.includes('git st') || lowerCommand === 'git s') {
      suggestions.push({
        id: 'git-status',
        type: 'completion',
        text: 'git status',
        confidence: 0.95,
        metadata: { provider: context.selectedModel, responseTime: 120 },
      });
    }
    
    if (lowerCommand.includes('git co') || lowerCommand.includes('git check')) {
      suggestions.push({
        id: 'git-checkout',
        type: 'completion',
        text: `git checkout ${context.gitBranch === 'main' ? 'develop' : 'main'}`,
        confidence: 0.85,
        metadata: { provider: context.selectedModel, responseTime: 150, fromMCP: true },
      });
    }
    
    if (lowerCommand.includes('commit') && !lowerCommand.includes('-m')) {
      suggestions.push({
        id: 'git-commit-msg',
        type: 'completion',
        text: 'git commit -m "feat: add new feature"',
        confidence: 0.8,
        metadata: { provider: context.selectedModel, responseTime: 180 },
      });
    }
  }
  
  // NPM/Package manager suggestions
  if (lowerCommand.includes('npm') || lowerCommand.includes('install')) {
    if (lowerCommand === 'npm i' || lowerCommand === 'npm ins') {
      suggestions.push({
        id: 'npm-install',
        type: 'completion',
        text: 'npm install',
        confidence: 0.9,
        metadata: { provider: context.selectedModel, responseTime: 100 },
      });
    }
    
    if (lowerCommand.includes('run')) {
      suggestions.push({
        id: 'npm-run-dev',
        type: 'completion',
        text: 'npm run dev',
        confidence: 0.85,
        metadata: { provider: context.selectedModel, responseTime: 130 },
      });
    }
  }
  
  // File operations
  if (lowerCommand.includes('ls') || lowerCommand.includes('list')) {
    suggestions.push({
      id: 'ls-la',
      type: 'completion',
      text: 'ls -la',
      confidence: 0.8,
      metadata: { provider: context.selectedModel, responseTime: 90 },
    });
  }
  
  // Directory navigation
  if (lowerCommand.includes('cd') && lowerCommand.length <= 4) {
    suggestions.push({
      id: 'cd-back',
      type: 'completion',
      text: 'cd ..',
      confidence: 0.75,
      metadata: { provider: context.selectedModel, responseTime: 80 },
    });
    
    suggestions.push({
      id: 'cd-home',
      type: 'completion',
      text: 'cd ~',
      confidence: 0.7,
      metadata: { provider: context.selectedModel, responseTime: 85 },
    });
  }
  
  // Natural language queries
  if (lowerCommand.includes('how') || lowerCommand.includes('what') || lowerCommand.includes('explain')) {
    suggestions.push({
      id: 'explain-command',
      type: 'explanation',
      text: `Let me explain what "${command}" means and show you examples`,
      confidence: 0.85,
      metadata: { provider: context.selectedModel, responseTime: 250, fromMCP: context.connectedMCPCount > 0 },
    });
  }
  
  // Error corrections
  if (lowerCommand.includes('sl ') || lowerCommand.includes('ks ')) {
    suggestions.push({
      id: 'typo-fix',
      type: 'correction',
      text: command.replace('sl ', 'ls ').replace('ks ', 'ls '),
      confidence: 0.9,
      metadata: { provider: context.selectedModel, responseTime: 60 },
    });
  }
  
  // Add some generic alternatives for any command
  if (suggestions.length > 0 && Math.random() > 0.5) {
    suggestions.push({
      id: 'alternative',
      type: 'alternative',
      text: `${command} --help`,
      confidence: 0.6,
      metadata: { provider: context.selectedModel, responseTime: 110 },
    });
  }
  
  return suggestions.sort((a, b) => b.confidence - a.confidence);
}