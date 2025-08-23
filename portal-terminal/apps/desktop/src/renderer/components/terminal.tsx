import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

interface ITerminalComponentProps {
  className?: string;
  onCommand?: (command: string) => void;
  onTerminalCreated?: (terminalId: string) => void;
}

interface ICommandBuffer {
  content: string;
  cursorPosition: number;
}

export const TerminalComponent: React.FC<ITerminalComponentProps> = ({ 
  className = '',
  onCommand,
  onTerminalCreated
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstanceRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [commandBuffer, setCommandBuffer] = useState<ICommandBuffer>({ content: '', cursorPosition: 0 });

  useEffect(() => {
    if (!terminalRef.current) return;

    // Create terminal instance
    const terminal = new Terminal({
      fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", Consolas, monospace',
      fontSize: 14,
      lineHeight: 1.5,
      theme: {
        background: '#1a1a1a',
        foreground: '#e0e0e0',
        cursor: '#00d4aa',
        cursorAccent: '#1a1a1a',
        selection: 'rgba(0, 212, 170, 0.3)',
        black: '#1a1a1a',
        red: '#ff6b6b',
        green: '#00d4aa',
        yellow: '#ffd93d',
        blue: '#74b9ff',
        magenta: '#fd79a8',
        cyan: '#00d4aa',
        white: '#e0e0e0',
        brightBlack: '#636363',
        brightRed: '#ff7675',
        brightGreen: '#00d4aa',
        brightYellow: '#fdcb6e',
        brightBlue: '#74b9ff',
        brightMagenta: '#fd79a8',
        brightCyan: '#00d4aa',
        brightWhite: '#ffffff',
      },
      allowProposedApi: true,
    });

    // Add addons
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);

    // Store references
    terminalInstanceRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Open terminal
    terminal.open(terminalRef.current);
    fitAddon.fit();

    // Create terminal session
    const createTerminalSession = async () => {
      try {
        const id = await window.electronAPI.terminal.create({
          cols: terminal.cols,
          rows: terminal.rows,
        });
        setTerminalId(id);
        onTerminalCreated?.(id);

        // Set up data handler
        window.electronAPI.terminal.onData((receivedTerminalId, data) => {
          if (receivedTerminalId === id) {
            terminal.write(data);
          }
        });

        // Set up exit handler
        window.electronAPI.terminal.onExit((receivedTerminalId, exitCode) => {
          if (receivedTerminalId === id) {
            terminal.write(`\r\nProcess exited with code ${exitCode}\r\n`);
          }
        });

      } catch (error) {
        console.error('Failed to create terminal session:', error);
      }
    };

    createTerminalSession();

    // Handle user input
    terminal.onData(async (data) => {
      if (!terminalId) return;

      // Handle special keys
      if (data === '\r') { // Enter key
        const command = commandBuffer.content.trim();
        if (command) {
          terminal.write('\r\n');
          
          try {
            // Execute command through our pipeline
            await window.electronAPI.terminal.executeCommand(terminalId, command);
          } catch (error) {
            terminal.write(`Error: ${error}\r\n$ `);
          }
          
          // Reset command buffer
          setCommandBuffer({ content: '', cursorPosition: 0 });
        } else {
          terminal.write('\r\n$ ');
        }
      } else if (data === '\u007F') { // Backspace
        if (commandBuffer.content.length > 0) {
          const newContent = commandBuffer.content.slice(0, -1);
          setCommandBuffer({ content: newContent, cursorPosition: newContent.length });
          terminal.write('\b \b'); // Erase character
        }
      } else if (data === '\u0003') { // Ctrl+C
        terminal.write('^C\r\n$ ');
        setCommandBuffer({ content: '', cursorPosition: 0 });
      } else if (data >= ' ' && data <= '~') { // Printable characters
        const newContent = commandBuffer.content + data;
        setCommandBuffer({ content: newContent, cursorPosition: newContent.length });
        terminal.write(data);
      }
    });

    // Handle resize
    const handleResize = () => {
      fitAddon.fit();
      if (terminalId) {
        window.electronAPI.terminal.resize(terminalId, terminal.cols, terminal.rows);
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup function
    return () => {
      window.removeEventListener('resize', handleResize);
      if (terminalId) {
        window.electronAPI.terminal.kill(terminalId);
      }
      terminal.dispose();
    };
  }, []);

  // Auto-fit on mount and when container size changes
  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      fitAddonRef.current?.fit();
    });

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div 
      ref={terminalRef} 
      className={`terminal-container ${className}`}
      style={{ width: '100%', height: '100%' }}
    />
  );
};