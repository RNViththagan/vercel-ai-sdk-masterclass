# Contributing to Vercel AI SDK Masterclass

Thank you for your interest in contributing to this project! We welcome contributions of all kinds.

## How to Contribute

### Adding New Examples

1. **Fork the repository** and create a new branch for your feature
2. **Create a new TypeScript file** in the `src/` directory
3. **Add a corresponding script** in `package.json`
4. **Update the README.md** with documentation for your example
5. **Test your example** to ensure it works correctly
6. **Submit a pull request** with a clear description

### Example Template

When creating a new example, follow this structure:

```typescript
import "dotenv/config";
import { anthropic } from "@ai-sdk/anthropic"; // or your preferred provider
import { generateText } from "ai"; // or other AI SDK functions

const main = async () => {
  try {
    // Your AI implementation here
    console.log("Your example output");
  } catch (error) {
    console.error("Error:", error);
    console.log("Make sure to set required API keys in your .env file");
  }
};

main().catch(console.error);
```

### Guidelines

- **Use TypeScript** for all examples
- **Include proper error handling** with helpful messages
- **Add comments** to explain complex logic
- **Use environment variables** for API keys
- **Follow the existing code style**
- **Test thoroughly** before submitting

### Areas for Contribution

We'd love to see examples for:

- **New AI Providers**: Examples using different AI services
- **Advanced Tools**: Complex tool integrations
- **Real-world Applications**: Practical use cases
- **Performance Optimizations**: Efficient AI usage patterns
- **Error Handling**: Robust error management
- **Testing**: Unit tests for AI functions

### Reporting Issues

If you find a bug or have a suggestion:

1. Check if the issue already exists
2. Create a detailed issue description
3. Include steps to reproduce (for bugs)
4. Suggest improvements (for enhancements)

### Code of Conduct

- Be respectful and inclusive
- Help others learn and grow
- Focus on constructive feedback
- Maintain a positive environment

### Getting Help

If you need help contributing:

- Check the README.md for setup instructions
- Look at existing examples for patterns
- Open an issue for questions
- Join discussions in existing issues

Thank you for making this project better! 🚀
