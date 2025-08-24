import React, { useState } from 'react';
import { WarpTerminal } from './components/warp-terminal';
import { TerminalView } from './components/terminal-view';
import { WindowControls } from './components/window-controls';
import { AppLayout } from './components/layout/app-layout';
import './styles/globals.css';

const App: React.FC = () => {
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [showTerminal, setShowTerminal] = useState(true); // Default to true to show terminal
  const [useEnhancedTerminal, setUseEnhancedTerminal] = useState(true); // Toggle between old and new terminal

  const handleStartTerminal = () => {
    setShowTerminal(true);
  };

  return (
    <div className="h-screen flex flex-col bg-portal-secondary">
      <WindowControls terminalId={terminalId} />
      <div className="flex-1 overflow-hidden">
        <AppLayout 
          showWelcomeScreen={!showTerminal}
          onStartTerminal={handleStartTerminal}
        >
          {showTerminal && (
            <div className="h-full">
              {useEnhancedTerminal ? (
                <TerminalView className="h-full" />
              ) : (
                <div className="h-full p-4">
                  <WarpTerminal onTerminalCreated={setTerminalId} />
                </div>
              )}
              
              {/* Terminal Mode Toggle (for development) */}
              <div className="absolute top-4 right-4 z-50">
                <button
                  onClick={() => setUseEnhancedTerminal(!useEnhancedTerminal)}
                  className="px-3 py-1.5 bg-portal-card border border-portal-border 
                             rounded-lg text-xs text-portal-text-secondary 
                             hover:text-portal-text-primary transition-colors"
                >
                  {useEnhancedTerminal ? 'Use Legacy Terminal' : 'Use Enhanced Terminal'}
                </button>
              </div>
            </div>
          )}
        </AppLayout>
      </div>
    </div>
  );
};

export default App;