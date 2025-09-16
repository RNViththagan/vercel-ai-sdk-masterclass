# Vercel AI SDK Masterclass

A comprehensive collection of AI agent examples using the Vercel AI SDK with multiple AI providers, terminal capabilities, and advanced AI functions.

## 🚀 Features

- **Multiple AI Providers**: Support for Anthropic Claude, OpenAI, Google, and Perplexity
- **Terminal Integration**: AI agents with terminal command execution capabilities
- **Streaming Responses**: Real-time AI response streaming
- **Conversational Memory**: Maintains conversation context across interactions
- **Tool Integration**: Extensible tool system for AI agents
- **Object Generation**: Structured data generation with schemas
- **Web Search Integration**: Real-time web search capabilities with Exa
- **Search Query Enhancement**: AI-powered search query generation

## 📁 Project Structure

```
src/
├── index.ts              # Weather demo with tools and structured output
├── claude-terminal.ts    # Claude AI agent with terminal execution
├── generate-object.ts    # generateObject function examples
├── search-queries.ts     # AI-powered search query generation with web search
└── [future examples]     # Additional AI examples
```

## 🛠️ Setup

1. **Clone the repository:**

   ```bash
   git clone https://github.com/RNViththagan/vercel-ai-sdk-masterclass.git
   cd vercel-ai-sdk-masterclass
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Configure environment variables:**

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
   BOT_NAME=YourBotName
   ```

## 🎯 Available Examples

### 1. Weather Demo with Tools (`index.ts`)

Demonstrates tool usage, structured output, and multi-step reasoning.

**Features:**

- Weather API integration
- Number addition tool
- Structured output with schemas
- Multi-step tool execution

**Run it:**

```bash
npm run dev
```

### 2. Claude Terminal Agent (`claude-terminal.ts`)

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

### 3. Claude Terminal with Resume (`claude-terminal-resume.ts`)

Enhanced version of Claude terminal with conversation management and resume capabilities.

**Features:**

- Resume any of your last 10 conversations
- Conversation browser with metadata
- Auto-save after each exchange
- Special commands: `save`, `history`, `exit`
- Context preview when resuming
- Full conversation management utilities

**Run it:**

```bash
npm run claude-terminal-resume
```

**Conversation Management:**

```bash
# List all conversations
node conversation-utils.js list

# Show conversation details
node conversation-utils.js show 1

# Export conversation to text
node conversation-utils.js export 1 txt

# Delete a conversation
node conversation-utils.js delete 1
```

### 4. Object Generation Examples (`generate-object.ts`)

Demonstrates structured data generation with Zod schemas.

**Features:**

- Schema-based object generation
- AI agent definitions with jargon
- Type-safe outputs

**Run it:**

```bash
npm run generate-object
```

### 5. Search Query Generator (`search-queries.ts`)

AI-powered search query generation with web search integration.

**Features:**

- Multiple search query variations
- Real-time web search with Exa
- Search result processing
- File export capabilities

**Run it:**

```bash
npm run search-queries
```

## 📖 Usage

### Running Specific Examples

```bash
# Weather demo with tools
npm run dev

# Claude terminal agent
npm run claude-terminal

# Claude terminal with resume
npm run claude-terminal-resume

# Object generation examples
npm run generate-object

# Search query generator
npm run search-queries
```

### Running any file directly:

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

### Example Queries for Search Generator

The search query generator can enhance your research:

```
Original: "artificial intelligence"
Generated:
1. "AI technology applications 2025"
2. "artificial intelligence machine learning"
3. "AI development trends and future"
```

## 🔧 Development

- **TypeScript**: Full TypeScript support with tsx for execution
- **Hot Reload**: Use `npm run dev` for development
- **Environment**: Supports multiple AI providers
- **Extensible**: Easy to add new examples and tools
- **Type Safety**: Zod schemas for structured data

## 📚 Dependencies

### Core AI SDK

- **@ai-sdk/anthropic**: Anthropic Claude integration
- **@ai-sdk/openai**: OpenAI GPT integration
- **@ai-sdk/google**: Google AI integration
- **@ai-sdk/perplexity**: Perplexity AI integration
- **ai**: Vercel AI SDK core

### Additional Tools

- **exa-js**: Real-time web search capabilities
- **zod**: Schema validation and type safety
- **dotenv**: Environment variable management

### Development

- **tsx**: TypeScript execution
- **@types/node**: Node.js type definitions

## 🌟 Key Concepts Demonstrated

1. **Tool Integration**: How to add custom tools to AI agents
2. **Structured Output**: Using schemas for type-safe AI responses
3. **Multi-step Reasoning**: AI agents that can use multiple tools
4. **Streaming**: Real-time response streaming
5. **Web Integration**: Combining AI with external APIs
6. **Terminal Integration**: AI agents with system access
7. **Conversation Memory**: Maintaining context across interactions

## 🤝 Contributing

Feel free to add new examples and AI agent implementations. Each example should be a separate file in the `src/` directory with a corresponding npm script in `package.json`.

### Adding New Examples

1. Create a new TypeScript file in `src/`
2. Add a corresponding script in `package.json`
3. Update this README with documentation
4. Test the example works correctly

## 📄 License

ISC

## 🔗 Links

- [Vercel AI SDK Documentation](https://sdk.vercel.ai/docs)
- [Anthropic Claude API](https://docs.anthropic.com/)
- [OpenAI API](https://platform.openai.com/docs)
- [Exa Search API](https://docs.exa.ai/)

---

**Made with ❤️ using the Vercel AI SDK**
