# Makefile for Node-Based Video Renderer Demo
# This demonstrates all 8 node types working together

# Paths
CLI := ../../apps/node-renderer/dist/cli.js
PROJECT := project.html

# Colors for output
GREEN := \033[0;32m
BLUE := \033[0;34m
YELLOW := \033[1;33m
NC := \033[0m # No Color

.PHONY: help
help: ## Show this help message
	@echo "$(BLUE)Node-Based Video Renderer - Complete Demo$(NC)"
	@echo ""
	@echo "$(YELLOW)Available targets:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""

.PHONY: setup
setup: ## Build the node-renderer CLI
	@echo "$(BLUE)Building node-renderer...$(NC)"
	cd ../../apps/node-renderer && npm run build
	@echo "$(GREEN)✓ Build complete$(NC)"

.PHONY: validate
validate: ## Validate project.html without executing
	@echo "$(BLUE)Validating project...$(NC)"
	node $(CLI) $(PROJECT) --validate-only

.PHONY: validate-verbose
validate-verbose: ## Validate with verbose output
	@echo "$(BLUE)Validating project (verbose)...$(NC)"
	node $(CLI) $(PROJECT) --validate-only --verbose

.PHONY: render
render: ## Execute the complete DAG (with cache)
	@echo "$(BLUE)Executing project...$(NC)"
	node $(CLI) $(PROJECT)

.PHONY: render-verbose
render-verbose: ## Execute with verbose output
	@echo "$(BLUE)Executing project (verbose)...$(NC)"
	node $(CLI) $(PROJECT) --verbose

.PHONY: render-no-cache
render-no-cache: ## Execute without caching
	@echo "$(BLUE)Executing project (no cache)...$(NC)"
	node $(CLI) $(PROJECT) --no-cache

.PHONY: render-no-cache-verbose
render-no-cache-verbose: ## Execute without cache, verbose output
	@echo "$(BLUE)Executing project (no cache, verbose)...$(NC)"
	node $(CLI) $(PROJECT) --no-cache --verbose

.PHONY: clean
clean: ## Clean output directory
	@echo "$(BLUE)Cleaning output...$(NC)"
	rm -rf output/*
	@echo "$(GREEN)✓ Output cleaned$(NC)"

.PHONY: info
info: ## Show project information
	@echo "$(BLUE)Project Information$(NC)"
	@echo "  Project file: $(PROJECT)"
	@echo "  CLI tool:     $(CLI)"
	@echo "  Output dir:   ./output/"
	@echo ""
	@echo "$(YELLOW)Node Types Used:$(NC)"
	@echo "  1. openai          - Generate joke script"
	@echo "  2. elevenlabs      - Text-to-speech narration"
	@echo "  3. ai_music_api_ai - Generate background music"
	@echo "  4. project         - Main video rendering"
	@echo "  5. filesystem      - Save local preview"
	@echo "  6. s3              - Upload to S3 storage"
	@echo "  7. youtube         - Upload to YouTube"
	@echo "  8. instagram       - Post to Instagram"
	@echo ""
	@echo "$(YELLOW)Execution Flow:$(NC)"
	@echo "  joke_writer → narrator ──┐"
	@echo "  background_music ────────┼→ project → local_preview"
	@echo "                           │         ↓"
	@echo "                           │    youtube_upload"
	@echo "                           │         ↓"
	@echo "                           │   s3_storage → instagram_post"

.PHONY: test
test: validate render ## Validate and render the project

.PHONY: watch
watch: ## Watch for changes and re-render
	@echo "$(BLUE)Watching for changes...$(NC)"
	@while true; do \
		inotifywait -q -e modify $(PROJECT) 2>/dev/null || fswatch -1 $(PROJECT) 2>/dev/null; \
		clear; \
		echo "$(YELLOW)File changed, re-rendering...$(NC)"; \
		$(MAKE) render; \
	done

# Default target
.DEFAULT_GOAL := help
