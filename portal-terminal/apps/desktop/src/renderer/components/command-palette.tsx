import React, { useState, useEffect, useRef } from 'react';

interface ICommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onCommand: (command: string) => void;
  terminalId: string | null;
  className?: string;
}

interface ICommand {
  text: string;
  description: string;
  category: 'recent' | 'suggested' | 'ai' | 'mcp' | 'system';
  icon: string;
  confidence?: number;
}

export const CommandPalette: React.FC<ICommandPaletteProps> = ({
  isOpen,
  onClose,
  onCommand,
  terminalId,
  className = '',
}) => {
  const [query, setQuery] = useState('');
  const [commands, setCommands] = useState<ICommand[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      loadInitialCommands();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      loadInitialCommands();
      return;
    }

    const searchCommands = async () => {
      setIsLoading(true);
      try {
        const [recentCommands, aiSuggestions, mcpCommands] = await Promise.all([
          getRecentCommands(query),
          getAISuggestions(query),
          getMCPCommands(query),
        ]);

        const allCommands = [
          ...recentCommands,
          ...aiSuggestions,
          ...mcpCommands,
        ].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

        setCommands(allCommands.slice(0, 10));
        setSelectedIndex(0);
      } catch (error) {
        console.warn('Command search failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimeout = setTimeout(searchCommands, 200);
    return () => clearTimeout(debounceTimeout);
  }, [query, terminalId]);

  const loadInitialCommands = async () => {
    try {
      const recent = await getRecentCommands('');
      const suggested = [
        { text: 'git status', description: 'Check repository status', category: 'suggested' as const, icon: '📊', confidence: 95 },
        { text: 'npm run dev', description: 'Start development server', category: 'suggested' as const, icon: '🚀', confidence: 90 },
        { text: 'ls -la', description: 'List all files with details', category: 'suggested' as const, icon: '📁', confidence: 85 },
        { text: 'docker ps', description: 'List running containers', category: 'suggested' as const, icon: '🐳', confidence: 80 },
      ];
      
      setCommands([...recent.slice(0, 5), ...suggested]);
      setSelectedIndex(0);
    } catch (error) {
      console.warn('Failed to load initial commands:', error);
    }
  };

  const getRecentCommands = async (searchQuery: string): Promise<ICommand[]> => {
    if (!terminalId) return [];

    try {
      const context = await window.electronAPI.terminal.getContext(terminalId);
      const recentCommands = context?.recentCommands || [];
      
      return recentCommands
        .filter((cmd: string) => !searchQuery || cmd.toLowerCase().includes(searchQuery.toLowerCase()))
        .slice(0, 5)
        .map((cmd: string) => ({
          text: cmd,
          description: 'Recently used command',
          category: 'recent' as const,
          icon: '🕐',
          confidence: 70,
        }));
    } catch (error) {
      return [];
    }
  };

  const getAISuggestions = async (searchQuery: string): Promise<ICommand[]> => {
    if (!terminalId || !searchQuery.trim()) return [];

    try {
      const aiResponse = await window.electronAPI.ai.getSuggestions(terminalId, searchQuery);
      return (aiResponse.suggestions || []).map((suggestion: any) => ({
        text: suggestion.text || suggestion,
        description: suggestion.description || 'AI-generated suggestion',
        category: 'ai' as const,
        icon: '🤖',
        confidence: suggestion.confidence || 85,
      }));
    } catch (error) {
      return [];
    }
  };

  const getMCPCommands = async (searchQuery: string): Promise<ICommand[]> => {
    if (!terminalId) return [];

    try {
      const mcpContext = await window.electronAPI.mcp.searchContext(terminalId, searchQuery);
      return (mcpContext || [])
        .filter((item: any) => item.type === 'tool')
        .slice(0, 3)
        .map((item: any) => ({
          text: `mcp-${item.item.name}`,
          description: `Use MCP tool: ${item.item.name}`,
          category: 'mcp' as const,
          icon: '🔗',
          confidence: item.relevanceScore || 75,
        }));
    } catch (error) {
      return [];
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % commands.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + commands.length) % commands.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (commands[selectedIndex]) {
          onCommand(commands[selectedIndex].text);
          onClose();
        }
        break;
      case 'Escape':
        onClose();
        break;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'recent': return '#888';
      case 'suggested': return '#74b9ff';
      case 'ai': return '#00d4aa';
      case 'mcp': return '#fd79a8';
      case 'system': return '#ffd93d';
      default: return '#888';
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="command-palette-overlay" onClick={onClose} />
      <div className={`command-palette ${className}`} ref={containerRef}>
        <div className="palette-header">
          <div className="search-container">
            <span className="search-icon">🔍</span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a command or search..."
              className="search-input"
            />
            {isLoading && <div className="search-spinner" />}
          </div>
        </div>

        <div className="palette-content">
          {commands.length > 0 ? (
            <div className="commands-list">
              {commands.map((command, index) => (
                <div
                  key={index}
                  className={`command-item ${index === selectedIndex ? 'selected' : ''}`}
                  onClick={() => {
                    onCommand(command.text);
                    onClose();
                  }}
                >
                  <div className="command-main">
                    <span className="command-icon">{command.icon}</span>
                    <div className="command-details">
                      <div className="command-text">{command.text}</div>
                      <div className="command-description">{command.description}</div>
                    </div>
                    {command.confidence && (
                      <div 
                        className="command-confidence"
                        style={{ color: getCategoryColor(command.category) }}
                      >
                        {command.confidence}%
                      </div>
                    )}
                  </div>
                  <div 
                    className="command-category"
                    style={{ color: getCategoryColor(command.category) }}
                  >
                    {command.category}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-commands">
              {query.trim() ? (
                <>
                  <div className="no-commands-icon">🔍</div>
                  <div className="no-commands-text">No commands found</div>
                  <div className="no-commands-hint">
                    Try a different search or press Enter to run "{query}" directly
                  </div>
                </>
              ) : (
                <>
                  <div className="no-commands-icon">⌨️</div>
                  <div className="no-commands-text">Start typing to search commands</div>
                  <div className="no-commands-hint">
                    Recent commands, AI suggestions, and MCP tools will appear here
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="palette-footer">
          <div className="footer-hint">
            <span className="footer-key">↑↓</span> navigate
            <span className="footer-key">Enter</span> execute
            <span className="footer-key">Esc</span> close
          </div>
        </div>

        <style jsx>{`
          .command-palette-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.3);
            backdrop-filter: blur(2px);
            z-index: 999;
          }

          .command-palette {
            position: fixed;
            top: 20%;
            left: 50%;
            transform: translateX(-50%);
            width: 600px;
            max-width: 90vw;
            max-height: 500px;
            background: rgba(26, 26, 26, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            backdrop-filter: blur(20px);
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7);
            z-index: 1000;
            overflow: hidden;
          }

          .palette-header {
            padding: 16px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          }

          .search-container {
            position: relative;
            display: flex;
            align-items: center;
          }

          .search-icon {
            position: absolute;
            left: 12px;
            font-size: 14px;
            color: #888;
            z-index: 1;
          }

          .search-input {
            width: 100%;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 12px 40px 12px 40px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 14px;
            color: #e0e0e0;
            outline: none;
            transition: all 0.2s ease;
          }

          .search-input:focus {
            border-color: rgba(0, 212, 170, 0.5);
            box-shadow: 0 0 0 2px rgba(0, 212, 170, 0.1);
          }

          .search-input::placeholder {
            color: #888;
          }

          .search-spinner {
            position: absolute;
            right: 12px;
            width: 14px;
            height: 14px;
            border: 2px solid rgba(0, 212, 170, 0.3);
            border-top: 2px solid #00d4aa;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }

          .palette-content {
            max-height: 350px;
            overflow-y: auto;
          }

          .commands-list {
            padding: 8px 0;
          }

          .command-item {
            padding: 8px 16px;
            cursor: pointer;
            transition: all 0.2s ease;
            border-left: 3px solid transparent;
          }

          .command-item:hover,
          .command-item.selected {
            background: rgba(0, 212, 170, 0.08);
            border-left-color: #00d4aa;
          }

          .command-main {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 2px;
          }

          .command-icon {
            font-size: 14px;
            width: 20px;
            text-align: center;
          }

          .command-details {
            flex: 1;
            min-width: 0;
          }

          .command-text {
            font-family: 'JetBrains Mono', monospace;
            font-size: 13px;
            color: #e0e0e0;
            margin-bottom: 2px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .command-description {
            font-size: 11px;
            color: #888;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .command-confidence {
            font-size: 10px;
            font-weight: 600;
            padding: 2px 4px;
            border-radius: 2px;
            background: rgba(255, 255, 255, 0.05);
          }

          .command-category {
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-left: 32px;
            font-weight: 600;
          }

          .no-commands {
            padding: 40px 20px;
            text-align: center;
          }

          .no-commands-icon {
            font-size: 32px;
            margin-bottom: 12px;
            opacity: 0.5;
          }

          .no-commands-text {
            font-size: 14px;
            color: #e0e0e0;
            margin-bottom: 8px;
          }

          .no-commands-hint {
            font-size: 12px;
            color: #888;
            line-height: 1.4;
          }

          .palette-footer {
            padding: 8px 16px;
            background: rgba(255, 255, 255, 0.02);
            border-top: 1px solid rgba(255, 255, 255, 0.05);
          }

          .footer-hint {
            display: flex;
            gap: 12px;
            font-size: 11px;
            color: #888;
            align-items: center;
          }

          .footer-key {
            background: rgba(255, 255, 255, 0.1);
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 10px;
            color: #e0e0e0;
          }
        `}</style>
      </div>
    </>
  );
};