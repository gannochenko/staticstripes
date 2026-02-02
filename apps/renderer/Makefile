.PHONY: install build link unlink lint lint-fix format format-check clean test test-ui demo demo-all demo-prod demo-all-prod help

# Install dependencies
install:
	npm install

# Build the project
build:
	npm run build

# Link the package globally (makes 'staticstripes' command available)
link:
	npm link

# Unlink the package globally (removes 'staticstripes' command)
unlink:
	npm unlink -g

# Run linter
lint:
	npm run lint

# Run linter with auto-fix
lint-fix:
	npm run lint:fix

# Format code
format:
	npm run format

# Check code formatting
format-check:
	npm run format:check

# Run tests
test:
	npm run test:run

# Run tests with UI
test-ui:
	npm run test:ui

# Generate demo video (youtube output) with fast preset for development
demo:
	node dist/cli.js generate -p ../../examples/demo -o youtube -d

# Generate demo video with production quality (medium preset)
demo-prod:
	node dist/cli.js generate -p ../../examples/demo -o youtube

# Generate all demo outputs with fast preset
demo-all:
	node dist/cli.js generate -p ../../examples/demo -d

# Generate all demo outputs with production quality
demo-all-prod:
	node dist/cli.js generate -p ../../examples/demo

# Clean build artifacts and dependencies
clean:
	rm -rf node_modules dist *.tsbuildinfo
	rm -f package-lock.json

# Clean cache in demo project
clean-cache:
	rm -rf ../../examples/demo/.cache

# Full build
all: install build
