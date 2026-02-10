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

# Generate demo video with production quality
demo-prod:
	node dist/cli.js generate -p ../../examples/demo -o youtube --option production

# Generate all demo outputs with preview preset
demo-all:
	node dist/cli.js generate -p ../../examples/demo --option preview

# Generate all demo outputs with production quality
demo-all-prod:
	node dist/cli.js generate -p ../../examples/demo --option production

# Clean build artifacts and dependencies
clean:
	rm -rf node_modules dist *.tsbuildinfo
	rm -f package-lock.json

# Clean cache in demo project
clean-cache:
	rm -rf ../../examples/demo/cache

# Full build
all: install build

# Generate demo video (youtube output) with preview preset
demo:
	make build
	node dist/cli.js generate -p ../../examples/demo -o youtube --option meh --debug

demoi:
	make build
	node dist/cli.js generate -p ../../examples/demo -o instagram_shorts

demoauth:
	make build
	node dist/cli.js auth -p ../../examples/demo --upload-name yt_primary

demoauthi:
	make build
	node dist/cli.js auth -p ../../examples/demo --upload-name ig_primary

demoupload:
	make build
	node dist/cli.js upload -p ../../examples/demo --upload-name yt_primary

demouploadi:
	make build
	node dist/cli.js upload -p ../../examples/demo --upload-name ig_primary

demouploads3:
	make build
	node dist/cli.js upload -p ../../examples/demo --upload-name s3_primary

authhelpi:
	make build
	node dist/cli.js auth-help instagram
