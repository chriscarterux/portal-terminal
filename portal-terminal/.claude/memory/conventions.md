# Portal Terminal - Development Conventions

## Code Style
- **Language**: TypeScript throughout (strict mode)
- **Formatting**: Prettier with 2-space indentation
- **Linting**: ESLint with TypeScript rules
- **Import Order**: External deps → Internal packages → Relative imports

## Naming Conventions
- **Files**: kebab-case (terminal-manager.ts, command-block.tsx)
- **Classes**: PascalCase (TerminalManager, CommandBlock)
- **Functions**: camelCase (executeCommand, createSession)
- **Constants**: SCREAMING_SNAKE_CASE (DEFAULT_SHELL, MAX_BLOCKS)
- **Interfaces**: PascalCase with 'I' prefix (ITerminalOptions)

## Project Structure
- **Monorepo**: npm workspaces (no Lerna needed)
- **Build**: Vite for renderer, tsc for Node.js packages
- **Testing**: Jest for unit tests, Playwright for E2E
- **Packages**: Scoped with @portal/ prefix

## Performance Standards
- **Bundle Size**: <10MB total app size
- **Startup**: <2 seconds cold start
- **Memory**: <200MB baseline usage
- **AI Response**: <500ms for 20B model, <5s for 120B

## Git Conventions
- **Branches**: feature/description, fix/description
- **Commits**: Conventional commits (feat:, fix:, docs:)
- **PRs**: Require CI passing + code review

## Quality Gates
- **Type Safety**: Strict TypeScript, no any types
- **Test Coverage**: >80% for core packages
- **Performance**: Benchmark against Warp standards
- **Security**: No secrets in code, secure IPC