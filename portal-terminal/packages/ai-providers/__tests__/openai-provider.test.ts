import { OpenAIProvider } from '../src/providers/openai-provider';

// Mock OpenAI SDK
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    models: {
      list: jest.fn().mockResolvedValue({ data: [] })
    },
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Test response' } }],
          usage: { total_tokens: 10 }
        })
      }
    }
  }));
});

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;

  beforeEach(() => {
    provider = new OpenAIProvider({
      apiKey: 'test-key',
      model: 'gpt-4o-mini'
    });
  });

  afterEach(async () => {
    await provider.cleanup();
  });

  describe('initialization', () => {
    it('should create provider with config', () => {
      expect(provider.id).toBe('openai');
      expect(provider.name).toBe('OpenAI GPT');
      expect(provider.type).toBe('external');
      expect(provider.isAvailable).toBe(false);
    });

    it('should require API key for initialization', async () => {
      const providerWithoutKey = new OpenAIProvider({});
      
      await expect(providerWithoutKey.initialize()).rejects.toThrow(
        'OpenAI API key is required'
      );
    });

    it('should initialize successfully with valid config', async () => {
      await provider.initialize();
      expect(provider.isAvailable).toBe(true);
    });
  });

  describe('completion generation', () => {
    beforeEach(async () => {
      await provider.initialize();
    });

    it('should generate completions', async () => {
      const result = await provider.generateCompletion('test prompt');
      
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('tokensUsed');
      expect(result).toHaveProperty('responseTime');
      expect(result).toHaveProperty('provider', 'openai');
      expect(result.text).toBe('Test response');
    });

    it('should throw error when not available', async () => {
      await provider.cleanup();
      
      await expect(provider.generateCompletion('test')).rejects.toThrow(
        'OpenAI provider not available'
      );
    });
  });

  describe('suggestions and error analysis', () => {
    beforeEach(async () => {
      await provider.initialize();
    });

    it('should generate command suggestions', async () => {
      const context = {
        command: 'git st',
        workingDirectory: '/test',
        shellType: 'bash',
        recentCommands: []
      };

      const suggestion = await provider.generateSuggestion(context);
      expect(typeof suggestion).toBe('string');
    });

    it('should analyze errors', async () => {
      const analysis = await provider.analyzeError('command not found', 'git status');
      
      expect(analysis).toHaveProperty('diagnosis');
      expect(analysis).toHaveProperty('severity');
      expect(analysis).toHaveProperty('suggestions');
      expect(analysis).toHaveProperty('recoveryCommands');
    });
  });
});