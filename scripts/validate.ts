/**
 * Data Validation Script
 * 
 * Validates the cleaned/rephrased data for:
 * 1. JSON structure integrity
 * 2. Required fields presence
 * 3. Answer validity (index within choices range)
 * 4. Language detection (Dutch)
 * 5. Length sanity checks
 * 
 * Input: data/rephrased.json (or data/cleaned.json)
 * Output: Validation report
 */

import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import type { CleanedQuestion, AnswerType } from '../server/types/index.js';

// ============================================================================
// FILE PATHS
// ============================================================================

const INPUT_FILE = path.join(process.cwd(), 'data', 'rephrased.json');
const FALLBACK_FILE = path.join(process.cwd(), 'data', 'cleaned.json');

// ============================================================================
// TYPES
// ============================================================================

export interface ValidationError {
  questionId: string;
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  totalQuestions: number;
  errors: ValidationError[];
  warnings: ValidationError[];
  summary: {
    errorCount: number;
    warningCount: number;
    byField: Record<string, number>;
  };
}

export interface ValidateOptions {
  inputFile?: string;
  verbose?: boolean;
  exitOnError?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Common Dutch words to detect language
const DUTCH_WORDS = [
  'de', 'het', 'een', 'is', 'van', 'en', 'in', 'op', 'te', 'dat',
  'zijn', 'wordt', 'met', 'voor', 'niet', 'aan', 'bij', 'als', 'maar',
  'rijden', 'bestuurder', 'voertuig', 'weg', 'verkeer', 'snelheid',
  'voorrang', 'kruispunt', 'parkeren', 'stopppen', 'bord', 'licht',
  'wie', 'wat', 'waar', 'hoe', 'waarom', 'wanneer', 'welke', 'uit'
];

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

function containsDutchWords(text: string): boolean {
  const lowerText = text.toLowerCase();
  const words = lowerText.split(/\s+/);
  const dutchWordCount = words.filter(w => DUTCH_WORDS.includes(w)).length;
  return dutchWordCount >= 2 || (words.length < 5 && dutchWordCount >= 1);
}

function validateQuestion(question: CleanedQuestion): ValidationError[] {
  const errors: ValidationError[] = [];
  const id = question.originalId;

  // Required fields
  if (!question.questionText?.trim()) {
    errors.push({
      questionId: id,
      field: 'questionText',
      message: 'Question text is empty',
      severity: 'error',
    });
  }

  if (!question.categorySlug?.trim()) {
    errors.push({
      questionId: id,
      field: 'categorySlug',
      message: 'Category slug is empty',
      severity: 'error',
    });
  }

  if (!question.answerType) {
    errors.push({
      questionId: id,
      field: 'answerType',
      message: 'Answer type is missing',
      severity: 'error',
    });
  }

  // Validate answer based on type
  const validAnswerTypes: AnswerType[] = ['SINGLE_CHOICE', 'YES_NO', 'INPUT', 'ORDER'];
  if (!validAnswerTypes.includes(question.answerType)) {
    errors.push({
      questionId: id,
      field: 'answerType',
      message: `Invalid answer type: ${question.answerType}`,
      severity: 'error',
    });
  }

  // Check answer validity for choice-based questions
  if (['SINGLE_CHOICE', 'YES_NO'].includes(question.answerType)) {
    const answerIndex = question.answer as number;
    if (typeof answerIndex !== 'number' || answerIndex < 0) {
      errors.push({
        questionId: id,
        field: 'answer',
        message: `Invalid answer index: ${answerIndex}`,
        severity: 'error',
      });
    } else if (answerIndex >= question.choices.length) {
      errors.push({
        questionId: id,
        field: 'answer',
        message: `Answer index ${answerIndex} out of range (${question.choices.length} choices)`,
        severity: 'error',
      });
    }
  }

  // Check ORDER type
  if (question.answerType === 'ORDER') {
    if (!Array.isArray(question.answer)) {
      errors.push({
        questionId: id,
        field: 'answer',
        message: 'ORDER type requires array answer',
        severity: 'error',
      });
    }
  }

  // Choices validation (for non-INPUT types)
  if (question.answerType !== 'INPUT') {
    if (!question.choices || question.choices.length === 0) {
      errors.push({
        questionId: id,
        field: 'choices',
        message: 'No choices provided for non-INPUT question',
        severity: 'error',
      });
    } else {
      // Check each choice has either text or image
      for (let i = 0; i < question.choices.length; i++) {
        const choice = question.choices[i];
        if (!choice.text?.trim() && !choice.imageUuid) {
          errors.push({
            questionId: id,
            field: `choices[${i}]`,
            message: 'Choice has neither text nor image',
            severity: 'error',
          });
        }
      }
    }
  }

  // Language detection (warning only)
  if (question.questionText && !containsDutchWords(question.questionText)) {
    errors.push({
      questionId: id,
      field: 'questionText',
      message: 'Question may not be in Dutch',
      severity: 'warning',
    });
  }

  // Length sanity check
  if (question.questionText && question.questionText.length < 10) {
    errors.push({
      questionId: id,
      field: 'questionText',
      message: 'Question text suspiciously short',
      severity: 'warning',
    });
  }

  if (question.questionText && question.questionText.length > 2000) {
    errors.push({
      questionId: id,
      field: 'questionText',
      message: 'Question text unusually long',
      severity: 'warning',
    });
  }

  return errors;
}

// ============================================================================
// CORE VALIDATION FUNCTION (exportable)
// ============================================================================

/**
 * Run data validation
 * Can be called programmatically from the pipeline
 */
export async function runValidation(options: ValidateOptions = {}): Promise<ValidationResult> {
  const {
    inputFile,
    verbose = true,
    exitOnError = false,
  } = options;

  if (verbose) console.log('🔍 Starting data validation...\n');

  // Determine input file
  let actualInputFile = inputFile;
  if (!actualInputFile) {
    try {
      await fs.access(INPUT_FILE);
      actualInputFile = INPUT_FILE;
    } catch {
      if (verbose) console.log(`   ${INPUT_FILE} not found, using ${FALLBACK_FILE}`);
      actualInputFile = FALLBACK_FILE;
    }
  }

  if (verbose) console.log(`📂 Reading ${actualInputFile}...`);
  const inputData = JSON.parse(await fs.readFile(actualInputFile, 'utf-8'));
  const questions: CleanedQuestion[] = inputData.data;
  if (verbose) console.log(`   Found ${questions.length} questions\n`);

  // Validate all questions
  if (verbose) console.log('🔄 Validating questions...');
  const allErrors: ValidationError[] = [];

  for (const question of questions) {
    const errors = validateQuestion(question);
    allErrors.push(...errors);
  }

  // Separate errors and warnings
  const errors = allErrors.filter(e => e.severity === 'error');
  const warnings = allErrors.filter(e => e.severity === 'warning');

  // Count by field
  const byField: Record<string, number> = {};
  for (const error of allErrors) {
    byField[error.field] = (byField[error.field] || 0) + 1;
  }

  const result: ValidationResult = {
    valid: errors.length === 0,
    totalQuestions: questions.length,
    errors,
    warnings,
    summary: {
      errorCount: errors.length,
      warningCount: warnings.length,
      byField,
    },
  };

  // Print report
  if (verbose) {
    console.log('\n📊 Validation Results:\n');
    console.log(`   Total questions: ${result.totalQuestions}`);
    console.log(`   Errors: ${result.summary.errorCount}`);
    console.log(`   Warnings: ${result.summary.warningCount}`);
    console.log(`   Valid: ${result.valid ? '✅ YES' : '❌ NO'}`);

    if (Object.keys(byField).length > 0) {
      console.log('\n📈 Issues by field:');
      for (const [field, count] of Object.entries(byField).sort((a, b) => b[1] - a[1])) {
        console.log(`   ${field}: ${count}`);
      }
    }

    if (errors.length > 0) {
      console.log('\n❌ Errors (first 10):');
      for (const error of errors.slice(0, 10)) {
        console.log(`   [${error.questionId}] ${error.field}: ${error.message}`);
      }
      if (errors.length > 10) {
        console.log(`   ... and ${errors.length - 10} more errors`);
      }
    }

    if (warnings.length > 0 && warnings.length <= 20) {
      console.log('\n⚠️ Warnings:');
      for (const warning of warnings) {
        console.log(`   [${warning.questionId}] ${warning.field}: ${warning.message}`);
      }
    } else if (warnings.length > 20) {
      console.log(`\n⚠️ ${warnings.length} warnings (showing first 10):`);
      for (const warning of warnings.slice(0, 10)) {
        console.log(`   [${warning.questionId}] ${warning.field}: ${warning.message}`);
      }
    }
  }

  // Exit with error code if validation failed and exitOnError is true
  if (!result.valid && exitOnError) {
    if (verbose) console.log('\n❌ Validation failed! Fix errors before seeding database.');
    process.exit(1);
  }

  if (verbose && result.valid) {
    console.log('\n✅ Validation passed!');
  }

  return result;
}

/**
 * Get the default input file path (rephrased or cleaned)
 */
export async function getValidationInputPath(): Promise<string> {
  try {
    await fs.access(INPUT_FILE);
    return INPUT_FILE;
  } catch {
    return FALLBACK_FILE;
  }
}

// ============================================================================
// CLI ENTRY POINT
// ============================================================================

async function main() {
  try {
    const result = await runValidation({ verbose: true, exitOnError: true });
    if (!result.valid) {
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  }
}

// Only run main if this is the entry point
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main();
}
