import React, { useState, useEffect } from 'react';

interface IMCPStatusProps {
  terminalId: string | null;
}

export const MCPStatus: React.FC<IMCPStatusProps> = ({ terminalId }) => {
  const [mcpStatus, setMCPStatus] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!terminalId) return;

    const updateMCPStatus = async () => {
      try {
        const context = await window.electronAPI.mcp.getContext(terminalId);
        const healthReport = await window.electronAPI.mcp.getHealthReport(terminalId);
        
        setMCPStatus({
          context,
          health: healthReport,
          connected: healthReport?.summary?.connectedServers || 0,
          total: healthReport?.summary?.totalServers || 0,
        });
      } catch (error) {
        console.warn('Failed to get MCP status:', error);
      }
    };

    updateMCPStatus();
    const interval = setInterval(updateMCPStatus, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, [terminalId]);

  if (!mcpStatus || mcpStatus.total === 0) {
    return null;
  }

  const healthPercentage = mcpStatus.total > 0 
    ? Math.round((mcpStatus.connected / mcpStatus.total) * 100) 
    : 0;

  const getStatusColor = () => {
    if (healthPercentage >= 80) return '#00d4aa'; // Green
    if (healthPercentage >= 50) return '#ffd93d'; // Yellow
    return '#ff6b6b'; // Red
  };

  return (
    <div 
      className="mcp-status"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      <div className="mcp-indicator">
        <div 
          className="mcp-dot"
          style={{ backgroundColor: getStatusColor() }}
        />
        <span className="mcp-text">
          MCP {mcpStatus.connected}/{mcpStatus.total}
        </span>
      </div>
      
      {isVisible && (
        <div className="mcp-tooltip">
          <div className="mcp-tooltip-header">
            Model Context Protocol Status
          </div>
          <div className="mcp-servers">
            {mcpStatus.health?.servers?.map((server: any) => (
              <div key={server.id} className="mcp-server-item">
                <div 
                  className="mcp-server-dot"
                  style={{ 
                    backgroundColor: server.status === 'running' ? '#00d4aa' : '#ff6b6b' 
                  }}
                />
                <span className="mcp-server-name">{server.name}</span>
                <span className="mcp-server-status">{server.status}</span>
              </div>
            )) || (
              <div className="mcp-no-servers">No MCP servers configured</div>
            )}
          </div>
        </div>
      )}
      
      <style jsx>{`
        .mcp-status {
          position: relative;
          display: flex;
          align-items: center;
          padding: 4px 8px;
          border-radius: 4px;
          background: rgba(0, 0, 0, 0.3);
          cursor: pointer;
        }

        .mcp-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .mcp-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          transition: background-color 0.3s ease;
        }

        .mcp-text {
          font-size: 11px;
          color: #e0e0e0;
          font-weight: 500;
        }

        .mcp-tooltip {
          position: absolute;
          bottom: 100%;
          left: 0;
          margin-bottom: 8px;
          background: rgba(0, 0, 0, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          padding: 12px;
          min-width: 250px;
          backdrop-filter: blur(10px);
          z-index: 1000;
        }

        .mcp-tooltip-header {
          font-size: 12px;
          font-weight: 600;
          color: #e0e0e0;
          margin-bottom: 8px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          padding-bottom: 4px;
        }

        .mcp-servers {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .mcp-server-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
        }

        .mcp-server-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }

        .mcp-server-name {
          color: #e0e0e0;
          flex: 1;
        }

        .mcp-server-status {
          color: #888;
          text-transform: capitalize;
        }

        .mcp-no-servers {
          color: #888;
          font-size: 11px;
          font-style: italic;
        }
      `}</style>
    </div>
  );
};