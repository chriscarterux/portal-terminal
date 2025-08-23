import React, { useState, useEffect } from 'react';
import { MCPStatus } from './mcp-status';

interface IWindowControlsProps {
  terminalId?: string | null;
}

export const WindowControls: React.FC<IWindowControlsProps> = ({ terminalId }) => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const checkMaximized = async () => {
      const maximized = await window.electronAPI.window.isMaximized();
      setIsMaximized(maximized);
    };
    
    checkMaximized();
  }, []);

  const handleMinimize = async () => {
    await window.electronAPI.window.minimize();
  };

  const handleMaximize = async () => {
    await window.electronAPI.window.maximize();
    const maximized = await window.electronAPI.window.isMaximized();
    setIsMaximized(maximized);
  };

  const handleClose = async () => {
    await window.electronAPI.window.close();
  };

  return (
    <div className="window-controls">
      <div className="window-controls-left">
        <div className="app-title">Portal Terminal</div>
        <MCPStatus terminalId={terminalId || null} />
      </div>
      <div className="window-controls-right">
        <button 
          className="window-control minimize"
          onClick={handleMinimize}
          title="Minimize"
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
        <button 
          className="window-control maximize"
          onClick={handleMaximize}
          title={isMaximized ? "Restore" : "Maximize"}
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            {isMaximized ? (
              <>
                <path d="M2 3h7v7H2V3z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                <path d="M3 2h7v7" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              </>
            ) : (
              <path d="M2 2h8v8H2V2z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            )}
          </svg>
        </button>
        <button 
          className="window-control close"
          onClick={handleClose}
          title="Close"
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
};