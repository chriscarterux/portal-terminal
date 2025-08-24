import { IAIRequest, IAIPromptContext } from './types';
import * as path from 'path';

export interface IPromptTemplate {
  id: string;
  name: string;
  template: string;
  variables: string[];
  useCase: 'command-help' | 'error-analysis' | 'code-review' | 'general';
}

export class PromptEngineer {
  private templates = new Map<string, IPromptTemplate>();

  constructor() {
    this.initializeTemplates();
  }

  private initializeTemplates(): void {
    const templates: IPromptTemplate[] = [
      {
        id: 'command-help',
        name: 'Command Help Assistant',
        template: `You are an expert terminal assistant. Help with the command: "{command}"

Context:
- Working Directory: {workingDirectory}
- Shell: {shellType}
- Recent Commands: {recentCommands}
{gitContext}
{projectContext}
{mcpContext}

User Request: {userPrompt}

Provide a concise, actionable response with:
1. Brief explanation of what the command does
2. Suggested parameters or alternatives if relevant
3. Any warnings about potential issues
4. Related commands that might be helpful

Keep response under 200 words.`,
        variables: ['command', 'workingDirectory', 'shellType', 'recentCommands', 'gitContext', 'projectContext', 'mcpContext', 'userPrompt'],
        useCase: 'command-help',
      },
      {
        id: 'error-analysis',
        name: 'Error Analysis Assistant',
        template: `You are a debugging expert. Analyze this terminal error:

Command: {command}
Error Output: {errorOutput}
Working Directory: {workingDirectory}
Shell: {shellType}
{gitContext}
{projectContext}

User Request: {userPrompt}

Provide:
1. Root cause analysis
2. Step-by-step fix instructions
3. Prevention tips
4. Alternative approaches

Focus on practical solutions.`,
        variables: ['command', 'errorOutput', 'workingDirectory', 'shellType', 'gitContext', 'projectContext', 'userPrompt'],
        useCase: 'error-analysis',
      },
      {
        id: 'code-review',
        name: 'Code Review Assistant',
        template: `You are a code review expert. Review this context:

Command: {command}
Files Changed: {changedFiles}
Git Status: {gitStatus}
Project Type: {projectType}
{mcpContext}

User Request: {userPrompt}

Provide:
1. Code quality assessment
2. Potential issues or improvements
3. Best practices recommendations
4. Suggested next steps

Be constructive and specific.`,
        variables: ['command', 'changedFiles', 'gitStatus', 'projectType', 'mcpContext', 'userPrompt'],
        useCase: 'code-review',
      },
      {
        id: 'general',
        name: 'General Terminal Assistant',
        template: `You are a helpful terminal assistant.

Context:
- Command: {command}
- Directory: {workingDirectory}
- Shell: {shellType}
{contextInfo}

Request: {userPrompt}

Provide a helpful, concise response focused on terminal/development tasks.`,
        variables: ['command', 'workingDirectory', 'shellType', 'contextInfo', 'userPrompt'],
        useCase: 'general',
      },
    ];

    for (const template of templates) {
      this.templates.set(template.id, template);
    }
  }

  async enhanceRequest(request: IAIRequest): Promise<IAIRequest> {
    // Select optimal template based on request characteristics
    const template = this.selectTemplate(request);
    
    // Build enhanced prompt using template
    const enhancedPrompt = this.buildPromptFromTemplate(template, request);
    
    // Optimize for model type
    const optimizedRequest = this.optimizeForModel(request, enhancedPrompt);
    
    return optimizedRequest;
  }

  private selectTemplate(request: IAIRequest): IPromptTemplate {
    const { context, prompt } = request;
    
    // Analyze request to determine best template
    if (prompt.toLowerCase().includes('error') || prompt.toLowerCase().includes('failed')) {
      return this.templates.get('error-analysis')!;
    }
    
    if (context.command.startsWith('git') || prompt.toLowerCase().includes('review')) {
      return this.templates.get('code-review')!;
    }
    
    if (context.command || prompt.toLowerCase().includes('command')) {
      return this.templates.get('command-help')!;
    }
    
    return this.templates.get('general')!;
  }

  private buildPromptFromTemplate(template: IPromptTemplate, request: IAIRequest): string {
    let prompt = template.template;
    const { context } = request;
    
    // Replace template variables
    const replacements: Record<string, string> = {
      command: context.command || 'none',
      workingDirectory: context.workingDirectory || process.cwd(),
      shellType: context.shellType || 'bash',
      recentCommands: context.recentCommands.join(', ') || 'none',
      userPrompt: request.prompt,
      contextInfo: this.buildContextInfo(context),
      gitContext: this.buildGitContext(context),
      projectContext: this.buildProjectContext(context),
      mcpContext: this.buildMCPContext(context),
    };

    for (const [key, value] of Object.entries(replacements)) {
      const placeholder = `{${key}}`;
      prompt = prompt.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
    }

    return prompt;
  }

  private buildContextInfo(context: IAIPromptContext): string {
    const info: string[] = [];
    
    if (context.recentCommands.length > 0) {
      info.push(`Recent: ${context.recentCommands.slice(-2).join(', ')}`);
    }
    
    if (context.gitContext) {
      info.push(`Git: ${context.gitContext.branch}`);
    }
    
    if (context.projectContext) {
      info.push(`Project: ${context.projectContext.type}`);
    }
    
    return info.length > 0 ? `\n- ${info.join('\n- ')}` : '';
  }

  private buildGitContext(context: IAIPromptContext): string {
    if (!context.gitContext) return '';
    
    return `
Git Context:
- Branch: ${context.gitContext.branch}
- Status: ${context.gitContext.status}
- Remotes: ${context.gitContext.remotes.join(', ')}`;
  }

  private buildProjectContext(context: IAIPromptContext): string {
    if (!context.projectContext) return '';
    
    return `
Project Context:
- Type: ${context.projectContext.type}
- Dependencies: ${context.projectContext.dependencies.slice(0, 5).join(', ')}
- Structure: ${context.projectContext.structure.slice(0, 5).join(', ')}`;
  }

  private buildMCPContext(context: IAIPromptContext): string {
    if (!context.mcpContext) return '';
    
    const mcp = context.mcpContext;
    const sections: string[] = [];
    
    // Available tools
    if (mcp.tools && mcp.tools.length > 0) {
      const toolList = mcp.tools.slice(0, 5).map((tool: any) => 
        `${tool.name} (${tool.serverId})`
      ).join(', ');
      sections.push(`Tools: ${toolList}`);
    }
    
    // Available resources
    if (mcp.resources && mcp.resources.length > 0) {
      const resourceList = mcp.resources.slice(0, 3).map((resource: any) => 
        resource.name || resource.uri.split('/').pop()
      ).join(', ');
      sections.push(`Resources: ${resourceList}`);
    }
    
    // Server status
    if (mcp.servers && mcp.servers.length > 0) {
      const activeServers = mcp.servers.filter((s: any) => s.status === 'running').length;
      sections.push(`Servers: ${activeServers}/${mcp.servers.length} active`);
    }
    
    return sections.length > 0 ? `
MCP Context:
- ${sections.join('
- ')}` : '';
  }

  private optimizeForModel(request: IAIRequest, enhancedPrompt: string): IAIRequest {
    // Optimize prompt length based on model capabilities
    const maxPromptLength = request.model?.includes('20b') ? 1000 : 2000;
    
    let optimizedPrompt = enhancedPrompt;
    if (enhancedPrompt.length > maxPromptLength) {
      // Truncate less important sections
      optimizedPrompt = this.truncatePrompt(enhancedPrompt, maxPromptLength);
    }

    // Adjust parameters for optimal performance
    const optimizedRequest: IAIRequest = {
      ...request,
      prompt: optimizedPrompt,
      maxTokens: request.maxTokens || (request.model?.includes('20b') ? 256 : 512),
      temperature: request.temperature || 0.3, // Lower temperature for terminal tasks
    };

    return optimizedRequest;
  }

  private truncatePrompt(prompt: string, maxLength: number): string {
    if (prompt.length <= maxLength) return prompt;
    
    // Keep the most important parts: system prompt and user request
    const lines = prompt.split('\n');
    const userRequestIndex = lines.findIndex(line => line.includes('User Request:'));
    
    if (userRequestIndex === -1) {
      return prompt.slice(0, maxLength);
    }
    
    // Keep system prompt and user request, truncate context if needed
    const systemPart = lines.slice(0, userRequestIndex).join('\n');
    const userPart = lines.slice(userRequestIndex).join('\n');
    
    const availableLength = maxLength - userPart.length - 50; // Buffer
    const truncatedSystem = systemPart.length > availableLength 
      ? systemPart.slice(0, availableLength) + '...'
      : systemPart;
    
    return truncatedSystem + '\n' + userPart;
  }

  getAvailableTemplates(): IPromptTemplate[] {
    return Array.from(this.templates.values());
  }

  addCustomTemplate(template: IPromptTemplate): void {
    this.templates.set(template.id, template);
  }

  removeTemplate(templateId: string): void {
    this.templates.delete(templateId);
  }

  // Performance-optimized prompt for 20B model (<500ms target)
  buildFastPrompt(context: IAIPromptContext, userPrompt: string): string {
    const path = require('path');
    
    // Include essential MCP context for fast responses
    let mcpInfo = '';
    if (context.mcpContext?.tools?.length > 0) {
      const topTools = context.mcpContext.tools.slice(0, 2).map((t: any) => t.name).join(', ');
      mcpInfo = ` | MCP: ${topTools}`;
    }
    
    return `Terminal: ${context.command}
Dir: ${path.basename(context.workingDirectory)}${mcpInfo}
Request: ${userPrompt}

Brief response:`;
  }

  // Quality prompt for 120B model (accuracy over speed)  
  buildQualityPrompt(context: IAIPromptContext, userPrompt: string): string {
    const template = this.selectTemplate({ prompt: userPrompt, context } as IAIRequest);
    return this.buildPromptFromTemplate(template, {
      prompt: userPrompt,
      context,
    });
  }

  // MCP-enhanced prompt generation
  buildMCPEnhancedPrompt(context: IAIPromptContext, userPrompt: string, mcpSearchResults: any[]): string {
    let enhancedContext = { ...context };
    
    // Enhance context with MCP search results
    if (mcpSearchResults.length > 0) {
      const relevantTools = mcpSearchResults
        .filter(result => result.type === 'tool' && result.relevanceScore > 70)
        .slice(0, 3)
        .map(result => result.item);
      
      const relevantResources = mcpSearchResults
        .filter(result => result.type === 'resource' && result.relevanceScore > 70)
        .slice(0, 3)
        .map(result => result.item);
      
      enhancedContext.mcpContext = {
        ...context.mcpContext,
        relevantTools,
        relevantResources,
        searchQuery: userPrompt,
      };
    }
    
    const template = this.selectTemplate({ prompt: userPrompt, context: enhancedContext } as IAIRequest);
    return this.buildPromptFromTemplate(template, {
      prompt: userPrompt,
      context: enhancedContext,
    });
  }

  // Context-aware suggestion generation
  async generateContextualSuggestions(
    command: string,
    context: IAIPromptContext,
    mcpContext: any
  ): Promise<string[]> {
    const suggestions: string[] = [];
    
    // Base command suggestions
    const baseWord = command.split(' ')[0];
    const commandSuggestions = this.getCommandSuggestions(baseWord, context);
    suggestions.push(...commandSuggestions);
    
    // MCP-enhanced suggestions
    if (mcpContext?.tools) {
      const mcpSuggestions = this.getMCPSuggestions(command, mcpContext);
      suggestions.push(...mcpSuggestions);
    }
    
    // Context-specific suggestions
    const contextSuggestions = this.getContextSuggestions(command, context);
    suggestions.push(...contextSuggestions);
    
    return suggestions.slice(0, 5); // Limit to top 5
  }
  
  private getCommandSuggestions(baseCommand: string, context: IAIPromptContext): string[] {
    const suggestions: Record<string, string[]> = {
      git: ['git status', 'git log --oneline', 'git diff', 'git branch'],
      npm: ['npm list', 'npm outdated', 'npm audit', 'npm run'],
      docker: ['docker ps', 'docker images', 'docker logs', 'docker exec -it'],
      ls: ['ls -la', 'ls -lh', 'ls -t', 'ls -S'],
      cd: ['cd ..', 'cd ~', 'cd -'],
    };
    
    return suggestions[baseCommand] || [];
  }
  
  private getMCPSuggestions(command: string, mcpContext: any): string[] {
    if (!mcpContext.tools) return [];
    
    return mcpContext.tools
      .filter((tool: any) => {
        const toolName = tool.name.toLowerCase();
        const cmd = command.toLowerCase();
        return toolName.includes(cmd) || cmd.includes(toolName);
      })
      .slice(0, 2)
      .map((tool: any) => `mcp ${tool.name}`);
  }
  
  private getContextSuggestions(command: string, context: IAIPromptContext): string[] {
    const suggestions: string[] = [];
    
    // Project-specific suggestions
    if (context.projectContext?.type === 'node') {
      if (command.includes('test')) {
        suggestions.push('npm test', 'npm run test:watch');
      }
      if (command.includes('build')) {
        suggestions.push('npm run build', 'npm run dev');
      }
    }
    
    // Git-specific suggestions
    if (context.gitContext && command.includes('git')) {
      if (context.gitContext.status === 'dirty') {
        suggestions.push('git add .', 'git commit -m ""', 'git status');
      }
    }
    
    return suggestions;
  }
}