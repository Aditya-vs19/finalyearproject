#!/usr/bin/env node

/**
 * Complete Image Flow Test Runner
 * 
 * This script runs all integration tests for the complete image flow
 * including upload, storage, display, and cross-browser compatibility.
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configurations
const testSuites = [
  {
    name: 'Backend Integration Tests',
    command: 'npx',
    args: ['vitest', 'run', 'tests/integration/completeImageFlow.test.js', '--reporter=verbose'],
    cwd: path.resolve(__dirname, '..')
  },
  {
    name: 'Cross-Browser E2E Tests',
    command: 'npx',
    args: ['vitest', 'run', 'tests/e2e/crossBrowserImageFlow.test.js', '--reporter=verbose'],
    cwd: path.resolve(__dirname, '..')
  },
  {
    name: 'Frontend Integration Tests',
    command: 'npx',
    args: ['vitest', 'run', 'src/components/__tests__/CompleteImageFlow.simple.test.js', '--reporter=verbose'],
    cwd: path.resolve(__dirname, '../../gp-connect')
  }
];

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function runTest(testSuite) {
  return new Promise((resolve, reject) => {
    log(`\n${colors.cyan}🧪 Running: ${testSuite.name}${colors.reset}`);
    log(`${colors.yellow}Command: ${testSuite.command} ${testSuite.args.join(' ')}${colors.reset}`);
    log(`${colors.yellow}Working Directory: ${testSuite.cwd}${colors.reset}\n`);

    const startTime = Date.now();
    
    const child = spawn(testSuite.command, testSuite.args, {
      cwd: testSuite.cwd,
      stdio: 'inherit',
      shell: process.platform === 'win32'
    });

    child.on('close', (code) => {
      const duration = Date.now() - startTime;
      const durationSeconds = (duration / 1000).toFixed(2);
      
      if (code === 0) {
        log(`${colors.green}✅ ${testSuite.name} completed successfully in ${durationSeconds}s${colors.reset}`);
        resolve({ name: testSuite.name, success: true, duration, code });
      } else {
        log(`${colors.red}❌ ${testSuite.name} failed with exit code ${code} after ${durationSeconds}s${colors.reset}`);
        resolve({ name: testSuite.name, success: false, duration, code });
      }
    });

    child.on('error', (error) => {
      log(`${colors.red}❌ Error running ${testSuite.name}: ${error.message}${colors.reset}`);
      reject({ name: testSuite.name, error: error.message });
    });
  });
}

async function runAllTests() {
  log(`${colors.bright}${colors.magenta}🚀 Starting Complete Image Flow Integration Tests${colors.reset}`);
  log(`${colors.bright}${colors.magenta}=================================================${colors.reset}\n`);

  const results = [];
  let totalDuration = 0;

  for (const testSuite of testSuites) {
    try {
      const result = await runTest(testSuite);
      results.push(result);
      totalDuration += result.duration;
    } catch (error) {
      results.push(error);
      log(`${colors.red}Failed to run ${error.name}: ${error.error}${colors.reset}`);
    }
  }

  // Print summary
  log(`\n${colors.bright}${colors.magenta}📊 Test Results Summary${colors.reset}`);
  log(`${colors.bright}${colors.magenta}======================${colors.reset}\n`);

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  results.forEach(result => {
    const status = result.success ? `${colors.green}✅ PASSED` : `${colors.red}❌ FAILED`;
    const duration = result.duration ? `(${(result.duration / 1000).toFixed(2)}s)` : '';
    log(`${status} ${result.name} ${duration}${colors.reset}`);
  });

  log(`\n${colors.bright}Total Tests: ${results.length}${colors.reset}`);
  log(`${colors.green}Passed: ${successful.length}${colors.reset}`);
  log(`${colors.red}Failed: ${failed.length}${colors.reset}`);
  log(`${colors.yellow}Total Duration: ${(totalDuration / 1000).toFixed(2)}s${colors.reset}`);

  if (failed.length === 0) {
    log(`\n${colors.bright}${colors.green}🎉 All tests passed! Image flow integration is working correctly.${colors.reset}`);
    process.exit(0);
  } else {
    log(`\n${colors.bright}${colors.red}💥 ${failed.length} test suite(s) failed. Please check the output above.${colors.reset}`);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  log(`\n${colors.yellow}⚠️  Test execution interrupted by user${colors.reset}`);
  process.exit(130);
});

process.on('SIGTERM', () => {
  log(`\n${colors.yellow}⚠️  Test execution terminated${colors.reset}`);
  process.exit(143);
});

// Run the tests
runAllTests().catch(error => {
  log(`${colors.red}💥 Unexpected error: ${error.message}${colors.reset}`);
  process.exit(1);
});