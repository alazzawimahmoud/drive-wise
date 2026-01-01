/**
 * LLM Rephrasing Script
 * 
 * This script uses Claude 3.5 Sonnet to rephrase questions and explanations
 * while preserving the exact legal meaning.
 * 
 * Input: data/cleaned.json
 * Output: data/rephrased.json
 * Progress: data/progress.json (for resuming)
 */

import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import pLimit from 'p-limit';
import type { CleanedQuestion } from '../server/types/index.js';

const INPUT_FILE = path.join(process.cwd(), 'data', 'cleaned.json');
const OUTPUT_FILE = path.join(process.cwd(), 'data', 'rephrased.json');
const PROGRESS_FILE = path.join(process.cwd(), 'data', 'progress.json');

const BATCH_SIZE = parseInt(process.env.REPHRASE_BATCH_SIZE || '10', 10);
const CONCURRENCY = parseInt(process.env.REPHRASE_CONCURRENCY || '2', 10);
const LIMIT = process.env.REPHRASE_LIMIT ? parseInt(process.env.REPHRASE_LIMIT, 10) : null;
const ONLY_EXPORT_REPHRASED = process.env.REPHRASE_ONLY_EXPORT_REPHRASED === 'true';

const SYSTEM_PROMPT = `You are a professional editor specializing in Standard Belgian Dutch (Algemeen Belgisch Nederlands) within the domain of Belgian driving license training.
Task: Rephrase the user provided text while strictly enforcing an identical or near-identical word count.
1. Strict Length Control: The output length must be almost identical to the input length. The allowed margin of difference is maximum 2 or 3 words.
2. Minimal Variation: The result should look similar to the original text in structure and flow, but it must never be an exact copy. Achieve this by swapping non-technical verbs or adjectives and making minor grammatical tweaks, rather than rewriting whole sentences.
3. Strict Terminology: You must strictly adhere to the official terminology of the Belgian Highway Code. Do NOT use synonyms for defined terms (e.g. keep bebouwde kom, MTM, sleep). Never change specific traffic definitions.
4. No Citations: Do not add explicit mentions of the 'Wegcode' or 'Verkeersreglement' unless they appear in the original text.
5. Localization: Use Standard Belgian Dutch. Strictly avoid Netherlandic (Hollands) forms (avoid u, hartstikke, nou; use autosnelweg).`;

interface RephrasedContent {
  question: string;
  explanation: string;
}

interface ProgressData {
  processedIds: string[];
  lastBatchIndex: number;
  startedAt: string;
  lastUpdatedAt: string;
}

async function loadProgress(): Promise<ProgressData> {
  try {
    const data = await fs.readFile(PROGRESS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {
      processedIds: [],
      lastBatchIndex: 0,
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
    };
  }
}

async function saveProgress(progress: ProgressData): Promise<void> {
  progress.lastUpdatedAt = new Date().toISOString();
  await fs.writeFile(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

async function rephraseQuestion(
  client: Anthropic,
  question: CleanedQuestion
): Promise<RephrasedContent> {
  const userPrompt = `Rephrase the following driving theory content. Return ONLY valid JSON, no markdown.

Original Question: ${question.questionText}

Original Explanation: ${question.explanation}

Answer Type: ${question.answerType}
Number of Choices: ${question.choices.length}

Response format (return ONLY this JSON, nothing else):
{"question": "rephrased question in Dutch", "explanation": "rephrased explanation in Dutch"}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type');
  }

  // Parse JSON response
  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Failed to parse JSON from response: ${content.text}`);
  }

  const parsed = JSON.parse(jsonMatch[0]) as RephrasedContent;
  
  // Validate response
  if (!parsed.question || !parsed.explanation) {
    throw new Error('Missing required fields in response');
  }
  
  // Length sanity check (50% - 200% of original)
  const questionRatio = parsed.question.length / question.questionText.length;
  const explanationRatio = parsed.explanation.length / question.explanation.length;
  
  if (questionRatio < 0.5 || questionRatio > 2) {
    console.warn(`⚠️ Question length ratio unusual: ${questionRatio.toFixed(2)} for ${question.originalId}`);
  }
  if (question.explanation && (explanationRatio < 0.5 || explanationRatio > 2)) {
    console.warn(`⚠️ Explanation length ratio unusual: ${explanationRatio.toFixed(2)} for ${question.originalId}`);
  }

  return parsed;
}

async function main() {
  console.log('🤖 Starting LLM rephrasing...\n');

  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY environment variable is required');
    process.exit(1);
  }

  const client = new Anthropic();

  // Load input data (prefer rephrased.json if it exists to preserve previous work)
  let inputPath = INPUT_FILE;
  try {
    await fs.access(OUTPUT_FILE);
    inputPath = OUTPUT_FILE;
    console.log(`📂 Found existing output file, resuming from ${path.basename(OUTPUT_FILE)}...`);
  } catch {
    console.log(`📂 Starting fresh from ${path.basename(INPUT_FILE)}...`);
  }

  const inputData = JSON.parse(await fs.readFile(inputPath, 'utf-8'));
  const questions: CleanedQuestion[] = inputData.data;
  console.log(`   Found ${questions.length} questions\n`);

  // Load progress
  const progress = await loadProgress();
  const processedSet = new Set(progress.processedIds);
  
  // Filter unprocessed questions
  let toProcess = questions.filter(q => !processedSet.has(q.originalId));
  console.log(`📊 Progress: ${processedSet.size}/${questions.length} already processed`);
  console.log(`   Remaining: ${toProcess.length} questions`);

  // Apply limit if set (for testing)
  if (LIMIT && toProcess.length > LIMIT) {
    console.log(`⚠️  REPHRASE_LIMIT=${LIMIT} - picking ${LIMIT} random questions...`);
    
    // Shuffle for random sampling
    for (let i = toProcess.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [toProcess[i], toProcess[j]] = [toProcess[j], toProcess[i]];
    }
    
    toProcess = toProcess.slice(0, LIMIT);
  }
  console.log(`   Processing: ${toProcess.length} questions\n`);

  if (toProcess.length === 0) {
    console.log('✅ All questions already processed!');
    return;
  }

  // Create batches
  const batches: CleanedQuestion[][] = [];
  for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
    batches.push(toProcess.slice(i, i + BATCH_SIZE));
  }
  console.log(`📦 Created ${batches.length} batches of ${BATCH_SIZE} questions\n`);

  // Rate limiter
  const limit = pLimit(CONCURRENCY);

  // Results map
  const results = new Map<string, RephrasedContent>();

  // Process batches
  let processedCount = 0;

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    console.log(`\n🔄 Processing batch ${batchIndex + 1}/${batches.length}...`);

    const batchPromises = batch.map(question =>
      limit(async () => {
        try {
          const rephrased = await rephraseQuestion(client, question);
          results.set(question.originalId, rephrased);
          progress.processedIds.push(question.originalId);
          processedCount++;
          
          if (processedCount % 10 === 0) {
            console.log(`   ✓ Processed ${processedCount}/${toProcess.length}`);
          }
          
          return { success: true, id: question.originalId };
        } catch (error) {
          console.error(`   ✗ Failed to process ${question.originalId}:`, error);
          return { success: false, id: question.originalId, error };
        }
      })
    );

    await Promise.all(batchPromises);
    
    // Save progress after each batch
    await saveProgress(progress);
  }

  // Update questions with rephrased content
  console.log('\n📝 Applying rephrased content...');
  for (const question of questions) {
    const rephrased = results.get(question.originalId);
    if (rephrased) {
      // Only set original if not already present or if it's the same as current text
      if (!question.questionTextOriginal || question.questionTextOriginal === question.questionText) {
        question.questionTextOriginal = question.questionText;
      }
      if (!question.explanationOriginal || question.explanationOriginal === question.explanation) {
        question.explanationOriginal = question.explanation;
      }
      
      question.questionText = rephrased.question;
      question.explanation = rephrased.explanation;
    }
  }

  // Save output
  let outputDataArray = questions;
  if (ONLY_EXPORT_REPHRASED) {
    const finalProcessedSet = new Set(progress.processedIds);
    outputDataArray = questions.filter(q => finalProcessedSet.has(q.originalId));
    console.log(`🧹 Filtering output: keeping only ${outputDataArray.length} processed questions`);
  }

  const output = {
    ...inputData,
    metadata: {
      ...inputData.metadata,
      rephrasedAt: new Date().toISOString(),
      rephrasedCount: results.size,
      totalInFile: outputDataArray.length,
    },
    data: outputDataArray,
  };

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(output, null, 2));

  console.log('\n✅ Rephrasing complete!');
  console.log(`   Processed: ${results.size} questions`);
  console.log(`   Output: ${OUTPUT_FILE}`);
}

main().catch(console.error);

