import React, { useState } from 'react';
import { WarpTerminal } from './components/warp-terminal';
import { WindowControls } from './components/window-controls';
import { AppLayout } from './components/layout/app-layout';
import './styles/globals.css';

const App: React.FC = () => {
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [showTerminal, setShowTerminal] = useState(false);

  return (
    <div className="h-screen flex flex-col bg-portal-secondary">
      <WindowControls terminalId={terminalId} />
      <div className="flex-1 overflow-hidden">
        <AppLayout showWelcomeScreen={!showTerminal}>
          {showTerminal && (
            <div className="h-full p-4">
              <WarpTerminal onTerminalCreated={setTerminalId} />
            </div>
          )}
        </AppLayout>
      </div>
    </div>
  );
};

export default App;