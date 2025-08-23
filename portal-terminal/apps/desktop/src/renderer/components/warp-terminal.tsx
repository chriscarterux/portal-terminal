import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { CommandBlockComponent } from './command-block';
import { AISuggestions } from './ai-suggestions';
import { CommandPalette } from './command-palette';
import { StatusBar } from './status-bar';
import { CommandBlock } from '@portal/terminal-core';
import '@xterm/xterm/css/xterm.css';

interface IWarpTerminalProps {
  className?: string;
  onTerminalCreated?: (terminalId: string) => void;
}

interface ICommandInput {
  value: string;
  cursorPosition: number;
  showSuggestions: boolean;
}

export const WarpTerminal: React.FC<IWarpTerminalProps> = ({
  className = '',
  onTerminalCreated,
}) => {
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [commandBlocks, setCommandBlocks] = useState<CommandBlock[]>([]);
  const [commandInput, setCommandInput] = useState<ICommandInput>({
    value: '',
    cursorPosition: 0,
    showSuggestions: false,
  });
  const [showPalette, setShowPalette] = useState(false);
  const [currentAISuggestion, setCurrentAISuggestion] = useState<string>('');
  const [currentMCPContext, setCurrentMCPContext] = useState<any>(null);
  const [isCommandRunning, setIsCommandRunning] = useState(false);

  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstanceRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const blocksContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initializeTerminal();
    return () => cleanup();
  }, []);

  useEffect(() => {
    if (terminalId) {
      onTerminalCreated?.(terminalId);
    }
  }, [terminalId, onTerminalCreated]);

  useEffect(() => {
    if (blocksContainerRef.current) {
      blocksContainerRef.current.scrollTop = blocksContainerRef.current.scrollHeight;
    }
  }, [commandBlocks]);

  const initializeTerminal = async () => {
    if (!terminalRef.current) return;

    try {
      const terminal = new Terminal({
        fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", Consolas, monospace',
        fontSize: 14,
        lineHeight: 1.5,
        theme: {
          background: 'transparent',
          foreground: '#e0e0e0',
          cursor: '#00d4aa',
          cursorAccent: '#1a1a1a',
          selection: 'rgba(0, 212, 170, 0.3)',
        },
        allowProposedApi: true,
        scrollback: 1000,
      });

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();
      
      terminal.loadAddon(fitAddon);
      terminal.loadAddon(webLinksAddon);

      terminalInstanceRef.current = terminal;
      fitAddonRef.current = fitAddon;

      terminal.open(terminalRef.current);
      fitAddon.fit();

      // Create integrated terminal session
      const id = await window.electronAPI.terminal.createIntegrated({
        cols: terminal.cols,
        rows: terminal.rows,
        aiEnabled: true,
        mcpEnabled: true,
        autoSuggestions: true,
        errorAnalysis: true,
        performanceMonitoring: true,
      });
      
      setTerminalId(id);

      // Set up event handlers
      setupTerminalHandlers(id, terminal);
      
      console.log('🚀 Warp-style terminal initialized');
      
    } catch (error) {
      console.error('Failed to initialize terminal:', error);
    }
  };

  const setupTerminalHandlers = (id: string, terminal: Terminal) => {
    // Handle terminal output
    window.electronAPI.terminal.onData((receivedId, data) => {
      if (receivedId === id) {
        terminal.write(data);
      }
    });

    // Handle command completion
    window.electronAPI.terminal.onCommandComplete((receivedId, block) => {
      if (receivedId === id) {
        setCommandBlocks(prev => [...prev, block]);
        setIsCommandRunning(false);
        
        // Clear current suggestions after command completes
        setCurrentAISuggestion('');
        setCurrentMCPContext(null);
      }
    });

    // Handle AI suggestions
    window.electronAPI.ai.onSuggestion((receivedId, suggestion) => {
      if (receivedId === id) {
        setCurrentAISuggestion(suggestion);
      }
    });

    // Handle MCP context updates
    window.electronAPI.mcp.onContextUpdate((receivedId, context) => {
      if (receivedId === id) {
        setCurrentMCPContext(context);
      }
    });

    // Handle resize
    const handleResize = () => {
      fitAddonRef.current?.fit();
      if (terminalId) {
        window.electronAPI.terminal.resize(id, terminal.cols, terminal.rows);
      }
    };

    window.addEventListener('resize', handleResize);
  };

  const executeCommand = async (command: string) => {
    if (!terminalId || !command.trim()) return;

    setIsCommandRunning(true);
    setCommandInput({ value: '', cursorPosition: 0, showSuggestions: false });

    try {
      // Execute enhanced command with all integrations
      const result = await window.electronAPI.terminal.executeEnhanced(terminalId, command, {
        aiSuggestions: true,
        mcpContext: true,
        errorAnalysis: true,
      });

      // Update UI with results
      if (result.aiSuggestion) {
        setCurrentAISuggestion(result.aiSuggestion);
      }
      
      if (result.mcpContext) {
        setCurrentMCPContext(result.mcpContext);
      }

    } catch (error) {
      console.error('Command execution failed:', error);
      setIsCommandRunning(false);
    }
  };

  const handleInputChange = (value: string) => {
    setCommandInput(prev => ({
      ...prev,
      value,
      cursorPosition: value.length,
      showSuggestions: value.length > 2,
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
        if (!e.shiftKey && commandInput.value.trim()) {
          executeCommand(commandInput.value.trim());
        }
        break;
      case 'Tab':
        e.preventDefault();
        if (currentAISuggestion) {
          setCommandInput(prev => ({
            ...prev,
            value: currentAISuggestion,
            cursorPosition: currentAISuggestion.length,
          }));
        }
        break;
      case 'k':
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          setShowPalette(true);
        }
        break;
      case 'Escape':
        setCommandInput(prev => ({ ...prev, showSuggestions: false }));
        break;
    }
  };

  const handleRerunCommand = (command: string) => {
    executeCommand(command);
  };

  const handleAIHelp = async (command: string) => {
    if (!terminalId) return;
    
    try {
      const help = await window.electronAPI.ai.getContextualHelp(
        terminalId, 
        `Explain and help with: ${command}`
      );
      setCurrentAISuggestion(help);
    } catch (error) {
      console.warn('Failed to get AI help:', error);
    }
  };

  const handleAcceptSuggestion = (suggestion: string) => {
    setCommandInput(prev => ({
      ...prev,
      value: suggestion,
      cursorPosition: suggestion.length,
      showSuggestions: false,
    }));
    inputRef.current?.focus();
  };

  const cleanup = () => {
    if (terminalId) {
      window.electronAPI.terminal.kill(terminalId);
    }
    terminalInstanceRef.current?.dispose();
  };

  return (
    <div className={`warp-terminal ${className}`}>
      {/* Command Blocks History */}
      <div className="blocks-container" ref={blocksContainerRef}>
        {commandBlocks.map((block, index) => (
          <CommandBlockComponent
            key={`${block.id}-${index}`}
            block={block}
            onRerun={handleRerunCommand}
            onAIHelp={handleAIHelp}
            aiSuggestion={index === commandBlocks.length - 1 ? currentAISuggestion : undefined}
            mcpContext={index === commandBlocks.length - 1 ? currentMCPContext : undefined}
          />
        ))}
        
        {/* Show current AI suggestion for new command */}
        {currentAISuggestion && commandBlocks.length === 0 && (
          <div className="current-suggestion">
            <div className="suggestion-header">🤖 AI Suggestion</div>
            <div className="suggestion-content">{currentAISuggestion}</div>
          </div>
        )}
      </div>

      {/* Command Input */}
      <div className="command-input-container">
        <div className="input-wrapper">
          <div className="prompt-indicator">
            <span className="prompt-icon">❯</span>
          </div>
          
          <div className="input-area">
            <input
              ref={inputRef}
              type="text"
              value={commandInput.value}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isCommandRunning ? "Command running..." : "Type a command or Cmd+K for palette..."}
              className="command-input"
              disabled={isCommandRunning}
            />
            
            {/* AI Suggestions Popup */}
            {commandInput.showSuggestions && (
              <AISuggestions
                command={commandInput.value}
                onAcceptSuggestion={handleAcceptSuggestion}
                onDismiss={() => setCommandInput(prev => ({ ...prev, showSuggestions: false }))}
                terminalId={terminalId}
              />
            )}
          </div>

          {/* Loading indicator */}
          {isCommandRunning && (
            <div className="running-indicator">
              <div className="running-spinner" />
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="quick-actions">
          <button 
            className="quick-action"
            onClick={() => setShowPalette(true)}
            title="Command Palette (Cmd+K)"
          >
            ⌘K
          </button>
          {currentAISuggestion && (
            <button
              className="quick-action ai-action"
              onClick={() => handleAcceptSuggestion(currentAISuggestion)}
              title="Accept AI suggestion (Tab)"
            >
              🤖✨
            </button>
          )}
        </div>
      </div>

      {/* Hidden xterm for PTY integration */}
      <div 
        ref={terminalRef} 
        className="hidden-terminal"
        style={{ display: 'none' }}
      />

      {/* Command Palette */}
      <CommandPalette
        isOpen={showPalette}
        onClose={() => setShowPalette(false)}
        onCommand={(cmd) => {
          executeCommand(cmd);
          setShowPalette(false);
        }}
        terminalId={terminalId}
      />

      {/* Status Bar */}
      <StatusBar terminalId={terminalId} />

      <style jsx>{`
        .warp-terminal {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%);
          color: #e0e0e0;
          position: relative;
        }

        .blocks-container {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          scroll-behavior: smooth;
        }

        .blocks-container::-webkit-scrollbar {
          width: 6px;
        }

        .blocks-container::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 3px;
        }

        .blocks-container::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 3px;
        }

        .blocks-container::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.25);
        }

        .current-suggestion {
          margin: 16px 0;
          padding: 12px 16px;
          background: rgba(0, 212, 170, 0.08);
          border: 1px solid rgba(0, 212, 170, 0.2);
          border-radius: 8px;
          animation: slideIn 0.3s ease;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .suggestion-header {
          font-size: 12px;
          color: #00d4aa;
          font-weight: 600;
          margin-bottom: 6px;
        }

        .suggestion-content {
          font-size: 13px;
          color: #e0e0e0;
          line-height: 1.4;
        }

        .command-input-container {
          padding: 16px;
          background: rgba(0, 0, 0, 0.3);
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
        }

        .input-wrapper {
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 8px 12px;
          transition: all 0.2s ease;
          position: relative;
        }

        .input-wrapper:focus-within {
          border-color: rgba(0, 212, 170, 0.5);
          box-shadow: 0 0 0 2px rgba(0, 212, 170, 0.1);
        }

        .prompt-indicator {
          display: flex;
          align-items: center;
          color: #00d4aa;
          font-weight: 600;
        }

        .prompt-icon {
          font-size: 16px;
        }

        .input-area {
          flex: 1;
          position: relative;
        }

        .command-input {
          width: 100%;
          background: none;
          border: none;
          outline: none;
          font-family: 'JetBrains Mono', monospace;
          font-size: 14px;
          color: #e0e0e0;
          padding: 4px 0;
        }

        .command-input::placeholder {
          color: #888;
        }

        .command-input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .running-indicator {
          display: flex;
          align-items: center;
          padding: 0 4px;
        }

        .running-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(0, 212, 170, 0.3);
          border-top: 2px solid #00d4aa;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .quick-actions {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .quick-action {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #888;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-family: 'JetBrains Mono', monospace;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .quick-action:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #e0e0e0;
        }

        .ai-action {
          background: rgba(0, 212, 170, 0.1);
          border-color: rgba(0, 212, 170, 0.3);
          color: #00d4aa;
        }

        .ai-action:hover {
          background: rgba(0, 212, 170, 0.2);
        }

        .hidden-terminal {
          position: absolute;
          top: -9999px;
          left: -9999px;
        }
      `}</style>
    </div>
  );
};