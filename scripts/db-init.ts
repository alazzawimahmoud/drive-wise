/**
 * Database Initialization Script
 * 
 * Ensures the database schema is up to date and data is seeded.
 * Safe to run multiple times - will skip seeding if data already exists.
 * 
 * Usage: npm run db:init
 */

import 'dotenv/config';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { db } from '../server/db/index.js';
import * as schema from '../server/db/schema.js';
import { sql } from 'drizzle-orm';
import type { CleanedQuestion } from '../server/types/index.js';

const INPUT_FILE = path.join(process.cwd(), 'data', 'rephrased.json');
const FALLBACK_FILE = path.join(process.cwd(), 'data', 'cleaned.json');

async function pushSchema(): Promise<void> {
  console.log('📦 Pushing database schema...');
  return new Promise((resolve, reject) => {
    // Use --force to skip interactive confirmation prompts in CI/CD environments
    // Set CI=true to ensure non-interactive mode
    const child = spawn('npx', ['drizzle-kit', 'push', '--force'], {
      stdio: ['pipe', 'inherit', 'inherit'],
      env: { ...process.env, CI: 'true' }
    });

    // Automatically answer "no" to any truncation prompts
    // This answers "No, add the constraint without truncating the table"
    // The answer is buffered and will be consumed when the prompt appears
    child.stdin.write('no\n');
    child.stdin.end();

    child.on('close', (code) => {
      if (code === 0) {
        console.log('   ✓ Schema pushed successfully\n');
        resolve();
      } else {
        console.error('   ✗ Failed to push schema');
        reject(new Error(`drizzle-kit push exited with code ${code}`));
      }
    });

    child.on('error', (error) => {
      console.error('   ✗ Failed to push schema');
      reject(error);
    });
  });
}

async function isDatabaseSeeded(): Promise<boolean> {
  try {
    const result = await db.select({ count: sql<number>`count(*)` }).from(schema.questions);
    const count = Number(result[0]?.count ?? 0);
    return count > 0;
  } catch {
    // Table might not exist yet
    return false;
  }
}

async function seedDatabase(): Promise<void> {
  console.log('🌱 Starting database seeding...\n');

  // Load data file
  let inputFile = INPUT_FILE;
  try {
    await fs.access(INPUT_FILE);
  } catch {
    console.log(`   ${INPUT_FILE} not found, using ${FALLBACK_FILE}`);
    inputFile = FALLBACK_FILE;
  }

  console.log(`📂 Reading ${inputFile}...`);
  const inputData = JSON.parse(await fs.readFile(inputFile, 'utf-8'));
  const { data: questions, assetsBaseUrl, categories: categoryList } = inputData as {
    data: CleanedQuestion[];
    assetsBaseUrl: string;
    categories: string[];
  };
  console.log(`   Found ${questions.length} questions`);
  console.log(`   Found ${categoryList.length} categories\n`);

  // Step 1: Seed locales
  console.log('📍 Seeding locales...');
  await db.insert(schema.locales).values([
    { code: 'nl-BE', name: 'Nederlands (België)', isDefault: true },
    { code: 'fr-BE', name: 'Français (Belgique)', isDefault: false },
    { code: 'de-BE', name: 'Deutsch (Belgien)', isDefault: false },
    { code: 'en', name: 'English', isDefault: false },
  ]).onConflictDoNothing();
  console.log('   ✓ Locales seeded\n');

  // Step 2: Seed regions
  console.log('🌍 Seeding regions...');
  const regionData = [
    { code: 'national', name: 'Nationaal' },
    { code: 'brussels', name: 'Brussels Hoofdstedelijk Gewest' },
    { code: 'flanders', name: 'Vlaanderen' },
    { code: 'wallonia', name: 'Wallonië' },
  ];
  await db.insert(schema.regions).values(regionData).onConflictDoNothing();
  
  // Get region IDs
  const regionsResult = await db.select().from(schema.regions);
  const regionMap = new Map(regionsResult.map(r => [r.code, r.id]));
  console.log('   ✓ Regions seeded\n');

  // Step 3: Seed categories
  console.log('📁 Seeding categories...');
  const categoryTitles = new Map<string, string>();
  for (const q of questions) {
    if (!categoryTitles.has(q.categorySlug)) {
      categoryTitles.set(q.categorySlug, q.categoryTitle);
    }
  }

  for (let i = 0; i < categoryList.length; i++) {
    const slug = categoryList[i];
    await db.insert(schema.categories).values({
      slug,
      sortOrder: i,
    }).onConflictDoNothing();
  }

  // Get category IDs and add translations
  const categoriesResult = await db.select().from(schema.categories);
  const categoryMap = new Map(categoriesResult.map(c => [c.slug, c.id]));

  for (const [slug, title] of categoryTitles) {
    const categoryId = categoryMap.get(slug);
    if (categoryId) {
      await db.insert(schema.categoryTranslations).values({
        categoryId,
        locale: 'nl-BE',
        title,
        description: null,
      }).onConflictDoNothing();
    }
  }
  console.log(`   ✓ ${categoryList.length} categories seeded\n`);

  // Step 4: Seed assets
  console.log('🖼️ Seeding assets...');
  const assetUuids = new Set<string>();
  const videoIds = new Set<string>();

  for (const q of questions) {
    if (q.imageUuid) assetUuids.add(q.imageUuid);
    if (q.videoId) videoIds.add(q.videoId);
    for (const c of q.choices) {
      if (c.imageUuid) assetUuids.add(c.imageUuid);
    }
  }

  // Insert image assets
  for (const uuid of assetUuids) {
    await db.insert(schema.assets).values({
      uuid,
      type: 'image',
      originalUrl: `${assetsBaseUrl}/${uuid}`,
    }).onConflictDoNothing();
  }

  // Insert video assets
  for (const videoId of videoIds) {
    await db.insert(schema.assets).values({
      uuid: `video-${videoId}`,
      type: 'video',
      originalUrl: `https://www.youtube.com/watch?v=${videoId}`,
    }).onConflictDoNothing();
  }

  // Get asset IDs
  const assetsResult = await db.select().from(schema.assets);
  const assetMap = new Map(assetsResult.map(a => [a.uuid, a.id]));
  console.log(`   ✓ ${assetUuids.size + videoIds.size} assets seeded\n`);

  // Step 5: Seed questions
  console.log('❓ Seeding questions...');
  let questionCount = 0;
  let choiceCount = 0;

  for (const q of questions) {
    const categoryId = categoryMap.get(q.categorySlug);
    const regionId = regionMap.get(q.regionCode);

    if (!categoryId) {
      console.warn(`   ⚠️ Category not found for ${q.originalId}: ${q.categorySlug}`);
      continue;
    }

    // Insert question
    const [insertedQuestion] = await db.insert(schema.questions).values({
      categoryId,
      regionId: regionId || null,
      originalId: q.originalId,
      answerType: q.answerType,
      answer: q.answer,
      isMajorFault: q.isMajorFault,
      source: q.source,
      imageAssetId: q.imageUuid ? assetMap.get(q.imageUuid) || null : null,
      videoAssetId: q.videoId ? assetMap.get(`video-${q.videoId}`) || null : null,
    }).returning();

    // Insert question translation
    await db.insert(schema.questionTranslations).values({
      questionId: insertedQuestion.id,
      locale: 'nl-BE',
      questionText: q.questionText,
      questionTextOriginal: q.questionTextOriginal,
      explanation: q.explanation,
      explanationOriginal: q.explanationOriginal,
    });

    // Insert choices
    for (const choice of q.choices) {
      const [insertedChoice] = await db.insert(schema.choices).values({
        questionId: insertedQuestion.id,
        position: choice.position,
        imageAssetId: choice.imageUuid ? assetMap.get(choice.imageUuid) || null : null,
      }).returning();

      // Insert choice translation
      if (choice.text) {
        await db.insert(schema.choiceTranslations).values({
          choiceId: insertedChoice.id,
          locale: 'nl-BE',
          text: choice.text,
        });
      }

      choiceCount++;
    }

    questionCount++;
    if (questionCount % 500 === 0) {
      console.log(`   ✓ Seeded ${questionCount}/${questions.length} questions...`);
    }
  }

  console.log(`   ✓ ${questionCount} questions seeded`);
  console.log(`   ✓ ${choiceCount} choices seeded\n`);
}

async function main(): Promise<void> {
  console.log('🚀 DriveWise Database Initialization\n');
  console.log('='.repeat(50) + '\n');

  // Step 1: Push schema
  await pushSchema();

  // Step 2: Check if seeding is needed
  console.log('🔍 Checking database state...');
  const isSeeded = await isDatabaseSeeded();
  
  if (isSeeded) {
    console.log('   ✓ Database already contains data, skipping seed\n');
  } else {
    console.log('   ℹ Database is empty, seeding required\n');
    await seedDatabase();
  }

  console.log('='.repeat(50));
  console.log('✅ Database initialization complete!\n');
  
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Database initialization failed:', error);
  process.exit(1);
});

