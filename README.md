# Vercel AI SDK Masterclass

A comprehensive collection of AI agent examples using the Vercel AI SDK with multiple AI providers and terminal capabilities.

## 🚀 Features

- **Multiple AI Providers**: Support for Anthropic Claude, OpenAI, Google, and Perplexity
- **Terminal Integration**: AI agents with terminal command execution capabilities
- **Streaming Responses**: Real-time AI response streaming
- **Conversational Memory**: Maintains conversation context across interactions
- **Tool Integration**: Extensible tool system for AI agents

## 📁 Project Structure

```
src/
├── index.ts              # Main entry point with project overview
├── claude-terminal.ts    # Claude AI agent with terminal execution
└── [future examples]     # Additional AI examples
```

## 🛠️ Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```

   Add your API keys to `.env`:
   ```
   ANTHROPIC_API_KEY=your_anthropic_key_here
   OPENAI_API_KEY=your_openai_key_here
   GOOGLE_API_KEY=your_google_key_here
   PERPLEXITY_API_KEY=your_perplexity_key_here
   EXA_API_KEY=your_exa_key_here
   ```

## 🎯 Available Examples

### Claude Terminal Agent
An interactive AI assistant that can execute terminal commands and maintain conversations.

**Features:**
- Terminal command execution
- Real-time command output
- Conversation memory
- Streaming responses

**Run it:**
```bash
npm run claude-terminal
```

### Basic Examples
Simple starting point for the project.

**Run it:**
```bash
npm run dev
```

## 📖 Usage

### Running Specific Examples

1. **Using npm scripts:**
   ```bash
   npm run claude-terminal    # Run Claude terminal agent
   npm run dev               # Run basic example
   ```

2. **Running any file directly:**
   ```bash
   npx tsx src/<filename>    # Run any specific TypeScript file
   ```

### Example Commands for Claude Terminal Agent

Once you start the Claude terminal agent, you can interact with it naturally:

```
You: list all files in the current directory
You: check the git status
You: run npm install
You: show me the contents of package.json
You: what's my current working directory?
```

## 🔧 Development

- **TypeScript**: Full TypeScript support with tsx for execution
- **Hot Reload**: Use `npm run dev` for development
- **Environment**: Supports multiple AI providers
- **Extensible**: Easy to add new examples and tools

## 📚 Dependencies

- **@ai-sdk/anthropic**: Anthropic Claude integration
- **@ai-sdk/openai**: OpenAI GPT integration
- **@ai-sdk/google**: Google AI integration
- **@ai-sdk/perplexity**: Perplexity AI integration
- **ai**: Vercel AI SDK core
- **exa-js**: Web search capabilities
- **zod**: Schema validation

## 🤝 Contributing

Feel free to add new examples and AI agent implementations. Each example should be a separate file in the `src/` directory with a corresponding npm script in `package.json`.

## 📄 License

ISC
