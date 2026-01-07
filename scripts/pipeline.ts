/**
 * Unified Data Pipeline Script
 * 
 * Consolidates all data processing, validation, and database initialization
 * into a single orchestrated workflow. This is the main entry point for
 * new environment deployments.
 * 
 * Usage:
 *   npm run deploy                    # Full pipeline (skip if outputs exist)
 *   npm run deploy -- --force         # Force re-run all steps
 *   npm run deploy -- --skip-seed     # Skip database seeding
 *   npm run deploy -- --skip-rephrase # Skip LLM rephrasing
 * 
 * Environment Variables:
 *   DATABASE_URL       - PostgreSQL connection string (required for seeding)
 *   ANTHROPIC_API_KEY  - Anthropic API key (optional, for rephrasing)
 *   SKIP_REPHRASE      - Set to 'true' to skip rephrasing
 */

import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { runCleanup, cleanupOutputExists } from './cleanup.js';
import { runValidation } from './validate.js';
import { pushSchema, seedDatabase } from './lib/seeder.js';

// ============================================================================
// TYPES
// ============================================================================

interface PipelineOptions {
  /** Force re-run all steps even if outputs exist */
  force?: boolean;
  /** Skip data cleanup step */
  skipCleanup?: boolean;
  /** Skip LLM rephrasing step */
  skipRephrase?: boolean;
  /** Skip validation step */
  skipValidate?: boolean;
  /** Skip database seeding step */
  skipSeed?: boolean;
  /** Show verbose output */
  verbose?: boolean;
}

interface PipelineResult {
  success: boolean;
  steps: {
    cleanup: { skipped: boolean; success: boolean };
    rephrase: { skipped: boolean; success: boolean };
    validate: { skipped: boolean; success: boolean; valid: boolean };
    seed: { skipped: boolean; success: boolean };
  };
  errors: string[];
}

// ============================================================================
// FILE PATHS
// ============================================================================

const DATA_DIR = path.join(process.cwd(), 'data');
const CLEANED_FILE = path.join(DATA_DIR, 'cleaned.json');
const REPHRASED_FILE = path.join(DATA_DIR, 'rephrased.json');

// ============================================================================
// HELPERS
// ============================================================================

function parseArgs(): PipelineOptions {
  const args = process.argv.slice(2);
  
  return {
    force: args.includes('--force') || args.includes('-f'),
    skipCleanup: args.includes('--skip-cleanup'),
    skipRephrase: args.includes('--skip-rephrase') || process.env.SKIP_REPHRASE === 'true',
    skipValidate: args.includes('--skip-validate'),
    skipSeed: args.includes('--skip-seed'),
    verbose: !args.includes('--quiet') && !args.includes('-q'),
  };
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function printBanner(verbose: boolean): void {
  if (!verbose) return;
  
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║              DriveWise Deployment Pipeline                ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
}

function printStep(step: number, total: number, name: string, verbose: boolean): void {
  if (!verbose) return;
  console.log(`\n[${ step }/${ total }] ${ name }`);
  console.log('─'.repeat(50));
}

function printSkipped(reason: string, verbose: boolean): void {
  if (verbose) console.log(`   ⏭️  Skipped: ${reason}\n`);
}

function printError(message: string): void {
  console.error(`\n❌ Error: ${message}\n`);
}

// ============================================================================
// PIPELINE STEPS
// ============================================================================

async function stepCleanup(
  options: PipelineOptions,
  result: PipelineResult
): Promise<boolean> {
  const { force, skipCleanup, verbose } = options;
  
  printStep(1, 4, '🧹 Data Cleanup', verbose ?? true);
  
  if (skipCleanup) {
    printSkipped('--skip-cleanup flag', verbose ?? true);
    result.steps.cleanup = { skipped: true, success: true };
    return true;
  }
  
  // Check if cleanup output already exists
  const cleanedExists = await cleanupOutputExists();
  if (cleanedExists && !force) {
    printSkipped(`${path.basename(CLEANED_FILE)} already exists (use --force to re-run)`, verbose ?? true);
    result.steps.cleanup = { skipped: true, success: true };
    return true;
  }
  
  try {
    await runCleanup({ verbose: verbose ?? true });
    result.steps.cleanup = { skipped: false, success: true };
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.errors.push(`Cleanup failed: ${message}`);
    result.steps.cleanup = { skipped: false, success: false };
    return false;
  }
}

async function stepRephrase(
  options: PipelineOptions,
  result: PipelineResult
): Promise<boolean> {
  const { force, skipRephrase, verbose } = options;
  
  printStep(2, 4, '🤖 LLM Rephrasing', verbose ?? true);
  
  if (skipRephrase) {
    printSkipped('--skip-rephrase flag or SKIP_REPHRASE=true', verbose ?? true);
    result.steps.rephrase = { skipped: true, success: true };
    return true;
  }
  
  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    printSkipped('ANTHROPIC_API_KEY not set (rephrasing requires API key)', verbose ?? true);
    result.steps.rephrase = { skipped: true, success: true };
    return true;
  }
  
  // Check if rephrased output already exists
  const rephrasedExists = await fileExists(REPHRASED_FILE);
  if (rephrasedExists && !force) {
    printSkipped(`${path.basename(REPHRASED_FILE)} already exists (use --force to re-run)`, verbose ?? true);
    result.steps.rephrase = { skipped: true, success: true };
    return true;
  }
  
  try {
    // Dynamically import rephrase module to avoid loading Anthropic SDK if not needed
    if (verbose) console.log('   Loading rephrasing module...');
    
    // Note: We import the rephrase script but don't have an exported function yet
    // For now, we'll run it via a child process to maintain isolation
    const { execSync } = await import('child_process');
    execSync('npx tsx scripts/rephrase.ts', {
      stdio: verbose ? 'inherit' : 'pipe',
      env: process.env,
    });
    
    result.steps.rephrase = { skipped: false, success: true };
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Rephrasing failure is not fatal - we can continue with cleaned data
    if (verbose) {
      console.log(`   ⚠️  Rephrasing failed (will use cleaned data): ${message}`);
    }
    result.steps.rephrase = { skipped: false, success: false };
    return true; // Continue pipeline
  }
}

async function stepValidate(
  options: PipelineOptions,
  result: PipelineResult
): Promise<boolean> {
  const { skipValidate, verbose } = options;
  
  printStep(3, 4, '🔍 Data Validation', verbose ?? true);
  
  if (skipValidate) {
    printSkipped('--skip-validate flag', verbose ?? true);
    result.steps.validate = { skipped: true, success: true, valid: true };
    return true;
  }
  
  try {
    const validationResult = await runValidation({ verbose: verbose ?? true, exitOnError: false });
    result.steps.validate = {
      skipped: false,
      success: true,
      valid: validationResult.valid,
    };
    
    if (!validationResult.valid) {
      result.errors.push(`Validation failed with ${validationResult.summary.errorCount} errors`);
      return false;
    }
    
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.errors.push(`Validation failed: ${message}`);
    result.steps.validate = { skipped: false, success: false, valid: false };
    return false;
  }
}

async function stepSeed(
  options: PipelineOptions,
  result: PipelineResult
): Promise<boolean> {
  const { skipSeed, verbose } = options;
  
  printStep(4, 4, '🌱 Database Seeding', verbose ?? true);
  
  if (skipSeed) {
    printSkipped('--skip-seed flag', verbose ?? true);
    result.steps.seed = { skipped: true, success: true };
    return true;
  }
  
  // Check for DATABASE_URL
  if (!process.env.DATABASE_URL) {
    printSkipped('DATABASE_URL not set', verbose ?? true);
    result.steps.seed = { skipped: true, success: true };
    return true;
  }
  
  try {
    // Push schema if needed
    await pushSchema(verbose ?? true);
    
    // Seed/update data (upsert mode)
    await seedDatabase({
      verbose: verbose ?? true,
      applyFixes: true,
      assignOrphans: true,
    });
    
    result.steps.seed = { skipped: false, success: true };
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.errors.push(`Database seeding failed: ${message}`);
    result.steps.seed = { skipped: false, success: false };
    return false;
  }
}

// ============================================================================
// MAIN PIPELINE
// ============================================================================

async function runPipeline(options: PipelineOptions): Promise<PipelineResult> {
  const result: PipelineResult = {
    success: false,
    steps: {
      cleanup: { skipped: false, success: false },
      rephrase: { skipped: false, success: false },
      validate: { skipped: false, success: false, valid: false },
      seed: { skipped: false, success: false },
    },
    errors: [],
  };
  
  const { verbose } = options;
  
  printBanner(verbose ?? true);
  
  if (verbose) {
    console.log('Options:');
    console.log(`   Force: ${options.force ? 'Yes' : 'No'}`);
    console.log(`   Skip Cleanup: ${options.skipCleanup ? 'Yes' : 'No'}`);
    console.log(`   Skip Rephrase: ${options.skipRephrase ? 'Yes' : 'No'}`);
    console.log(`   Skip Validate: ${options.skipValidate ? 'Yes' : 'No'}`);
    console.log(`   Skip Seed: ${options.skipSeed ? 'Yes' : 'No'}`);
    console.log('');
  }
  
  // Step 1: Cleanup
  if (!await stepCleanup(options, result)) {
    return result;
  }
  
  // Step 2: Rephrase (optional, non-fatal)
  await stepRephrase(options, result);
  
  // Step 3: Validate
  if (!await stepValidate(options, result)) {
    return result;
  }
  
  // Step 4: Seed
  if (!await stepSeed(options, result)) {
    return result;
  }
  
  result.success = true;
  return result;
}

// ============================================================================
// CLI ENTRY POINT
// ============================================================================

async function main(): Promise<void> {
  const options = parseArgs();
  
  try {
    const result = await runPipeline(options);
    
    if (options.verbose) {
      console.log('\n' + '═'.repeat(50));
      console.log('\n📋 Pipeline Summary:\n');
      
      const stepStatus = (step: { skipped: boolean; success: boolean }) => {
        if (step.skipped) return '⏭️  Skipped';
        return step.success ? '✅ Success' : '❌ Failed';
      };
      
      console.log(`   1. Cleanup:    ${stepStatus(result.steps.cleanup)}`);
      console.log(`   2. Rephrase:   ${stepStatus(result.steps.rephrase)}`);
      console.log(`   3. Validate:   ${stepStatus(result.steps.validate)}`);
      console.log(`   4. Seed:       ${stepStatus(result.steps.seed)}`);
      
      if (result.errors.length > 0) {
        console.log('\n❌ Errors:');
        for (const error of result.errors) {
          console.log(`   - ${error}`);
        }
      }
      
      console.log('');
      if (result.success) {
        console.log('✅ Pipeline completed successfully!\n');
      } else {
        console.log('❌ Pipeline failed. See errors above.\n');
      }
    }
    
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    printError(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
