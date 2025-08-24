.PHONY: help install build dev test lint format clean

help: ## Show this help message
	@echo "Portal Terminal Development Commands"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

setup: ## Initial project setup
	npm run dev:setup

install: ## Install all dependencies
	npm install

build: ## Build all packages and apps
	npm run build

dev: ## Start development environment
	npm run dev

test: ## Run all tests
	npm run test:all

test-unit: ## Run unit tests only
	npm run test

test-e2e: ## Run E2E tests only
	npm run test:e2e

lint: ## Lint all code
	npm run lint

lint-fix: ## Lint and fix all code
	npm run lint:fix

format: ## Format all code
	npm run format

format-check: ## Check code formatting
	npm run format:check

type-check: ## Run TypeScript type checking
	npm run type-check

quality: ## Run all quality checks
	npm run type-check && npm run lint && npm run format:check

clean: ## Clean build artifacts
	rm -rf dist/ node_modules/ apps/*/dist packages/*/dist services/*/dist
	rm -rf test-results/ playwright-report/ coverage/

reset: clean install ## Full environment reset