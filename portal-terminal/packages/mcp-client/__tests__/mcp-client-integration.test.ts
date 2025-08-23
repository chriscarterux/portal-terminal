import { MCPClient } from '../src/mcp-client';
import { EventEmitter } from 'events';

// Mock the server manager and health monitor
jest.mock('../src/server-manager', () => ({
  ServerManager: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    addServer: jest.fn(),
    removeServer: jest.fn(),
    getServer: jest.fn(),
    getAllServers: jest.fn().mockReturnValue([]),
    startServer: jest.fn().mockResolvedValue(true),
    stopServer: jest.fn().mockResolvedValue(true),
    restartServer: jest.fn().mockResolvedValue(true),
    getServerStatus: jest.fn().mockReturnValue('running'),
  })),
}));

jest.mock('../src/health-monitor', () => ({
  HealthMonitor: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    startMonitoring: jest.fn(),
    stopMonitoring: jest.fn(),
    checkServerHealth: jest.fn().mockResolvedValue({ status: 'healthy', responseTime: 50 }),
    getHealthHistory: jest.fn().mockReturnValue([]),
  })),
}));

describe('MCP Client Integration Tests', () => {
  let mcpClient: MCPClient;
  let mockServerManager: any;
  let mockHealthMonitor: any;

  beforeEach(() => {
    mcpClient = new MCPClient({
      autoDiscovery: true,
      healthMonitoring: true,
      maxConcurrentRequests: 5,
    });

    mockServerManager = mcpClient['serverManager'];
    mockHealthMonitor = mcpClient['healthMonitor'];
  });

  afterEach(async () => {
    await mcpClient.shutdown();
  });

  describe('initialization and server discovery', () => {
    it('should initialize with default MCP servers', async () => {
      const mockServers = [
        {
          id: 'context7',
          name: 'Context7 Documentation',
          command: 'node',
          args: ['./mcp-servers/context7.js'],
          status: 'stopped',
        },
        {
          id: 'memory-bank',
          name: 'Memory Bank Persistence',
          command: 'node',
          args: ['./mcp-servers/memory-bank.js'],
          status: 'stopped',
        },
        {
          id: 'filesystem',
          name: 'Filesystem Project Awareness',
          command: 'node',
          args: ['./mcp-servers/filesystem.js'],
          status: 'stopped',
        },
      ];

      mockServerManager.getAllServers.mockReturnValue(mockServers);

      await mcpClient.initialize();

      expect(mcpClient.isInitialized()).toBe(true);
      
      const context = mcpClient.getContext();
      expect(context.servers).toHaveLength(3);
      expect(context.servers.some(s => s.id === 'context7')).toBe(true);
      expect(context.servers.some(s => s.id === 'memory-bank')).toBe(true);
      expect(context.servers.some(s => s.id === 'filesystem')).toBe(true);
    });

    it('should auto-discover servers in project directory', async () => {
      mcpClient = new MCPClient({ autoDiscovery: true });
      
      // Mock server discovery
      const discoveredServers = [
        {
          id: 'git-server',
          name: 'Git Integration Server',
          command: 'npx',
          args: ['@modelcontextprotocol/git'],
          status: 'discovered',
        },
      ];

      mockServerManager.getAllServers.mockReturnValue(discoveredServers);

      await mcpClient.initialize();

      expect(mockServerManager.addServer).toHaveBeenCalled();
    });

    it('should handle server initialization failures gracefully', async () => {
      mockServerManager.startServer.mockRejectedValueOnce(new Error('Server failed to start'));

      await mcpClient.initialize();

      // Should still initialize successfully
      expect(mcpClient.isInitialized()).toBe(true);
    });
  });

  describe('server lifecycle management', () => {
    beforeEach(async () => {
      await mcpClient.initialize();
    });

    it('should start and stop servers', async () => {
      const serverConfig = {
        id: 'test-server',
        name: 'Test Server',
        command: 'node',
        args: ['test-server.js'],
      };

      await mcpClient.addServer(serverConfig);
      expect(mockServerManager.addServer).toHaveBeenCalledWith(serverConfig);

      await mcpClient.startServer('test-server');
      expect(mockServerManager.startServer).toHaveBeenCalledWith('test-server');

      await mcpClient.stopServer('test-server');
      expect(mockServerManager.stopServer).toHaveBeenCalledWith('test-server');
    });

    it('should restart failed servers automatically', async () => {
      const serverConfig = {
        id: 'flaky-server',
        name: 'Flaky Server',
        command: 'node',
        args: ['flaky-server.js'],
        autoRestart: true,
      };

      await mcpClient.addServer(serverConfig);

      // Simulate server failure
      mockServerManager.getServerStatus.mockReturnValue('failed');
      
      // Trigger health check that detects failure
      mockHealthMonitor.checkServerHealth.mockResolvedValueOnce({
        status: 'unhealthy',
        error: 'Connection refused',
      });

      // Simulate server failure event
      mcpClient.emit('serverStatusChange', {
        serverId: 'flaky-server',
        status: 'failed',
        error: 'Process exited',
      });

      // Wait for auto-restart
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockServerManager.restartServer).toHaveBeenCalledWith('flaky-server');
    });
  });

  describe('health monitoring', () => {
    beforeEach(async () => {
      await mcpClient.initialize();
    });

    it('should monitor server health continuously', async () => {
      const serverConfigs = [
        { id: 'server1', name: 'Server 1', command: 'node', args: ['server1.js'] },
        { id: 'server2', name: 'Server 2', command: 'node', args: ['server2.js'] },
      ];

      for (const config of serverConfigs) {
        await mcpClient.addServer(config);
      }

      // Start health monitoring
      await mcpClient.startHealthMonitoring();

      expect(mockHealthMonitor.startMonitoring).toHaveBeenCalled();
    });

    it('should detect and report unhealthy servers', async () => {
      let healthAlert: any = null;
      
      mcpClient.on('serverHealth', (alert) => {
        healthAlert = alert;
      });

      await mcpClient.addServer({
        id: 'unhealthy-server',
        name: 'Unhealthy Server',
        command: 'node',
        args: ['unhealthy.js'],
      });

      // Mock unhealthy response
      mockHealthMonitor.checkServerHealth.mockResolvedValueOnce({
        status: 'unhealthy',
        responseTime: 5000,
        error: 'Timeout',
      });

      // Trigger health check
      await mcpClient.checkServerHealth('unhealthy-server');

      expect(healthAlert).toBeDefined();
      expect(healthAlert.serverId).toBe('unhealthy-server');
      expect(healthAlert.status).toBe('unhealthy');
    });

    it('should provide health metrics and history', async () => {
      const mockHistory = [
        { timestamp: new Date(), serverId: 'server1', status: 'healthy', responseTime: 45 },
        { timestamp: new Date(), serverId: 'server1', status: 'healthy', responseTime: 52 },
        { timestamp: new Date(), serverId: 'server1', status: 'unhealthy', responseTime: 3000 },
      ];

      mockHealthMonitor.getHealthHistory.mockReturnValue(mockHistory);

      const metrics = mcpClient.getHealthMetrics();

      expect(metrics.servers).toBeDefined();
      expect(metrics.averageResponseTime).toBeDefined();
      expect(metrics.uptime).toBeDefined();
    });
  });

  describe('tool execution', () => {
    beforeEach(async () => {
      await mcpClient.initialize();
    });

    it('should execute tools through MCP servers', async () => {
      const toolCall = {
        serverId: 'filesystem',
        name: 'search_files',
        arguments: {
          pattern: '*.ts',
          directory: '/project/src',
        },
      };

      const mockResult = {
        success: true,
        content: [
          { type: 'text', text: 'Found 15 TypeScript files' },
          { type: 'resource', uri: 'file:///project/src/main.ts' },
        ],
      };

      // Mock the server manager to handle tool execution
      mockServerManager.executeTool = jest.fn().mockResolvedValue(mockResult);

      const result = await mcpClient.executeTool(toolCall);

      expect(mockServerManager.executeTool).toHaveBeenCalledWith(
        'filesystem',
        'search_files',
        toolCall.arguments
      );
      expect(result.success).toBe(true);
      expect(result.content).toHaveLength(2);
    });

    it('should handle tool execution failures', async () => {
      const toolCall = {
        serverId: 'nonexistent',
        name: 'invalid_tool',
        arguments: {},
      };

      mockServerManager.executeTool = jest.fn().mockRejectedValue(
        new Error('Server not found')
      );

      await expect(mcpClient.executeTool(toolCall)).rejects.toThrow('Server not found');
    });

    it('should respect concurrent request limits', async () => {
      const toolCalls = Array.from({ length: 10 }, (_, i) => ({
        serverId: 'filesystem',
        name: 'read_file',
        arguments: { path: `/file${i}.txt` },
      }));

      mockServerManager.executeTool = jest.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      const startTime = Date.now();
      const promises = toolCalls.map(call => mcpClient.executeTool(call));
      await Promise.all(promises);
      const endTime = Date.now();

      // Should execute in batches due to concurrency limit
      expect(endTime - startTime).toBeGreaterThan(150); // At least 2 batches
    });
  });

  describe('resource access', () => {
    beforeEach(async () => {
      await mcpClient.initialize();
    });

    it('should fetch resources from MCP servers', async () => {
      const resourceRequest = {
        serverId: 'filesystem',
        uri: 'file:///project/README.md',
      };

      const mockContent = {
        uri: 'file:///project/README.md',
        mimeType: 'text/markdown',
        text: '# Project Title\n\nProject description...',
      };

      mockServerManager.getResource = jest.fn().mockResolvedValue(mockContent);

      const content = await mcpClient.getResource(resourceRequest);

      expect(mockServerManager.getResource).toHaveBeenCalledWith(
        'filesystem',
        'file:///project/README.md'
      );
      expect(content.uri).toBe('file:///project/README.md');
      expect(content.text).toContain('Project Title');
    });

    it('should list available resources', async () => {
      const mockResources = [
        {
          uri: 'file:///project/src',
          name: 'Source Directory',
          mimeType: 'application/directory',
          serverId: 'filesystem',
        },
        {
          uri: 'git://commits/recent',
          name: 'Recent Commits',
          mimeType: 'application/json',
          serverId: 'git-server',
        },
      ];

      mockServerManager.listResources = jest.fn().mockResolvedValue(mockResources);

      const resources = await mcpClient.listResources();

      expect(resources).toHaveLength(2);
      expect(resources.some(r => r.uri.includes('src'))).toBe(true);
      expect(resources.some(r => r.uri.includes('git://'))).toBe(true);
    });
  });

  describe('context aggregation', () => {
    beforeEach(async () => {
      await mcpClient.initialize();
    });

    it('should aggregate context from multiple servers', async () => {
      // Mock context from different servers
      const mockTools = [
        { name: 'search_files', serverId: 'filesystem', description: 'Search for files' },
        { name: 'git_log', serverId: 'git-server', description: 'Show git history' },
      ];

      const mockResources = [
        { uri: 'file:///project', name: 'Project Root', serverId: 'filesystem' },
        { uri: 'memory://recent-context', name: 'Recent Context', serverId: 'memory-bank' },
      ];

      mcpClient['contextAggregator'].getContext = jest.fn().mockReturnValue({
        tools: mockTools,
        resources: mockResources,
        prompts: [],
        servers: [
          { id: 'filesystem', status: 'running', restartCount: 0 },
          { id: 'git-server', status: 'running', restartCount: 0 },
          { id: 'memory-bank', status: 'running', restartCount: 0 },
        ],
        lastUpdated: new Date(),
      });

      const context = mcpClient.getAggregatedContext();

      expect(context.tools).toHaveLength(2);
      expect(context.resources).toHaveLength(2);
      expect(context.servers).toHaveLength(3);
    });

    it('should search across aggregated context', async () => {
      const mockResults = [
        {
          type: 'tool',
          item: { name: 'git_status', serverId: 'git-server' },
          serverId: 'git-server',
          relevance: 0.95,
        },
      ];

      mcpClient['contextAggregator'].search = jest.fn().mockReturnValue(mockResults);

      const results = mcpClient.searchContext({
        type: 'tool',
        query: 'git status',
        limit: 5,
      });

      expect(results).toHaveLength(1);
      expect(results[0].item.name).toBe('git_status');
      expect(results[0].relevance).toBe(0.95);
    });
  });

  describe('error recovery and resilience', () => {
    beforeEach(async () => {
      await mcpClient.initialize();
    });

    it('should recover from server crashes', async () => {
      const serverConfig = {
        id: 'crash-prone-server',
        name: 'Crash Prone Server',
        command: 'node',
        args: ['crash-prone.js'],
        autoRestart: true,
        maxRestarts: 3,
      };

      await mcpClient.addServer(serverConfig);

      // Simulate server crash
      mcpClient.emit('serverStatusChange', {
        serverId: 'crash-prone-server',
        status: 'crashed',
        error: 'Unexpected exit',
      });

      // Should attempt restart
      expect(mockServerManager.restartServer).toHaveBeenCalledWith('crash-prone-server');
    });

    it('should disable servers that exceed restart limit', async () => {
      const serverConfig = {
        id: 'unstable-server',
        name: 'Unstable Server',
        command: 'node',
        args: ['unstable.js'],
        autoRestart: true,
        maxRestarts: 2,
      };

      await mcpClient.addServer(serverConfig);

      // Simulate multiple crashes
      for (let i = 0; i < 3; i++) {
        mcpClient.emit('serverStatusChange', {
          serverId: 'unstable-server',
          status: 'crashed',
          error: 'Repeated crashes',
        });
      }

      // After max restarts, should disable server
      const context = mcpClient.getContext();
      const server = context.servers.find(s => s.id === 'unstable-server');
      expect(server?.status).toBe('disabled');
    });

    it('should gracefully handle partial server failures', async () => {
      // Add multiple servers
      const servers = [
        { id: 'server-a', name: 'Server A', command: 'node', args: ['a.js'] },
        { id: 'server-b', name: 'Server B', command: 'node', args: ['b.js'] },
        { id: 'server-c', name: 'Server C', command: 'node', args: ['c.js'] },
      ];

      for (const server of servers) {
        await mcpClient.addServer(server);
      }

      // Simulate one server failing
      mockServerManager.getServerStatus
        .mockReturnValueOnce('running')
        .mockReturnValueOnce('failed')
        .mockReturnValueOnce('running');

      const context = mcpClient.getContext();
      
      // Should still provide context from working servers
      expect(context.servers.filter(s => s.status === 'running')).toHaveLength(2);
      expect(context.servers.filter(s => s.status === 'failed')).toHaveLength(1);
    });
  });

  describe('performance monitoring', () => {
    beforeEach(async () => {
      await mcpClient.initialize();
    });

    it('should track server response times', async () => {
      const toolCall = {
        serverId: 'filesystem',
        name: 'search_files',
        arguments: { pattern: '*.js' },
      };

      mockServerManager.executeTool = jest.fn().mockImplementation(
        () => new Promise(resolve => 
          setTimeout(() => resolve({ success: true, content: [] }), 150)
        )
      );

      const startTime = Date.now();
      await mcpClient.executeTool(toolCall);
      const endTime = Date.now();

      const metrics = mcpClient.getPerformanceMetrics();
      expect(metrics.averageResponseTime).toBeGreaterThan(100);
      expect(metrics.averageResponseTime).toBeLessThan(300);
    });

    it('should identify slow servers', async () => {
      // Mock slow server response
      mockHealthMonitor.checkServerHealth
        .mockResolvedValueOnce({ status: 'healthy', responseTime: 50 })
        .mockResolvedValueOnce({ status: 'healthy', responseTime: 2000 })
        .mockResolvedValueOnce({ status: 'healthy', responseTime: 45 });

      await mcpClient.checkServerHealth('fast-server');
      await mcpClient.checkServerHealth('slow-server');
      await mcpClient.checkServerHealth('another-fast-server');

      const metrics = mcpClient.getPerformanceMetrics();
      
      expect(metrics.slowServers).toBeDefined();
      expect(metrics.slowServers.some((s: any) => s.serverId === 'slow-server')).toBe(true);
    });
  });
});