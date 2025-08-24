import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CommandInput } from './command-input';
import { CommandBlockEnhanced, type ICommandBlock } from './command-block-enhanced';
import { useUIStore, selectTerminalContext } from '../stores/ui-store';

interface TerminalViewProps {
  className?: string;
}

export const TerminalView: React.FC<TerminalViewProps> = ({ className = '' }) => {
  const [blocks, setBlocks] = useState<ICommandBlock[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  const terminalContext = useUIStore(selectTerminalContext);

  // Auto-scroll to bottom when new blocks are added
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [blocks]);

  // Simulate terminal execution with AI and MCP integration
  const executeCommand = useCallback(async (command: string) => {
    const blockId = `block-${Date.now()}`;
    const startTime = new Date();
    
    // Create initial block
    const newBlock: ICommandBlock = {
      id: blockId,
      command,
      output: '',
      exitCode: 0,
      startTime,
      workingDirectory: terminalContext.workingDirectory,
      isExpanded: true,
      isBookmarked: false,
    };

    setBlocks(prev => [...prev, newBlock]);
    setIsExecuting(true);

    try {
      // Simulate command execution
      const result = await simulateCommandExecution(command, terminalContext);
      
      // Update block with results
      setBlocks(prev => prev.map(block => 
        block.id === blockId 
          ? {
              ...block,
              output: result.output,
              exitCode: result.exitCode,
              endTime: new Date(),
              aiSummary: result.aiSummary,
              aiSuggestions: result.aiSuggestions,
              errorAnalysis: result.errorAnalysis,
              mcpContext: result.mcpContext,
            }
          : block
      ));

      // Update terminal context based on command
      updateContextFromCommand(command, result);

    } catch (error) {
      // Handle execution error
      setBlocks(prev => prev.map(block => 
        block.id === blockId 
          ? {
              ...block,
              output: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              exitCode: 1,
              endTime: new Date(),
              errorAnalysis: {
                diagnosis: 'Command execution failed',
                suggestions: ['Check command syntax', 'Verify permissions'],
                severity: 'high',
              },
            }
          : block
      ));
    } finally {
      setIsExecuting(false);
    }
  }, [terminalContext]);

  const updateContextFromCommand = (command: string, result: any) => {
    const { updateTerminalContext } = useUIStore.getState();
    
    // Update context based on command results
    if (command.startsWith('cd ')) {
      const newDir = command.slice(3).trim();
      if (newDir && !result.output.includes('No such file')) {
        updateTerminalContext({ 
          workingDirectory: newDir.startsWith('/') ? newDir : `${terminalContext.workingDirectory}/${newDir}` 
        });
      }
    }
    
    if (command.includes('git checkout') || command.includes('git switch')) {
      // Simulate git branch change
      const branchMatch = command.match(/(?:checkout|switch)\s+(\S+)/);
      if (branchMatch && !result.output.includes('error:')) {
        updateTerminalContext({ gitBranch: branchMatch[1] });
      }
    }
  };

  const handleToggleExpanded = useCallback((blockId: string) => {
    setBlocks(prev => prev.map(block => 
      block.id === blockId 
        ? { ...block, isExpanded: !block.isExpanded }
        : block
    ));
  }, []);

  const handleToggleBookmark = useCallback((blockId: string) => {
    setBlocks(prev => prev.map(block => 
      block.id === blockId 
        ? { ...block, isBookmarked: !block.isBookmarked }
        : block
    ));
  }, []);

  const handleCopyOutput = useCallback((output: string) => {
    // TODO: Show toast notification
    console.log('Output copied to clipboard');
  }, []);

  const handleShareBlock = useCallback((block: ICommandBlock) => {
    // TODO: Implement sharing functionality
    console.log('Sharing block:', block.id);
  }, []);

  const handleDeleteBlock = useCallback((blockId: string) => {
    setBlocks(prev => prev.filter(block => block.id !== blockId));
  }, []);

  return (
    <div className={`flex flex-col h-full bg-portal-secondary ${className}`}>
      
      {/* Terminal Output Area */}
      <div 
        ref={scrollAreaRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {blocks.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <div className="text-portal-text-secondary">
              <div className="text-lg font-medium mb-2">Portal Terminal</div>
              <p className="text-sm">Type a command below to get started</p>
              <p className="text-xs mt-2">AI suggestions and MCP context will appear automatically</p>
            </div>
          </div>
        ) : (
          blocks.map(block => (
            <CommandBlockEnhanced
              key={block.id}
              block={block}
              onToggleExpanded={handleToggleExpanded}
              onToggleBookmark={handleToggleBookmark}
              onCopyOutput={handleCopyOutput}
              onShareBlock={handleShareBlock}
              onDeleteBlock={handleDeleteBlock}
            />
          ))
        )}
        
        {/* Loading indicator for executing commands */}
        {isExecuting && (
          <div className="flex items-center gap-2 text-portal-text-secondary text-sm">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
            <span>Executing command...</span>
          </div>
        )}
      </div>

      {/* Command Input */}
      <div className="p-4 border-t border-portal-border bg-portal-card/30">
        <CommandInput 
          onExecuteCommand={executeCommand}
          className="max-w-4xl mx-auto"
        />
      </div>
    </div>
  );
};

// Simulate command execution with AI and MCP integration
async function simulateCommandExecution(
  command: string, 
  context: { workingDirectory: string; gitBranch: string | null }
) {
  // Simulate execution delay
  await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1500));
  
  const lowerCommand = command.toLowerCase();
  let output = '';
  let exitCode = 0;
  let aiSummary = '';
  let aiSuggestions: string[] = [];
  let errorAnalysis: ICommandBlock['errorAnalysis'];
  let mcpContext: ICommandBlock['mcpContext'];

  // Simulate different command outputs
  if (lowerCommand.includes('git status')) {
    output = `On branch ${context.gitBranch || 'main'}
Your branch is up to date with 'origin/${context.gitBranch || 'main'}'.

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
	modified:   src/components/terminal-view.tsx
	modified:   src/stores/ui-store.ts

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	src/components/command-input.tsx
	src/components/ai-model-selector.tsx

no changes added to commit (use "git add" or "git commit -a")`;

    aiSummary = 'You have 2 modified files and 2 untracked files. Consider staging your changes.';
    aiSuggestions = [
      'git add .',
      'git add src/components/',
      'git diff --staged'
    ];

    mcpContext = {
      relevantFiles: [
        'src/components/terminal-view.tsx',
        'src/stores/ui-store.ts',
        'src/components/command-input.tsx'
      ],
      relatedCommands: [
        'git add .',
        'git commit -m "feat: add terminal components"',
        'git diff HEAD~1'
      ],
      documentation: [
        'Git status documentation',
        'Portal Terminal Git integration'
      ]
    };

  } else if (lowerCommand.includes('ls') || lowerCommand.includes('dir')) {
    output = `total 24
drwxr-xr-x   8 user  staff   256 Jan 15 10:30 .
drwxr-xr-x  15 user  staff   480 Jan 15 09:15 ..
-rw-r--r--   1 user  staff   120 Jan 15 10:20 .gitignore
drwxr-xr-x   3 user  staff    96 Jan 15 10:30 components
-rw-r--r--   1 user  staff  1234 Jan 15 10:25 package.json
drwxr-xr-x   4 user  staff   128 Jan 15 10:15 src
drwxr-xr-x   2 user  staff    64 Jan 15 09:30 styles
-rw-r--r--   1 user  staff   567 Jan 15 10:28 tsconfig.json`;

    aiSummary = 'Directory contains a typical React/TypeScript project structure with components, source files, and configuration.';
    aiSuggestions = [
      'cd src',
      'find . -name "*.tsx"',
      'tree -I node_modules'
    ];

  } else if (lowerCommand.includes('npm install') || lowerCommand.includes('npm i')) {
    output = `npm WARN deprecated package@1.0.0: This package is deprecated

added 245 packages, and audited 246 packages in 3s

15 packages are looking for funding
  run \`npm fund\` for details

found 0 vulnerabilities`;

    aiSummary = 'Successfully installed dependencies. One deprecated package warning can be addressed later.';
    aiSuggestions = [
      'npm fund',
      'npm audit',
      'npm outdated'
    ];

  } else if (lowerCommand.includes('npm run') || lowerCommand.includes('npm start')) {
    output = `> portal-terminal@0.1.0 dev
> electron .

[webpack] Compiling...
[webpack] Compiled successfully in 1234ms

Electron app started on port 3000
✓ Main process ready
✓ Renderer process ready
✓ Terminal core initialized
✓ AI providers loaded (3/5 available)
✓ MCP servers connected (4/4)

🚀 Portal Terminal is ready!`;

    aiSummary = 'Application started successfully with most AI providers and all MCP servers connected.';
    aiSuggestions = [
      'npm run build',
      'npm run test',
      'npm run lint'
    ];

  } else if (lowerCommand.includes('cd ')) {
    const targetDir = command.slice(3).trim();
    if (targetDir === '..') {
      output = '';
      aiSummary = 'Moved up one directory level.';
    } else if (targetDir === '~' || targetDir === '$HOME') {
      output = '';
      aiSummary = 'Moved to home directory.';
    } else {
      output = '';
      aiSummary = `Changed to directory: ${targetDir}`;
    }
    aiSuggestions = ['pwd', 'ls -la'];

  } else if (lowerCommand.includes('error') || lowerCommand.includes('fail')) {
    // Simulate an error
    output = `bash: ${command}: command not found
Did you mean: git, npm, ls?`;
    exitCode = 127;
    
    errorAnalysis = {
      diagnosis: 'Command not found. This might be a typo or the command is not installed.',
      suggestions: [
        'Check the command spelling',
        'Verify the command is installed',
        'Use "which command" to check availability'
      ],
      severity: 'medium'
    };

  } else if (lowerCommand.startsWith('how ') || lowerCommand.startsWith('what ') || lowerCommand.startsWith('explain ')) {
    // Natural language query
    output = `I understand you're asking: "${command}"

Based on your current context:
- Working directory: ${context.workingDirectory}
- Git branch: ${context.gitBranch || 'not in a git repository'}

Here's what I can help with:
• Command explanations and examples
• Project-specific guidance
• Troubleshooting assistance
• Best practice recommendations

Would you like me to elaborate on any specific aspect?`;

    aiSummary = 'Natural language query processed. Provided contextual guidance and offered further assistance.';
    aiSuggestions = [
      'Show me git commands',
      'How do I deploy this project?',
      'Explain the project structure'
    ];

    mcpContext = {
      documentation: [
        'Portal Terminal User Guide',
        'AI Integration Documentation',
        'MCP Server Configuration'
      ],
      relatedCommands: [
        'help',
        'man command',
        'command --help'
      ]
    };

  } else {
    // Generic command simulation
    output = `Executing: ${command}
Command completed successfully.`;
    aiSummary = `Executed "${command}" in ${context.workingDirectory}`;
    aiSuggestions = ['echo "done"', `history | grep "${command}"`];
  }

  return {
    output,
    exitCode,
    aiSummary,
    aiSuggestions,
    errorAnalysis,
    mcpContext,
  };
}