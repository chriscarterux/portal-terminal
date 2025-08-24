export interface IMCPServerConfig {
  id: string;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  transport: 'stdio' | 'sse' | 'websocket';
  url?: string; // For non-stdio transports
  enabled: boolean;
  autoStart: boolean;
  restartOnFailure: boolean;
  maxRestarts: number;
  healthCheckInterval: number;
}

export interface IMCPServerStatus {
  id: string;
  status: 'stopped' | 'starting' | 'running' | 'error' | 'crashed';
  lastError?: string;
  lastSeen?: Date;
  restartCount: number;
  capabilities?: IMCPCapabilities;
  connectionTime?: Date;
}

export interface IMCPCapabilities {
  tools?: boolean;
  resources?: boolean;
  prompts?: boolean;
  sampling?: boolean;
  logging?: boolean;
}

export interface IMCPTool {
  name: string;
  description: string;
  inputSchema: any;
  serverId: string;
}

export interface IMCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  serverId: string;
}

export interface IMCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
  serverId: string;
}

export interface IMCPContext {
  tools: IMCPTool[];
  resources: IMCPResource[];
  prompts: IMCPPrompt[];
  servers: IMCPServerStatus[];
  lastUpdated: Date;
}

export interface IMCPToolCall {
  name: string;
  arguments: any;
  serverId: string;
}

export interface IMCPToolResult {
  success: boolean;
  content?: any;
  error?: string;
  isText?: boolean;
}

export interface IMCPResourceRequest {
  uri: string;
  serverId: string;
}

export interface IMCPResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: Buffer;
}

export interface IContextQuery {
  type: 'tool' | 'resource' | 'prompt' | 'any';
  query: string;
  serverId?: string;
  limit?: number;
}

export interface IContextMatch {
  type: 'tool' | 'resource' | 'prompt';
  item: IMCPTool | IMCPResource | IMCPPrompt;
  relevanceScore: number;
  serverId: string;
}