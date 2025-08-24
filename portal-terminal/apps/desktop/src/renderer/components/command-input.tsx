import React, { useState, useRef, useEffect } from 'react';
import { ChevronRightIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { useUIStore, selectCommandState, selectTerminalContext, selectAIState } from '../stores/ui-store';
import { AIModelSelector } from './ai-model-selector';
import { AISuggestionsList } from './ai-suggestions-list';

interface CommandInputProps {
  onExecuteCommand?: (command: string) => void;
  className?: string;
}

export const CommandInput: React.FC<CommandInputProps> = ({ 
  onExecuteCommand,
  className = '' 
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const { currentCommand, hasHistory } = useUIStore(selectCommandState);
  const { displayDirectory, gitBranch, gitStatus } = useUIStore(selectTerminalContext);
  const { naturalLanguageEnabled, aiSuggestionsEnabled } = useUIStore(selectAIState);
  
  const {
    setCurrentCommand,
    addToHistory,
    navigateHistory,
    clearCurrentCommand,
  } = useUIStore();

  // Focus input on mount and when command changes
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCurrentCommand(value);
    
    // Show suggestions when typing and AI suggestions are enabled
    if (aiSuggestionsEnabled && value.trim().length > 0) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'Enter':
        if (currentCommand.trim()) {
          addToHistory(currentCommand.trim());
          onExecuteCommand?.(currentCommand.trim());
          setShowSuggestions(false);
        }
        break;
      
      case 'ArrowUp':
        e.preventDefault();
        if (hasHistory) {
          navigateHistory('up');
        }
        break;
      
      case 'ArrowDown':
        e.preventDefault();
        if (hasHistory) {
          navigateHistory('down');
        }
        break;
      
      case 'Escape':
        if (showSuggestions) {
          setShowSuggestions(false);
        } else if (currentCommand) {
          clearCurrentCommand();
        }
        break;

      case 'Tab':
        e.preventDefault();
        // TODO: Implement tab completion
        break;
    }
  };

  const handleSuggestionSelect = (suggestion: string) => {
    setCurrentCommand(suggestion);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const detectNaturalLanguage = (text: string): boolean => {
    if (!naturalLanguageEnabled) return false;
    
    // Simple heuristics for natural language detection
    const naturalLanguagePatterns = [
      /^(how|what|why|when|where|who|can|could|would|should|is|are|do|does|did)/i,
      /\b(please|help|explain|show|tell|find|search|create|make|build|fix|solve)\b/i,
      /[.!?]$/, // Ends with sentence punctuation
      /\b(i|me|my|you|your|we|our|they|them|the|a|an)\s/i, // Common function words
    ];
    
    return naturalLanguagePatterns.some(pattern => pattern.test(text));
  };

  const isNaturalLanguage = detectNaturalLanguage(currentCommand);

  const getGitStatusColor = (status: string | null) => {
    switch (status) {
      case 'clean':
        return 'text-green-400';
      case 'dirty':
        return 'text-yellow-400';
      case 'ahead':
        return 'text-blue-400';
      default:
        return 'text-gray-400';
    }
  };

  const getPlaceholderText = () => {
    if (naturalLanguageEnabled && isNaturalLanguage) {
      return 'Ask me anything about your project...';
    }
    return 'Code, ask, build, or run commands';
  };

  return (
    <div className={`relative ${className}`}>
      {/* Command Input Container */}
      <div className={`flex items-center bg-portal-card border-2 rounded-xl transition-all ${
        isFocused 
          ? 'border-portal-primary shadow-lg shadow-portal-primary/20' 
          : 'border-portal-border hover:border-portal-border-hover'
      }`}>
        
        {/* Terminal Prompt */}
        <div className="flex items-center gap-2 px-4 py-3 text-sm">
          {/* Directory */}
          <span className="text-portal-primary font-medium">
            {displayDirectory}
          </span>
          
          {/* Git Branch */}
          {gitBranch && (
            <>
              <span className="text-portal-text-secondary">on</span>
              <div className="flex items-center gap-1">
                <span className={`font-medium ${getGitStatusColor(gitStatus)}`}>
                  {gitBranch}
                </span>
                {gitStatus && gitStatus !== 'clean' && (
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    gitStatus === 'dirty' ? 'bg-yellow-400' :
                    gitStatus === 'ahead' ? 'bg-blue-400' :
                    'bg-gray-400'
                  }`} />
                )}
              </div>
            </>
          )}
          
          {/* Prompt Character */}
          <ChevronRightIcon className="w-4 h-4 text-portal-text-secondary" />
        </div>

        {/* Command Input Field */}
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={currentCommand}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={getPlaceholderText()}
            className="w-full px-0 py-3 bg-transparent text-portal-text-primary placeholder-portal-text-muted 
                       border-none outline-none text-sm font-mono"
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
          />
          
          {/* Natural Language Indicator */}
          {naturalLanguageEnabled && isNaturalLanguage && (
            <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1 
                            px-2 py-1 bg-portal-primary/10 text-portal-primary rounded-md text-xs">
              <SparklesIcon className="w-3 h-3" />
              <span>AI</span>
            </div>
          )}
        </div>

        {/* AI Model Selector */}
        <div className="px-4 py-2 border-l border-portal-border">
          <AIModelSelector />
        </div>
      </div>

      {/* AI Suggestions */}
      {showSuggestions && aiSuggestionsEnabled && currentCommand.trim() && (
        <AISuggestionsList
          command={currentCommand}
          onSuggestionSelect={handleSuggestionSelect}
          onClose={() => setShowSuggestions(false)}
          className="absolute top-full left-0 right-0 mt-2 z-40"
        />
      )}

      {/* Keyboard Hints */}
      {isFocused && !showSuggestions && (
        <div className="absolute top-full left-0 right-0 mt-2 px-4 py-2 bg-portal-card/80 
                        border border-portal-border rounded-lg text-xs text-portal-text-secondary 
                        backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <span>
              <kbd className="px-1.5 py-0.5 bg-portal-muted rounded text-xs">↑↓</kbd> History
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-portal-muted rounded text-xs">Tab</kbd> Complete
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-portal-muted rounded text-xs">Esc</kbd> Clear
            </span>
            {naturalLanguageEnabled && (
              <span className="text-portal-primary">
                Natural language: {isNaturalLanguage ? 'ON' : 'OFF'}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};