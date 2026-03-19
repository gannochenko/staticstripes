# Makefile for Node-Based Video Renderer

# Colors
GREEN := \033[0;32m
BLUE := \033[0;34m
YELLOW := \033[1;33m
NC := \033[0m

.PHONY: help
help: ## Show this help message
	@echo "$(BLUE)Node-Based Video Renderer$(NC)"
	@echo ""
	@echo "$(YELLOW)Available targets:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""

.PHONY: build
build: ## Build the TypeScript code
	@echo "$(BLUE)Building...$(NC)"
	npm run build
	@echo "$(GREEN)✓ Build complete$(NC)"

.PHONY: test
test: ## Run all tests
	@echo "$(BLUE)Running tests...$(NC)"
	npm test

.PHONY: test-watch
test-watch: ## Run tests in watch mode
	@echo "$(BLUE)Running tests in watch mode...$(NC)"
	npm run test

.PHONY: clean
clean: ## Clean build artifacts
	@echo "$(BLUE)Cleaning...$(NC)"
	rm -rf dist/
	@echo "$(GREEN)✓ Clean complete$(NC)"

.PHONY: rebuild
rebuild: clean build ## Clean and rebuild

.PHONY: install
install: ## Install dependencies
	@echo "$(BLUE)Installing dependencies...$(NC)"
	npm install
	@echo "$(GREEN)✓ Installation complete$(NC)"

.PHONY: render-demo
render-demo: build ## Build and run the node demo
	@echo "$(BLUE)Running node demo...$(NC)"
	cd ../../examples/node-demo && $(MAKE) render

.PHONY: validate-demo
validate-demo: build ## Build and validate the demo
	@echo "$(BLUE)Validating node demo...$(NC)"
	cd ../../examples/node-demo && $(MAKE) validate-verbose

.PHONY: demo-help
demo-help: ## Show demo commands
	@echo "$(BLUE)Node Demo Commands$(NC)"
	@echo ""
	cd ../../examples/node-demo && $(MAKE) help

.PHONY: all
all: install build test ## Install, build, and test

.DEFAULT_GOAL := help
