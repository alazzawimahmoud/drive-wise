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
 * 7. Removes lesson references from explanations (e.g., "LES 31 - 'Techniek'")
 * 8. Removes listing prefixes from choice text (e.g., "A. ", "B/ ", "1. ")
 * 
 * Output: data/cleaned.json
 */

import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import he from 'he';
import type { RawQuestion, CleanedQuestion, CleanedChoice, RegionCode, ExtractedLesson } from '../server/types/index.js';

const INPUT_FILE = path.join(process.cwd(), 'data_final.json');
const OUTPUT_FILE = path.join(process.cwd(), 'data', 'cleaned.json');

// Canonical lesson names mapping (lesson number -> official topic)
// Derived from the most common naming patterns in the data
const LESSON_TOPICS: Record<number, string> = {
  1: 'De openbare weg',
  2: 'De rijstroken',
  3: 'Het fietspad',
  4: 'De autosnelweg',
  5: 'De autoweg',
  6: 'Speciale plaatsen',
  7: 'De voetgangers',
  8: 'De bestuurders',
  9: 'De voertuigen',
  10: 'Lading en zitplaatsen',
  11: 'De lichten',
  12: 'De snelheid',
  13: 'De stopafstand',
  14: 'Kruisen',
  15: 'Inhalen - voorbijrijden',
  16: 'Inhalen',
  17: 'Bevoegde personen',
  18: 'Verkeerslichten',
  19: 'Voorrang en borden',
  20: 'Voorrang van rechts',
  21: 'Voorrang en afslaan',
  22: 'Trein, tram, bus',
  23: 'Verboden rijrichting',
  24: 'Verplichte rijrichting',
  25: 'Stilstaan en parkeren 1',
  26: 'Stilstaan en parkeren 2',
  27: 'Stilstaan en parkeren 3',
  28: 'Alcohol en drugs',
  29: 'Ongeval',
  30: 'Milieu',
  31: 'Techniek',
  32: 'Verkeersborden',
  33: 'Aanvullend',
  34: 'Extra oefeningen',
};

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
 * Extract lesson numbers from explanation text before removing references
 * Returns array of lesson numbers found in the text
 */
function extractLessonNumbers(text: string): number[] {
  if (!text) return [];
  
  const lessonNumbers = new Set<number>();
  
  // Match patterns like "LES 12", "LES 12, 13", "LES 25 en 26"
  const patterns = [
    /LES\s+(\d+)/gi,
    /LES\s+(\d+)\s*,\s*(\d+)/gi,
    /LES\s+(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/gi,
    /LES\s+(\d+)\s+en\s+(\d+)/gi,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      // Add all captured groups (lesson numbers)
      for (let i = 1; i < match.length; i++) {
        if (match[i]) {
          const num = parseInt(match[i], 10);
          if (num >= 1 && num <= 34) {
            lessonNumbers.add(num);
          }
        }
      }
    }
  }
  
  return Array.from(lessonNumbers).sort((a, b) => a - b);
}

/**
 * Remove lesson references from explanation text
 * Handles various formats of lesson references in Dutch driving theory content.
 */
function removeLessonReferences(text: string): string {
  if (!text) return '';
  
  // Remove "LEES in LES XX ..." pattern (read in lesson references)
  text = text.replace(/LEES\s+in\s+LES\s+\d+[^.\n]*\./gi, '');
  text = text.replace(/Lees\s+in\s+les\s+\d+[^.\n]*\./gi, '');
  
  // Remove "Uitleg LES XX: 'Topic name'." or "Uitleg: LES XX - 'Topic'." pattern
  text = text.replace(/Uitleg:?\s+LES\s+\d+[:\s\-–—]+['''.]?[^.'\n]+[''']?\.?\s*/gi, '');
  
  // Remove lesson references with various formats at the start of text:
  // - "LES XX - 'Topic'." or "LES XX – 'Topic'." 
  // - "LES XX  'Topic'." (double space, no dash)
  // - "LES XX, YY, ZZ - 'Topic'" (comma-separated)
  // - "LES XX en YY - 'Topic'" (using 'en')
  // - Handles double spaces, various quote types, and multiple dashes
  // Note: \s* for optional dash to handle "LES 23  'Topic'" (double space, no dash)
  text = text.replace(/^LES\s+[\d,\s]+(?:en\s+[\d,\s]+)*\s*[-–—]*\s*['''.]?[^'\n]+['''.]?\s*\n?/gim, '');
  
  // Same pattern but not at start of line (might be after another sentence)
  text = text.replace(/LES\s+[\d,\s]+(?:en\s+[\d,\s]+)*\s*[-–—]*\s*['''.]?[^'\n]+['''.]?\n/gi, '');
  
  // Remove lesson references with double quoted topic names
  text = text.replace(/LES\s+[\d,\s]+(?:en\s+[\d,\s]+)*\s*[-–—]+\s*"[^"]+"\s*[.:;\n]?\s*/gi, '');
  
  // Remove lesson references without quotes (just topic name ending with newline/period)
  // Pattern: "LES XX - Topic name\n" or "LES XX - Topic name."
  text = text.replace(/LES\s+[\d,\s]+(?:en\s+[\d,\s]+)*\s*[-–—]+\s*[A-Za-z][^\n]*[.\n]/gi, '');
  
  // Remove "LES XX - Topic" at end of text (no trailing punctuation)
  text = text.replace(/LES\s+[\d,\s]+(?:en\s+[\d,\s]+)*\s*[-–—]+\s*[A-Za-z][^\n]*$/gim, '');
  
  // Remove incomplete "LES X en" patterns (lesson reference cut off)
  text = text.replace(/LES\s+\d+\s+en\s*[\n\s]/gi, '');
  
  // Remove standalone "LES XX" references (just lesson number, no topic)
  text = text.replace(/^LES\s+[\d,\s]+\s*$/gim, '');
  text = text.replace(/LES\s+\d+\s*[.:;\n]/gi, '');
  
  // Remove "/ LES XX - Topic" patterns (slash-separated lesson refs)
  text = text.replace(/\s*\/\s*LES\s+[\d,\s]+(?:en\s+[\d,\s]+)*\s*[-–—]+\s*['''.]?[^\n]+['''.;\n]?\s*/gi, '');
  
  // Remove "en LES XX - ..." that might be left over
  text = text.replace(/\s*en\s+LES\s+[\d,\s]+\s*[-–—]+\s*['''.]?[^.'\n]+[''']?\.?\s*/gi, '');
  
  // Clean up leading dots, colons, or whitespace that might be left
  text = text.replace(/^[.:\s]+/gm, '');
  
  // Clean up multiple newlines
  text = text.replace(/\n{3,}/g, '\n\n');
  
  // Trim whitespace
  text = text.trim();
  
  return text;
}

/**
 * Remove listing prefixes from choice text
 * Patterns:
 * - "A. ", "B. ", "C. " (uppercase letter + dot + space)
 * - "A/ ", "B/ ", "C/ " (uppercase letter + slash + space)  
 * - "1. ", "2. ", "3. " (number + dot + space at beginning)
 * - "(A) ", "(1) " etc. (parenthetical)
 */
function removeListingPrefix(text: string): string {
  if (!text) return '';
  
  // Remove letter prefix: "A. ", "B. ", etc. (case insensitive, at start)
  text = text.replace(/^[A-Za-z][.]\s+/, '');
  
  // Remove letter slash prefix: "A/ ", "B/ ", etc. (at start)
  text = text.replace(/^[A-Za-z]\/\s*/, '');
  
  // Remove number prefix: "1. ", "2. ", etc. (at start, but not fractions like "1/10")
  // Only remove if followed by a capital letter or space (indicating a list item, not a measurement)
  text = text.replace(/^(\d+)[.]\s+(?=[A-Z])/, '');
  
  // Remove parenthetical prefix: "(A) ", "(1) ", etc.
  text = text.replace(/^\([A-Za-z0-9]\)\s*/, '');
  
  // Trim any leading/trailing whitespace
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
  // Clean HTML first, then extract lessons before removing references
  const explanationCleaned = cleanHtml(raw.explanation);
  const lessonNumbers = extractLessonNumbers(explanationCleaned);
  const explanation = removeLessonReferences(explanationCleaned);
  
  const choices: CleanedChoice[] = raw.choices.map((choice, index) => ({
    position: index,
    // Clean HTML first, then remove listing prefixes from choice text
    text: choice.text ? removeListingPrefix(cleanHtml(choice.text)) : undefined,
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
    lessonNumbers, // Lesson references extracted from explanation
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
  const lessonQuestionCounts: Record<number, number> = {};
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
    
    // Track lesson usage
    for (const lessonNum of cleaned.lessonNumbers) {
      lessonQuestionCounts[lessonNum] = (lessonQuestionCounts[lessonNum] || 0) + 1;
    }
    
    if (cleaned.imageUuid) assets.add(cleaned.imageUuid);
    if (cleaned.videoId) assets.add(`video:${cleaned.videoId}`);
    for (const choice of cleaned.choices) {
      if (choice.imageUuid) assets.add(choice.imageUuid);
    }
  }
  
  // Build lessons data
  const lessons: ExtractedLesson[] = Object.entries(LESSON_TOPICS).map(([num, topic]) => ({
    number: parseInt(num, 10),
    slug: `les-${num}`,
    topic,
    questionCount: lessonQuestionCounts[parseInt(num, 10)] || 0,
  })).filter(l => l.questionCount > 0); // Only include lessons that have questions
  
  // Ensure output directory exists
  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  
  // Write output
  const output = {
    assetsBaseUrl,
    metadata: {
      totalQuestions: cleanedQuestions.length,
      totalCategories: categories.size,
      totalLessons: lessons.length,
      totalAssets: assets.size,
      regionDistribution: regionCounts,
      processedAt: new Date().toISOString(),
    },
    categories: Array.from(categories).sort(),
    lessons,
    data: cleanedQuestions,
  };
  
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(output, null, 2));
  
  // Summary
  console.log('\n✅ Cleanup complete!\n');
  console.log('📊 Summary:');
  console.log(`   Questions: ${cleanedQuestions.length}`);
  console.log(`   Categories: ${categories.size}`);
  console.log(`   Lessons: ${lessons.length}`);
  console.log(`   Assets: ${assets.size}`);
  console.log('\n🌍 Region distribution:');
  console.log(`   National: ${regionCounts.national}`);
  console.log(`   Brussels: ${regionCounts.brussels}`);
  console.log(`   Flanders: ${regionCounts.flanders}`);
  console.log(`   Wallonia: ${regionCounts.wallonia}`);
  console.log('\n📚 Top lessons by question count:');
  const topLessons = [...lessons].sort((a, b) => b.questionCount - a.questionCount).slice(0, 5);
  for (const lesson of topLessons) {
    console.log(`   LES ${lesson.number}: ${lesson.topic} (${lesson.questionCount} questions)`);
  }
  console.log(`\n📁 Output: ${OUTPUT_FILE}`);
}

main().catch(console.error);

