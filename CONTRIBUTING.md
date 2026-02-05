# Contributing to Seed Agent

First off, thank you for considering contributing to Seed Agent! 🌱

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Style Guidelines](#style-guidelines)
- [Testing](#testing)
- [Documentation](#documentation)

## Code of Conduct

This project and everyone participating in it is governed by our commitment to providing a welcoming and inclusive environment. Please be respectful and constructive in all interactions.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/seed-agent.git
   cd seed-agent
   ```
3. **Add the upstream remote**:
   ```bash
   git remote add upstream https://github.com/seedstr/seed-agent.git
   ```
4. **Install dependencies**:
   ```bash
   npm install
   ```

## Development Setup

### Prerequisites

- Node.js 18 or higher
- npm 9 or higher

### Environment Setup

```bash
# Copy the environment template
cp .env.example .env

# Edit .env with test credentials (you can use mock values for development)
```

### Running in Development

```bash
# Start with hot reload
npm run dev

# Run the CLI directly
npm run cli -- status

# Run tests in watch mode
npm test
```

## Making Changes

### Branch Naming

Use descriptive branch names:

- `feature/add-new-tool` - New features
- `fix/api-error-handling` - Bug fixes
- `docs/update-readme` - Documentation
- `refactor/improve-config` - Code refactoring
- `test/add-llm-tests` - Adding tests

### Commit Messages

Follow conventional commits format:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, semicolons, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Build process, dependencies, etc.

Examples:
```
feat(tools): add weather lookup tool
fix(api): handle rate limiting errors
docs(readme): add troubleshooting section
test(calculator): add edge case tests
```

## Pull Request Process

1. **Update your fork**:
   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   ```

2. **Create a feature branch**:
   ```bash
   git checkout -b feature/my-feature
   ```

3. **Make your changes** and commit them

4. **Run quality checks**:
   ```bash
   npm run typecheck  # Check types
   npm run lint       # Lint code
   npm run test:run   # Run tests
   ```

5. **Push to your fork**:
   ```bash
   git push origin feature/my-feature
   ```

6. **Open a Pull Request** on GitHub

### PR Requirements

- [ ] All tests pass
- [ ] Type checking passes
- [ ] Linting passes
- [ ] New features have tests
- [ ] Documentation is updated if needed
- [ ] PR description explains the changes

## Style Guidelines

### TypeScript

- Use TypeScript strict mode
- Prefer `interface` over `type` for object shapes
- Export types that are used across modules
- Use explicit return types for public functions

```typescript
// Good
export interface Config {
  apiKey: string;
  timeout: number;
}

export function getConfig(): Config {
  return { apiKey: "...", timeout: 5000 };
}

// Avoid
export type Config = { apiKey: string; timeout: number };

export function getConfig() {
  return { apiKey: "...", timeout: 5000 };
}
```

### Code Organization

- Keep files focused and small (< 300 lines)
- One component/class per file
- Group related functionality in directories
- Use index.ts files for public exports

### Naming Conventions

- `camelCase` for variables and functions
- `PascalCase` for classes, interfaces, and types
- `UPPER_SNAKE_CASE` for constants
- Descriptive names over abbreviations

### Comments

- Use JSDoc for public APIs
- Explain "why" not "what"
- Keep comments up to date

```typescript
/**
 * Generates a response for a Seedstr job using the configured LLM.
 * Includes tool calling for web search and calculations.
 *
 * @param job - The job to respond to
 * @returns The generated response text
 */
async function generateJobResponse(job: Job): Promise<string> {
  // Use higher temperature for creative prompts
  const temp = job.prompt.includes("creative") ? 1.0 : 0.7;
  // ...
}
```

## Testing

### Writing Tests

- Test files go in `tests/` directory
- Name test files `*.test.ts`
- Use descriptive test names

```typescript
describe("Calculator Tool", () => {
  describe("Basic Operations", () => {
    it("should add two numbers correctly", () => {
      expect(calculator("2 + 2").result).toBe(4);
    });

    it("should handle negative numbers", () => {
      expect(calculator("-5 + 3").result).toBe(-2);
    });
  });
});
```

### Test Coverage

We aim for high test coverage on core functionality:

- API client methods
- Tool implementations
- Configuration handling
- Utility functions

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- calculator

# Run with coverage
npm run test:coverage
```

## Documentation

### README Updates

Update the README when you:
- Add new features
- Change configuration options
- Add new CLI commands
- Change the project structure

### Code Documentation

- Add JSDoc comments to public functions
- Include parameter descriptions
- Provide usage examples for complex APIs

### Changelog

For significant changes, add an entry to describe what changed.

## Adding New Features

### Adding a New Tool

1. Create the tool in `src/tools/`:
   ```typescript
   // src/tools/myTool.ts
   export interface MyToolResult {
     data: string;
   }

   export async function myTool(input: string): Promise<MyToolResult> {
     // Implementation
     return { data: "result" };
   }
   ```

2. Register it in `src/llm/client.ts`:
   ```typescript
   tools.my_tool = tool({
     description: "What this tool does",
     parameters: z.object({
       input: z.string().describe("Input description"),
     }),
     execute: async ({ input }) => myTool(input),
   });
   ```

3. Add configuration if needed in `.env.example` and `src/config/`

4. Write tests in `tests/myTool.test.ts`

5. Update documentation

### Adding a New CLI Command

1. Create the command in `src/cli/commands/`:
   ```typescript
   // src/cli/commands/myCommand.ts
   export async function myCommand(options: Options): Promise<void> {
     // Implementation
   }
   ```

2. Register it in `src/cli/index.ts`:
   ```typescript
   program
     .command("mycommand")
     .description("Description")
     .action(myCommand);
   ```

3. Add npm script if appropriate

4. Update README with usage instructions

## Questions?

Feel free to open an issue for:
- Bug reports
- Feature requests
- Questions about the codebase
- Discussion about potential changes

Thank you for contributing! 🌱
