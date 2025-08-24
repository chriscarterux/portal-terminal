import { PortalTerminal } from '../src/portal-terminal';
import { OpenAIProvider } from '@portal/ai-providers';

describe('PortalTerminal', () => {
  let terminal: PortalTerminal;

  beforeEach(() => {
    terminal = new PortalTerminal();
  });

  afterEach(async () => {
    await terminal.shutdown();
  });

  describe('initialization', () => {
    it('should create a new terminal instance', () => {
      expect(terminal).toBeInstanceOf(PortalTerminal);
    });

    it('should initialize with AI providers', async () => {
      const mockProvider = new OpenAIProvider({
        apiKey: 'test-key',
        model: 'gpt-4o-mini'
      });

      // Mock the initialize method to avoid actual API calls
      jest.spyOn(mockProvider, 'initialize').mockResolvedValue(undefined);
      jest.spyOn(mockProvider, 'isAvailable', 'get').mockReturnValue(true);

      await terminal.initialize([mockProvider]);
      expect(mockProvider.initialize).toHaveBeenCalled();
    });
  });

  describe('session management', () => {
    beforeEach(async () => {
      await terminal.initialize([]);
    });

    it('should create a new session', async () => {
      const sessionId = await terminal.createSession();
      expect(typeof sessionId).toBe('string');
      expect(sessionId).toHaveLength(36); // UUID v4 length
    });

    it('should track active sessions', async () => {
      const sessionId = await terminal.createSession();
      const activeSessions = terminal.getActiveSessions();
      
      expect(activeSessions).toHaveLength(1);
      expect(activeSessions[0].id).toBe(sessionId);
    });

    it('should create sessions with custom options', async () => {
      const sessionId = await terminal.createSession({
        shell: '/bin/zsh',
        cols: 120,
        rows: 40,
        cwd: '/tmp'
      });

      const session = terminal.getActiveSessions().find(s => s.id === sessionId);
      expect(session?.shell).toBe('/bin/zsh');
      expect(session?.workingDirectory).toBe('/tmp');
    });
  });

  describe('performance stats', () => {
    it('should track performance metrics', () => {
      const stats = terminal.getPerformanceStats();
      
      expect(stats).toHaveProperty('commandsExecuted');
      expect(stats).toHaveProperty('averageResponseTime');
      expect(stats).toHaveProperty('aiSuggestions');
      expect(stats).toHaveProperty('errorsAnalyzed');
    });
  });
});