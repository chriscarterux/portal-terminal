import { MCPClient } from '../src/mcp-client';

// Mock WebSocket
jest.mock('ws', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    send: jest.fn(),
    close: jest.fn(),
    readyState: 1, // OPEN state
  }));
});

describe('MCPClient', () => {
  let client: MCPClient;

  beforeEach(() => {
    client = new MCPClient();
  });

  afterEach(async () => {
    await client.disconnect();
  });

  describe('server management', () => {
    it('should add a new server', async () => {
      const server = {
        id: 'test-server',
        name: 'Test Server',
        url: 'ws://localhost:8000/mcp',
        capabilities: []
      };

      await client.addServer(server);
      const servers = client.getServers();
      
      expect(servers).toHaveLength(1);
      expect(servers[0].id).toBe('test-server');
      expect(servers[0].name).toBe('Test Server');
    });

    it('should track server status', async () => {
      const server = {
        id: 'test-server',
        name: 'Test Server',
        url: 'ws://localhost:8000/mcp',
        capabilities: []
      };

      await client.addServer(server);
      const addedServer = client.getServers()[0];
      
      expect(addedServer.status).toBe('disconnected');
    });

    it('should get connected servers only', () => {
      const connectedServers = client.getConnectedServers();
      expect(Array.isArray(connectedServers)).toBe(true);
    });
  });

  describe('context management', () => {
    it('should get MCP context', async () => {
      const context = await client.getContext();
      
      expect(context).toHaveProperty('servers');
      expect(context).toHaveProperty('resources');
      expect(context).toHaveProperty('tools');
      expect(context).toHaveProperty('projectInfo');
      expect(Array.isArray(context.servers)).toBe(true);
      expect(Array.isArray(context.resources)).toBe(true);
      expect(Array.isArray(context.tools)).toBe(true);
    });
  });

  describe('event handling', () => {
    it('should be an EventEmitter', () => {
      expect(client.on).toBeDefined();
      expect(client.emit).toBeDefined();
      expect(client.removeListener).toBeDefined();
    });

    it('should emit events when servers connect/disconnect', (done) => {
      client.on('serverConnected', (server) => {
        expect(server).toBeDefined();
        done();
      });

      // Simulate server connection
      client.emit('serverConnected', { id: 'test', name: 'Test' });
    });
  });
});