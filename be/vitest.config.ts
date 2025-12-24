/**
 * @fileoverview Vitest configuration for the Knowledge Base backend.
 * 
 * Configures test runner with coverage reporting and TypeScript support.
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    // Test files location
    include: ['tests/**/*.test.ts'],
    
    // Environment
    environment: 'node',
    
    // Global setup file for mocks and utilities
    setupFiles: ['./tests/setup.ts'],
    
    // Enable globals for describe, it, expect
    globals: true,
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      
      // Include source files
      include: ['src/**/*.ts'],
      
      // Exclude test files and non-testable files
      exclude: [
        'src/index.ts',          // Entry point
        'src/scripts/**',        // CLI scripts
        'src/db/migrations/**',  // Database migrations
        'src/db/adapters/**',    // Database adapters (need integration tests)
        'src/db/migrate.ts',     // Migration runner (CLI script)
        'src/routes/**',         // Routes (tested via service layer, handlers need integration tests)
        'src/services/minio.service.ts', // MinIO (needs real MinIO instance)
        'src/services/logger.service.ts', // Logger (Winston setup, tested structurally)
        '**/*.d.ts',
      ],
      
      // Coverage thresholds (adjusted for unit tests with mocked dependencies)
      thresholds: {
        statements: 50,
        branches: 50,
        functions: 50,
        lines: 50,
      },
    },
    
    // Test timeout
    testTimeout: 10000,
    
    // Type checking
    typecheck: {
      enabled: true,
      tsconfig: './tsconfig.json',
    },
  },
});
