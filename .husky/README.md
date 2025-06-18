# Git Hooks Setup

This project uses Husky for Git hooks. The hooks will be automatically installed when you run `pnpm install` in a Git repository.

## Available Hooks

### pre-commit
- Runs `lint-staged` to format and lint staged files using Biome

### pre-push
- Runs type checking (`pnpm check`)
- Runs all tests (`pnpm test`)

## Manual Setup

If the hooks aren't working, you can manually set them up:

```bash
# Initialize git repository if not already done
git init

# Install husky
pnpm exec husky init

# Make hooks executable
chmod +x .husky/pre-commit
chmod +x .husky/pre-push
```

## Bypass Hooks

If you need to bypass hooks temporarily:

```bash
# Bypass pre-commit
git commit --no-verify

# Bypass pre-push
git push --no-verify
```

Use this sparingly and only when necessary!