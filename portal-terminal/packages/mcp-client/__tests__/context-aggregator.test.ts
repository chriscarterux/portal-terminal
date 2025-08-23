import { ContextAggregator } from '../src/context-aggregator';
import { IMCPContext, IMCPTool, IMCPResource, IMCPPrompt } from '../src/types';

describe('ContextAggregator', () => {
  let aggregator: ContextAggregator;

  beforeEach(() => {
    aggregator = new ContextAggregator();
  });

  describe('context management', () => {
    it('should update and retrieve context', () => {
      const context: IMCPContext = {
        tools: [
          {
            name: 'file-search',
            description: 'Search for files in directory',
            inputSchema: {},
            serverId: 'filesystem',
          },
        ],
        resources: [
          {
            uri: 'file:///home/user/project',
            name: 'Project Directory',
            serverId: 'filesystem',
          },
        ],
        prompts: [
          {
            name: 'code-review',
            description: 'Review code changes',
            serverId: 'git',
          },
        ],
        servers: [
          {
            id: 'filesystem',
            status: 'running',
            restartCount: 0,
          },
        ],
        lastUpdated: new Date(),
      };

      aggregator.updateContext(context);
      const retrieved = aggregator.getContext();

      expect(retrieved.tools).toHaveLength(1);
      expect(retrieved.resources).toHaveLength(1);
      expect(retrieved.prompts).toHaveLength(1);
    });
  });

  describe('search functionality', () => {
    beforeEach(() => {
      const context: IMCPContext = {
        tools: [
          {
            name: 'file-search',
            description: 'Search for files in directory',
            inputSchema: {},
            serverId: 'filesystem',
          },
          {
            name: 'git-log',
            description: 'Get git commit history',
            inputSchema: {},
            serverId: 'git',
          },
        ],
        resources: [
          {
            uri: 'file:///project/src/main.ts',
            name: 'Main TypeScript File',
            serverId: 'filesystem',
          },
        ],
        prompts: [
          {
            name: 'code-review',
            description: 'Review code changes',
            serverId: 'git',
          },
        ],
        servers: [
          {
            id: 'filesystem',
            status: 'running',
            restartCount: 0,
          },
          {
            id: 'git',
            status: 'running',
            restartCount: 0,
          },
        ],
        lastUpdated: new Date(),
      };

      aggregator.updateContext(context);
    });

    it('should search tools by name', () => {
      const matches = aggregator.search({
        type: 'tool',
        query: 'file search',
      });

      expect(matches).toHaveLength(1);
      expect(matches[0].type).toBe('tool');
      expect((matches[0].item as IMCPTool).name).toBe('file-search');
    });

    it('should search resources by URI', () => {
      const matches = aggregator.search({
        type: 'resource',
        query: 'main typescript',
      });

      expect(matches).toHaveLength(1);
      expect(matches[0].type).toBe('resource');
      expect((matches[0].item as IMCPResource).uri).toContain('main.ts');
    });

    it('should limit search results', () => {
      const matches = aggregator.search({
        type: 'any',
        query: 'file',
        limit: 1,
      });

      expect(matches).toHaveLength(1);
    });

    it('should filter by server ID', () => {
      const matches = aggregator.search({
        type: 'tool',
        query: 'git',
        serverId: 'git',
      });

      expect(matches).toHaveLength(1);
      expect(matches[0].serverId).toBe('git');
    });
  });

  describe('context summary', () => {
    it('should generate context summary', () => {
      const context: IMCPContext = {
        tools: [{ name: 'test-tool', description: '', inputSchema: {}, serverId: 'server1' }],
        resources: [{ uri: 'file:///test', name: 'test', serverId: 'server1' }],
        prompts: [{ name: 'test-prompt', serverId: 'server1' }],
        servers: [{ id: 'server1', status: 'running', restartCount: 0 }],
        lastUpdated: new Date(),
      };

      aggregator.updateContext(context);
      const summary = aggregator.getContextSummary();

      expect(summary.totalTools).toBe(1);
      expect(summary.availableTools).toBe(1);
      expect(summary.totalResources).toBe(1);
      expect(summary.availableResources).toBe(1);
      expect(summary.totalPrompts).toBe(1);
      expect(summary.availablePrompts).toBe(1);
      expect(summary.connectedServers).toBe(1);
    });
  });
});