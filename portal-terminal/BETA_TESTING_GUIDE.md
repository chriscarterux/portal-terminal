# Portal Terminal Beta Testing Guide

## 🎯 Beta Testing Objectives

Portal Terminal has completed Phase 4 development and is ready for beta testing. Help us validate the advanced Warp-style UI, AI integration, and MCP functionality before the official release.

## 🚀 What's New in Beta

### Advanced UI Features
- **Command Blocks**: Interactive command history with expandable output
- **AI Suggestions**: Real-time intelligent command suggestions  
- **Command Palette**: Instant access via Cmd+K to commands and AI help
- **Status Bar**: Live performance metrics and context indicators
- **Error Recovery**: Smart error analysis with automated fix suggestions

### AI Integration
- **Multi-Provider Support**: Local GPT-OSS models + external APIs
- **Context-Aware**: Understands your project, git status, and recent commands
- **Performance Optimized**: <500ms responses with smart model selection
- **Privacy-First**: Local models with optional external providers

### MCP Integration  
- **8 Context Servers**: Enhanced development context from multiple sources
- **Tool Discovery**: Automatic detection of available MCP tools
- **Resource Access**: Seamless integration with project resources
- **Health Monitoring**: Real-time server status and auto-recovery

## 📋 Beta Testing Focus Areas

### Priority 1: Core Functionality
- [ ] Terminal startup and initialization
- [ ] Basic command execution and output display
- [ ] Command block interface and interactions
- [ ] AI suggestion accuracy and performance
- [ ] MCP server connectivity and stability
- [ ] Error handling and recovery mechanisms

### Priority 2: User Experience
- [ ] Command palette functionality (Cmd+K)
- [ ] Status bar information accuracy
- [ ] Performance during extended use
- [ ] Memory usage over time
- [ ] Cross-platform compatibility
- [ ] UI responsiveness and smoothness

### Priority 3: Advanced Features
- [ ] AI model switching and optimization
- [ ] MCP context integration with AI
- [ ] Error analysis and fix suggestions
- [ ] Performance monitoring accuracy
- [ ] Context preservation across sessions
- [ ] Advanced command block actions

## 🛠️ Setup Instructions

### Prerequisites
- Node.js 18+ 
- 8GB RAM minimum (16GB recommended for local AI)
- macOS 10.15+, Windows 10+, or Linux (Ubuntu 20.04+)

### Installation
```bash
# Clone the beta repository
git clone https://github.com/portal-terminal/portal-terminal-beta.git
cd portal-terminal-beta

# Install dependencies  
npm install

# Test system capabilities
npm run test:ai              # Check AI model compatibility
npm run test:mcp             # Verify MCP server connectivity  
npm run health-check         # Overall system validation

# Start Portal Terminal
npm run dev
```

### Optional: AI Model Setup
```bash
# For local AI models (optional but recommended)
mkdir models/
npm run download-models      # Downloads GPT-OSS-20B (~8GB)
```

## 📊 Testing Scenarios

### Scenario 1: Basic Terminal Usage
1. **Open Portal Terminal**
   - Verify startup time (<2 seconds)
   - Check status bar shows correct context
   - Confirm AI and MCP indicators are active

2. **Execute Basic Commands**
   ```bash
   pwd                  # Should show current directory
   ls -la              # Should display as interactive block
   echo "Hello Portal" # Check output formatting
   ```

3. **Test Command Blocks**
   - Hover over command blocks to see actions
   - Try copying a command
   - Expand/collapse long output
   - Use the rerun button

### Scenario 2: AI Integration Testing
1. **AI Suggestions**
   - Type `git st` and wait for suggestions
   - Accept a suggestion using Tab or click
   - Try commands in different contexts (git repo vs non-git)

2. **Command Palette**
   - Press Cmd+K (or Ctrl+K on Windows/Linux)
   - Search for "git status"
   - Try AI-powered search queries
   - Execute commands from the palette

3. **Error Analysis**
   ```bash
   nonexistentcommand123    # Should trigger error analysis
   rm /protected/file       # Should show warning and suggestions
   git commit               # In repo without staged changes
   ```

### Scenario 3: MCP Integration
1. **Check MCP Status**
   - Click MCP indicator in status bar
   - Verify connected servers
   - Look for MCP tools in command palette

2. **Context Enhancement**
   - Execute git commands and observe enhanced context
   - Try file operations with MCP filesystem integration
   - Test documentation lookups

3. **MCP Tool Usage**
   - Search for MCP tools in command palette
   - Try executing MCP-enhanced commands
   - Verify context is passed to AI suggestions

### Scenario 4: Performance & Stability
1. **Extended Usage**
   - Run 50+ commands of various types
   - Monitor memory usage in Activity Monitor
   - Check for any performance degradation

2. **Stress Testing**
   - Execute multiple commands rapidly
   - Generate large outputs (e.g., `find /usr`)
   - Test with long-running commands

3. **Error Recovery**
   - Force application errors (if possible)
   - Test automatic recovery mechanisms
   - Verify data integrity after errors

## 🐛 Bug Reporting

### Critical Issues (Report Immediately)
- Application crashes or hangs
- Data loss or corruption
- Security vulnerabilities
- Memory leaks or excessive resource usage

### Bug Report Template
```
**Bug Title**: [Brief description]

**Environment**:
- OS: [macOS 14.1, Windows 11, Ubuntu 22.04, etc.]
- Node Version: [Output of `node --version`]
- Portal Terminal Version: [From package.json]
- Hardware: [RAM, CPU, GPU if relevant]

**Steps to Reproduce**:
1. [First step]
2. [Second step]
3. [Third step]

**Expected Behavior**:
[What you expected to happen]

**Actual Behavior**:
[What actually happened]

**Screenshots/Logs**:
[If applicable]

**Additional Context**:
[Any other relevant information]
```

### Feedback Areas
Please provide feedback on:
- **UI/UX**: Is the interface intuitive and pleasant to use?
- **Performance**: Does it feel snappy and responsive?
- **AI Quality**: Are the suggestions helpful and accurate?
- **Stability**: Any crashes, freezes, or unexpected behavior?
- **Features**: What works well? What's missing?
- **Documentation**: Is the setup clear and complete?

## 📈 Success Metrics

Help us measure beta success:
- **Startup Time**: Should consistently be <2 seconds
- **AI Response Time**: Suggestions should appear <500ms for 20B model
- **Memory Usage**: Should stay <200MB for typical usage
- **Error Rate**: <2% command execution failures
- **User Satisfaction**: Subjective rating of overall experience

## 🎯 Beta Timeline

- **Week 1-2**: Core functionality validation
- **Week 3-4**: Advanced feature testing
- **Week 5-6**: Performance optimization based on feedback
- **Week 7-8**: Final bug fixes and release preparation

## 🏆 Beta Tester Recognition

Beta testers will receive:
- **Credits in the final release**
- **Early access to future versions**
- **Special beta tester badge/recognition**
- **Discount on the commercial release** (if applicable)
- **Direct input on final feature priorities**

## 📞 Support & Communication

### Beta Tester Channels
- **GitHub Issues**: For bug reports and feature requests
- **Discord Community**: Real-time chat and discussion
- **Beta Email List**: Weekly updates and announcements
- **Feedback Surveys**: Structured feedback collection

### Response Times
- **Critical Issues**: <24 hours
- **Bug Reports**: <48 hours  
- **Feature Requests**: <1 week
- **General Questions**: <72 hours

## 🚀 After Beta

Your feedback will directly influence:
- Feature prioritization for v1.0
- Performance optimization targets
- UI/UX improvements
- Additional platform support
- Pricing and licensing models

Thank you for helping make Portal Terminal the best AI-powered terminal experience! 

---

*Portal Terminal Beta - The Future of Terminal Interaction*

**Questions?** Contact us at beta@portal-terminal.com