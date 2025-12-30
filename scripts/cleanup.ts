/**
 * Data Cleanup Script
 * 
 * This script processes the raw data_final.json and:
 * 1. Decodes HTML entities
 * 2. Converts HTML tags to plain text
 * 3. Unifies IDs (keeps original, assigns new sequential)
 * 4. Normalizes category slugs from seriesId
 * 5. Detects region from question content
 * 6. Extracts assets (images, videos)
 * 
 * Output: data/cleaned.json
 */

import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import he from 'he';
import type { RawQuestion, CleanedQuestion, CleanedChoice, RegionCode } from '../server/types/index.js';

const INPUT_FILE = path.join(process.cwd(), 'data_final.json');
const OUTPUT_FILE = path.join(process.cwd(), 'data', 'cleaned.json');

// Region detection keywords
const REGION_KEYWORDS: Record<RegionCode, string[]> = {
  brussels: ['brusselse gewest', 'brussels', 'bruxelles', 'brussel'],
  flanders: ['vlaanderen', 'vlaamse', 'vlaams'],
  wallonia: ['wallonië', 'wallonie', 'waals', 'waalse'],
  national: [],
};

/**
 * Decode HTML entities and strip HTML tags
 */
function cleanHtml(html: string): string {
  if (!html) return '';
  
  // Decode HTML entities
  let text = he.decode(html);
  
  // Convert <br>, <br/>, <br /> to newlines
  text = text.replace(/<br\s*\/?>/gi, '\n');
  
  // Remove <p> tags but keep content
  text = text.replace(/<\/?p>/gi, '\n');
  
  // Remove <strong> tags but keep content
  text = text.replace(/<\/?strong>/gi, '');
  
  // Remove any remaining HTML tags
  text = text.replace(/<[^>]*>/g, '');
  
  // Clean up multiple newlines
  text = text.replace(/\n{3,}/g, '\n\n');
  
  // Trim whitespace
  text = text.trim();
  
  return text;
}

/**
 * Detect region from question text and explanation
 */
function detectRegion(questionText: string, explanation: string): RegionCode {
  const combinedText = `${questionText} ${explanation}`.toLowerCase();
  
  for (const [region, keywords] of Object.entries(REGION_KEYWORDS) as [RegionCode, string[]][]) {
    if (region === 'national') continue;
    for (const keyword of keywords) {
      if (combinedText.includes(keyword)) {
        return region;
      }
    }
  }
  
  return 'national';
}

/**
 * Normalize seriesId to a consistent slug format
 */
function normalizeSeriesId(seriesId: string | number): string {
  if (typeof seriesId === 'number') {
    // Map numeric IDs to slugs based on known mappings
    const numericMappings: Record<number, string> = {
      61: 'ad-random',
      56: 'verkeersborden',
      41: 'inhalen',
      38: 'snelheid',
      55: 'techniek',
      53: 'ongeval',
      43: 'verkeerslichten',
      42: 'kruispunt-borden',
      29: 'autosnelweg',
      48: 'trein-tram-bus',
      44: 'speciale-gebieden',
      31: 'voorrang-rechts',
      46: 'verboden-rijrichting',
      49: 'stilstaan-parkeren-1',
      52: 'alcohol-drugs',
      26: 'openbare-weg',
      27: 'rijstroken',
      35: 'auto-lading',
      50: 'stilstaan-parkeren-2',
      51: 'stilstaan-parkeren-3',
      28: 'kruisen',
      25: 'bevoegde-personen',
      45: 'verplichte-rijrichting',
      36: 'auto-lichten',
      54: 'zuinig-rijden',
      24: 'fietspad',
      30: 'autoweg',
      47: 'voorrang-afslaan',
      23: 'voetgangers',
      37: 'auto',
      22: 'bestuurders',
      39: 'stopafstand',
    };
    return numericMappings[seriesId] || `series-${seriesId}`;
  }
  
  // String seriesId - just clean it up
  return seriesId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Process a single question
 */
function processQuestion(raw: RawQuestion): CleanedQuestion {
  const questionText = cleanHtml(raw.question);
  const explanation = cleanHtml(raw.explanation);
  
  const choices: CleanedChoice[] = raw.choices.map((choice, index) => ({
    position: index,
    text: choice.text ? cleanHtml(choice.text) : undefined,
    imageUuid: choice.image || undefined,
  }));
  
  return {
    originalId: raw.id,
    categorySlug: normalizeSeriesId(raw.seriesId),
    categoryTitle: raw.title,
    regionCode: detectRegion(questionText, explanation),
    imageUuid: raw.image || undefined,
    videoId: raw.video || undefined,
    questionText,
    questionTextOriginal: questionText, // Will be replaced after rephrasing
    explanation,
    explanationOriginal: explanation, // Will be replaced after rephrasing
    answer: raw.answer,
    answerType: raw.answerType,
    isMajorFault: raw.isMajorFault,
    choices,
    source: raw.source,
  };
}

async function main() {
  console.log('🧹 Starting data cleanup...\n');
  
  // Read input file
  console.log(`📂 Reading ${INPUT_FILE}...`);
  const rawData = await fs.readFile(INPUT_FILE, 'utf-8');
  const { data, assetsBaseUrl } = JSON.parse(rawData) as { data: RawQuestion[]; assetsBaseUrl: string };
  
  console.log(`   Found ${data.length} questions`);
  console.log(`   Assets base URL: ${assetsBaseUrl}\n`);
  
  // Process all questions
  console.log('🔄 Processing questions...');
  const cleanedQuestions: CleanedQuestion[] = [];
  const categories = new Set<string>();
  const assets = new Set<string>();
  const regionCounts: Record<RegionCode, number> = {
    national: 0,
    brussels: 0,
    flanders: 0,
    wallonia: 0,
  };
  
  for (const raw of data) {
    const cleaned = processQuestion(raw);
    cleanedQuestions.push(cleaned);
    
    categories.add(cleaned.categorySlug);
    regionCounts[cleaned.regionCode]++;
    
    if (cleaned.imageUuid) assets.add(cleaned.imageUuid);
    if (cleaned.videoId) assets.add(`video:${cleaned.videoId}`);
    for (const choice of cleaned.choices) {
      if (choice.imageUuid) assets.add(choice.imageUuid);
    }
  }
  
  // Ensure output directory exists
  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  
  // Write output
  const output = {
    assetsBaseUrl,
    metadata: {
      totalQuestions: cleanedQuestions.length,
      totalCategories: categories.size,
      totalAssets: assets.size,
      regionDistribution: regionCounts,
      processedAt: new Date().toISOString(),
    },
    categories: Array.from(categories).sort(),
    data: cleanedQuestions,
  };
  
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(output, null, 2));
  
  // Summary
  console.log('\n✅ Cleanup complete!\n');
  console.log('📊 Summary:');
  console.log(`   Questions: ${cleanedQuestions.length}`);
  console.log(`   Categories: ${categories.size}`);
  console.log(`   Assets: ${assets.size}`);
  console.log('\n🌍 Region distribution:');
  console.log(`   National: ${regionCounts.national}`);
  console.log(`   Brussels: ${regionCounts.brussels}`);
  console.log(`   Flanders: ${regionCounts.flanders}`);
  console.log(`   Wallonia: ${regionCounts.wallonia}`);
  console.log(`\n📁 Output: ${OUTPUT_FILE}`);
}

main().catch(console.error);

