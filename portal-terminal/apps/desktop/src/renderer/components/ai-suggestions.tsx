import React, { useState, useEffect, useRef } from 'react';

interface IAISuggestionsProps {
  command: string;
  onAcceptSuggestion?: (suggestion: string) => void;
  onDismiss?: () => void;
  terminalId: string | null;
  className?: string;
}

interface ISuggestion {
  text: string;
  confidence: number;
  type: 'completion' | 'alternative' | 'fix' | 'optimization';
}

export const AISuggestions: React.FC<IAISuggestionsProps> = ({
  command,
  onAcceptSuggestion,
  onDismiss,
  terminalId,
  className = '',
}) => {
  const [suggestions, setSuggestions] = useState<ISuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!command.trim() || !terminalId) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      setIsLoading(true);
      try {
        const response = await window.electronAPI.ai.getSuggestions(terminalId, command);
        setSuggestions(response.suggestions || []);
      } catch (error) {
        console.warn('Failed to get AI suggestions:', error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimeout = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounceTimeout);
  }, [command, terminalId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (suggestions.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % suggestions.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
          break;
        case 'Tab':
        case 'Enter':
          if (e.key === 'Tab') e.preventDefault();
          if (suggestions[selectedIndex]) {
            onAcceptSuggestion?.(suggestions[selectedIndex].text);
          }
          break;
        case 'Escape':
          onDismiss?.();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [suggestions, selectedIndex, onAcceptSuggestion, onDismiss]);

  if (!suggestions.length && !isLoading) {
    return null;
  }

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'completion': return '✨';
      case 'alternative': return '🔄';
      case 'fix': return '🔧';
      case 'optimization': return '⚡';
      default: return '💡';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return '#00d4aa';
    if (confidence >= 60) return '#ffd93d';
    return '#74b9ff';
  };

  return (
    <div className={`ai-suggestions ${className}`} ref={suggestionsRef}>
      {isLoading && (
        <div className="suggestion-loading">
          <div className="loading-spinner" />
          <span>Getting AI suggestions...</span>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="suggestions-container">
          <div className="suggestions-header">
            <span className="suggestions-title">🤖 AI Suggestions</span>
            <span className="suggestions-hint">
              ↑↓ navigate • Tab/Enter accept • Esc dismiss
            </span>
          </div>
          
          <div className="suggestions-list">
            {suggestions.map((suggestion, index) => (
              <div
                key={index}
                className={`suggestion-item ${index === selectedIndex ? 'selected' : ''}`}
                onClick={() => onAcceptSuggestion?.(suggestion.text)}
              >
                <div className="suggestion-content">
                  <span className="suggestion-icon">
                    {getSuggestionIcon(suggestion.type)}
                  </span>
                  <span className="suggestion-text">
                    {suggestion.text}
                  </span>
                  <div 
                    className="suggestion-confidence"
                    style={{ color: getConfidenceColor(suggestion.confidence) }}
                  >
                    {suggestion.confidence}%
                  </div>
                </div>
                <div className="suggestion-type">
                  {suggestion.type}
                </div>
              </div>
            ))}
          </div>
          
          <div className="suggestions-footer">
            <button className="suggestion-action" onClick={onDismiss}>
              Dismiss All
            </button>
            <button 
              className="suggestion-action primary"
              onClick={() => onAcceptSuggestion?.(suggestions[selectedIndex]?.text)}
            >
              Accept Selected
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .ai-suggestions {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          z-index: 1000;
          margin-top: 4px;
        }

        .suggestion-loading {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: rgba(0, 0, 0, 0.9);
          border: 1px solid rgba(0, 212, 170, 0.3);
          border-radius: 8px;
          backdrop-filter: blur(10px);
        }

        .loading-spinner {
          width: 12px;
          height: 12px;
          border: 2px solid rgba(0, 212, 170, 0.3);
          border-top: 2px solid #00d4aa;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .suggestion-loading span {
          font-size: 12px;
          color: #888;
        }

        .suggestions-container {
          background: rgba(0, 0, 0, 0.95);
          border: 1px solid rgba(0, 212, 170, 0.3);
          border-radius: 8px;
          backdrop-filter: blur(15px);
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        }

        .suggestions-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: rgba(0, 212, 170, 0.1);
          border-bottom: 1px solid rgba(0, 212, 170, 0.2);
        }

        .suggestions-title {
          font-size: 12px;
          color: #00d4aa;
          font-weight: 600;
        }

        .suggestions-hint {
          font-size: 10px;
          color: #888;
          font-family: 'JetBrains Mono', monospace;
        }

        .suggestions-list {
          max-height: 300px;
          overflow-y: auto;
        }

        .suggestion-item {
          padding: 8px 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .suggestion-item:last-child {
          border-bottom: none;
        }

        .suggestion-item:hover,
        .suggestion-item.selected {
          background: rgba(0, 212, 170, 0.1);
        }

        .suggestion-content {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 2px;
        }

        .suggestion-icon {
          font-size: 12px;
          width: 16px;
          text-align: center;
        }

        .suggestion-text {
          flex: 1;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          color: #e0e0e0;
        }

        .suggestion-confidence {
          font-size: 10px;
          font-weight: 600;
        }

        .suggestion-type {
          font-size: 10px;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-left: 24px;
        }

        .suggestions-footer {
          display: flex;
          gap: 8px;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.02);
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }

        .suggestion-action {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #888;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .suggestion-action:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #e0e0e0;
        }

        .suggestion-action.primary {
          background: rgba(0, 212, 170, 0.2);
          border-color: rgba(0, 212, 170, 0.4);
          color: #00d4aa;
        }

        .suggestion-action.primary:hover {
          background: rgba(0, 212, 170, 0.3);
        }
      `}</style>
    </div>
  );
};