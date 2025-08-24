import { EventEmitter } from 'events';
import { 
  IMCPContext, 
  IMCPTool, 
  IMCPResource, 
  IMCPPrompt,
  IMCPServerStatus,
  IContextQuery,
  IContextMatch
} from './types';

export class ContextAggregator extends EventEmitter {
  private context: IMCPContext = {
    tools: [],
    resources: [],
    prompts: [],
    servers: [],
    lastUpdated: new Date(),
  };

  private toolIndex = new Map<string, IMCPTool[]>();
  private resourceIndex = new Map<string, IMCPResource[]>();
  private promptIndex = new Map<string, IMCPPrompt[]>();

  updateContext(newContext: IMCPContext): void {
    this.context = { ...newContext };
    this.rebuildIndexes();
    this.emit('contextUpdated', this.context);
  }

  private rebuildIndexes(): void {
    this.toolIndex.clear();
    this.resourceIndex.clear();
    this.promptIndex.clear();

    // Index tools by keywords
    for (const tool of this.context.tools) {
      const keywords = this.extractKeywords(tool.name, tool.description);
      for (const keyword of keywords) {
        if (!this.toolIndex.has(keyword)) {
          this.toolIndex.set(keyword, []);
        }
        this.toolIndex.get(keyword)!.push(tool);
      }
    }

    // Index resources by keywords
    for (const resource of this.context.resources) {
      const keywords = this.extractKeywords(resource.name, resource.description || '', resource.uri);
      for (const keyword of keywords) {
        if (!this.resourceIndex.has(keyword)) {
          this.resourceIndex.set(keyword, []);
        }
        this.resourceIndex.get(keyword)!.push(resource);
      }
    }

    // Index prompts by keywords
    for (const prompt of this.context.prompts) {
      const keywords = this.extractKeywords(prompt.name, prompt.description || '');
      for (const keyword of keywords) {
        if (!this.promptIndex.has(keyword)) {
          this.promptIndex.set(keyword, []);
        }
        this.promptIndex.get(keyword)!.push(prompt);
      }
    }
  }

  private extractKeywords(name: string, description: string, uri?: string): string[] {
    const text = [name, description, uri || ''].join(' ').toLowerCase();
    
    // Split by common delimiters and filter out short words
    const keywords = text
      .split(/[\s\-_./:\\]+/)
      .filter(word => word.length > 2)
      .filter(word => !this.isStopWord(word));
    
    return [...new Set(keywords)]; // Remove duplicates
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after',
      'above', 'below', 'between', 'among', 'this', 'that', 'these', 'those',
    ]);
    
    return stopWords.has(word);
  }

  search(query: IContextQuery): IContextMatch[] {
    const matches: IContextMatch[] = [];
    const queryKeywords = this.extractKeywords(query.query, '');

    if (query.type === 'tool' || query.type === 'any') {
      matches.push(...this.searchTools(queryKeywords, query.serverId));
    }

    if (query.type === 'resource' || query.type === 'any') {
      matches.push(...this.searchResources(queryKeywords, query.serverId));
    }

    if (query.type === 'prompt' || query.type === 'any') {
      matches.push(...this.searchPrompts(queryKeywords, query.serverId));
    }

    // Sort by relevance score and apply limit
    matches.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    return query.limit ? matches.slice(0, query.limit) : matches;
  }

  private searchTools(queryKeywords: string[], serverId?: string): IContextMatch[] {
    const matches: IContextMatch[] = [];
    
    for (const keyword of queryKeywords) {
      const tools = this.toolIndex.get(keyword) || [];
      
      for (const tool of tools) {
        if (serverId && tool.serverId !== serverId) continue;
        
        const score = this.calculateRelevanceScore(keyword, tool.name, tool.description);
        matches.push({
          type: 'tool',
          item: tool,
          relevanceScore: score,
          serverId: tool.serverId,
        });
      }
    }

    return this.deduplicateMatches(matches);
  }

  private searchResources(queryKeywords: string[], serverId?: string): IContextMatch[] {
    const matches: IContextMatch[] = [];
    
    for (const keyword of queryKeywords) {
      const resources = this.resourceIndex.get(keyword) || [];
      
      for (const resource of resources) {
        if (serverId && resource.serverId !== serverId) continue;
        
        const score = this.calculateRelevanceScore(keyword, resource.name, resource.description || '', resource.uri);
        matches.push({
          type: 'resource',
          item: resource,
          relevanceScore: score,
          serverId: resource.serverId,
        });
      }
    }

    return this.deduplicateMatches(matches);
  }

  private searchPrompts(queryKeywords: string[], serverId?: string): IContextMatch[] {
    const matches: IContextMatch[] = [];
    
    for (const keyword of queryKeywords) {
      const prompts = this.promptIndex.get(keyword) || [];
      
      for (const prompt of prompts) {
        if (serverId && prompt.serverId !== serverId) continue;
        
        const score = this.calculateRelevanceScore(keyword, prompt.name, prompt.description || '');
        matches.push({
          type: 'prompt',
          item: prompt,
          relevanceScore: score,
          serverId: prompt.serverId,
        });
      }
    }

    return this.deduplicateMatches(matches);
  }

  private calculateRelevanceScore(keyword: string, name: string, description: string, uri?: string): number {
    let score = 0;
    const lowerKeyword = keyword.toLowerCase();
    const lowerName = name.toLowerCase();
    const lowerDescription = description.toLowerCase();
    const lowerUri = (uri || '').toLowerCase();

    // Exact name match gets highest score
    if (lowerName === lowerKeyword) {
      score += 100;
    } else if (lowerName.includes(lowerKeyword)) {
      score += 50;
    }

    // Description matches
    if (lowerDescription.includes(lowerKeyword)) {
      score += 20;
    }

    // URI matches (for resources)
    if (lowerUri.includes(lowerKeyword)) {
      score += 10;
    }

    // Boost score for shorter names (more specific)
    if (name.length < 20) {
      score += 5;
    }

    return score;
  }

  private deduplicateMatches(matches: IContextMatch[]): IContextMatch[] {
    const seen = new Set<string>();
    return matches.filter(match => {
      const key = `${match.type}:${match.serverId}:${this.getItemIdentifier(match.item)}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private getItemIdentifier(item: IMCPTool | IMCPResource | IMCPPrompt): string {
    if ('inputSchema' in item) {
      return item.name; // Tool
    } else if ('uri' in item) {
      return item.uri; // Resource
    } else {
      return item.name; // Prompt
    }
  }

  getContext(): IMCPContext {
    return { ...this.context };
  }

  getToolsByServer(serverId: string): IMCPTool[] {
    return this.context.tools.filter(tool => tool.serverId === serverId);
  }

  getResourcesByServer(serverId: string): IMCPResource[] {
    return this.context.resources.filter(resource => resource.serverId === serverId);
  }

  getPromptsByServer(serverId: string): IMCPPrompt[] {
    return this.context.prompts.filter(prompt => prompt.serverId === serverId);
  }

  getAvailableTools(): IMCPTool[] {
    return this.context.tools.filter(tool => {
      const server = this.context.servers.find(s => s.id === tool.serverId);
      return server?.status === 'running';
    });
  }

  getAvailableResources(): IMCPResource[] {
    return this.context.resources.filter(resource => {
      const server = this.context.servers.find(s => s.id === resource.serverId);
      return server?.status === 'running';
    });
  }

  getAvailablePrompts(): IMCPPrompt[] {
    return this.context.prompts.filter(prompt => {
      const server = this.context.servers.find(s => s.id === prompt.serverId);
      return server?.status === 'running';
    });
  }

  getContextSummary(): {
    totalTools: number;
    availableTools: number;
    totalResources: number;
    availableResources: number;
    totalPrompts: number;
    availablePrompts: number;
    connectedServers: number;
    totalServers: number;
  } {
    const connectedServerIds = new Set(
      this.context.servers
        .filter(server => server.status === 'running')
        .map(server => server.id)
    );

    return {
      totalTools: this.context.tools.length,
      availableTools: this.context.tools.filter(tool => connectedServerIds.has(tool.serverId)).length,
      totalResources: this.context.resources.length,
      availableResources: this.context.resources.filter(resource => connectedServerIds.has(resource.serverId)).length,
      totalPrompts: this.context.prompts.length,
      availablePrompts: this.context.prompts.filter(prompt => connectedServerIds.has(prompt.serverId)).length,
      connectedServers: connectedServerIds.size,
      totalServers: this.context.servers.length,
    };
  }
}