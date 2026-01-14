/**
 * Shared Database Seeding Module
 * 
 * Consolidates seeding logic from seed.ts and db-init.ts into reusable functions.
 * Used by both the standalone seed script and the deployment pipeline.
 */

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import { db } from '../../server/db/index.js';
import * as schema from '../../server/db/schema.js';
import { sql, eq, notInArray } from 'drizzle-orm';
import type { CleanedQuestion, ExtractedLesson } from '../../server/types/index.js';

// ============================================================================
// TYPES
// ============================================================================

export interface SeederOptions {
  /** Show verbose logging */
  verbose?: boolean;
  /** Apply data fixes after seeding */
  applyFixes?: boolean;
  /** Assign orphan questions to "Others" lesson */
  assignOrphans?: boolean;
}

export interface SeederData {
  assetsBaseUrl: string;
  categories: string[];
  lessons: ExtractedLesson[];
  data: CleanedQuestion[];
}

export interface SeederResult {
  success: boolean;
  questionsSeeded: number;
  categoriesSeeded: number;
  lessonsSeeded: number;
  assetsSeeded: number;
  choicesSeeded: number;
  questionLessonLinks: number;
}

// ============================================================================
// DATA LOADING
// ============================================================================

const DATA_REPHRASED = path.join(process.cwd(), 'data', 'rephrased.json');
const DATA_CLEANED = path.join(process.cwd(), 'data', 'cleaned.json');

/**
 * Load the best available data file (rephrased.json preferred, cleaned.json fallback)
 */
export async function loadDataFile(verbose = false): Promise<{ data: SeederData; source: string }> {
  let inputFile = DATA_REPHRASED;
  
  try {
    await fs.access(DATA_REPHRASED);
    if (verbose) console.log(`📂 Using rephrased data: ${path.basename(DATA_REPHRASED)}`);
  } catch {
    if (verbose) console.log(`   ${path.basename(DATA_REPHRASED)} not found, using ${path.basename(DATA_CLEANED)}`);
    inputFile = DATA_CLEANED;
  }
  
  const rawData = await fs.readFile(inputFile, 'utf-8');
  return {
    data: JSON.parse(rawData) as SeederData,
    source: inputFile,
  };
}

// ============================================================================
// SCHEMA MANAGEMENT
// ============================================================================

/**
 * Check if the database schema is initialized
 */
export async function isSchemaInitialized(): Promise<boolean> {
  try {
    await db.execute(sql`SELECT 1 FROM questions LIMIT 1`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Push schema to database (only for new/empty databases)
 */
export async function pushSchema(verbose = false): Promise<void> {
  if (verbose) console.log('📦 Checking database schema...');
  
  const schemaExists = await isSchemaInitialized();
  if (schemaExists) {
    if (verbose) console.log('   ✓ Database schema already exists, skipping push\n');
    return;
  }
  
  if (verbose) console.log('   Initializing new database schema...');
  try {
    execSync('npx drizzle-kit push --force', {
      stdio: verbose ? 'inherit' : 'pipe',
      env: { ...process.env, CI: 'true' }
    });
    if (verbose) console.log('   ✓ Schema pushed successfully\n');
  } catch (error) {
    console.error('   ✗ Failed to push schema');
    throw error;
  }
}

/**
 * Check if database is already seeded
 */
export async function isDatabaseSeeded(): Promise<boolean> {
  try {
    const result = await db.select({ count: sql<number>`count(*)` }).from(schema.questions);
    const count = Number(result[0]?.count ?? 0);
    return count > 0;
  } catch {
    return false;
  }
}

// ============================================================================
// INDIVIDUAL SEEDERS
// ============================================================================

/**
 * Seed locales table
 */
export async function seedLocales(verbose = false): Promise<void> {
  if (verbose) console.log('📍 Seeding locales...');
  
  await db.insert(schema.locales).values([
    { code: 'nl-BE', name: 'Nederlands (België)', isDefault: true },
    { code: 'fr-BE', name: 'Français (Belgique)', isDefault: false },
    { code: 'de-BE', name: 'Deutsch (Belgien)', isDefault: false },
    { code: 'en', name: 'English', isDefault: false },
  ]).onConflictDoNothing();
  
  if (verbose) console.log('   ✓ Locales seeded\n');
}

/**
 * Seed regions table
 */
export async function seedRegions(verbose = false): Promise<Map<string, number>> {
  if (verbose) console.log('🌍 Seeding regions...');
  
  const regionData = [
    { code: 'national', name: 'Nationaal' },
    { code: 'brussels', name: 'Brussels Hoofdstedelijk Gewest' },
    { code: 'flanders', name: 'Vlaanderen' },
    { code: 'wallonia', name: 'Wallonië' },
  ];
  
  await db.insert(schema.regions).values(regionData).onConflictDoNothing();
  
  const regionsResult = await db.select().from(schema.regions);
  const regionMap = new Map(regionsResult.map(r => [r.code, r.id]));
  
  if (verbose) console.log('   ✓ Regions seeded\n');
  return regionMap;
}

/**
 * Seed categories and their translations
 */
export async function seedCategories(
  categoryList: string[],
  questions: CleanedQuestion[],
  verbose = false
): Promise<Map<string, number>> {
  if (verbose) console.log('📁 Seeding categories...');
  
  // Build category title map from questions
  const categoryTitles = new Map<string, string>();
  for (const q of questions) {
    if (!categoryTitles.has(q.categorySlug)) {
      categoryTitles.set(q.categorySlug, q.categoryTitle);
    }
  }
  
  // Insert categories
  for (let i = 0; i < categoryList.length; i++) {
    const slug = categoryList[i];
    await db.insert(schema.categories).values({
      slug,
      sortOrder: i,
    }).onConflictDoNothing();
  }
  
  // Get category IDs
  const categoriesResult = await db.select().from(schema.categories);
  const categoryMap = new Map(categoriesResult.map(c => [c.slug, c.id]));
  
  // Add translations
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
  
  if (verbose) console.log(`   ✓ ${categoryList.length} categories seeded\n`);
  return categoryMap;
}

/**
 * Seed lessons and their translations
 */
export async function seedLessons(
  lessonList: ExtractedLesson[],
  verbose = false
): Promise<Map<number, number>> {
  if (verbose) console.log('📚 Seeding lessons...');
  
  const lessonMap = new Map<number, number>();
  
  if (!lessonList || lessonList.length === 0) {
    if (verbose) console.log('   ⚠️ No lessons found in data, skipping...\n');
    return lessonMap;
  }
  
  // Insert lessons
  for (const lesson of lessonList) {
    await db.insert(schema.lessons).values({
      number: lesson.number,
      slug: lesson.slug,
      sortOrder: lesson.number,
    }).onConflictDoNothing();
  }
  
  // Fetch all lessons to get IDs
  const lessonsResult = await db.select().from(schema.lessons);
  for (const l of lessonsResult) {
    lessonMap.set(l.number, l.id);
  }
  
  // Add lesson translations (upsert to handle re-seeding)
  for (const lesson of lessonList) {
    const lessonId = lessonMap.get(lesson.number);
    if (lessonId) {
      await db.insert(schema.lessonTranslations).values({
        lessonId,
        locale: 'nl-BE',
        title: lesson.topic,
        description: null,
      }).onConflictDoUpdate({
        target: [schema.lessonTranslations.lessonId, schema.lessonTranslations.locale],
        set: {
          title: lesson.topic,
        },
      });
    }
  }
  
  if (verbose) console.log(`   ✓ ${lessonList.length} lessons seeded\n`);
  return lessonMap;
}

/**
 * Seed assets (images and videos)
 */
export async function seedAssets(
  questions: CleanedQuestion[],
  assetsBaseUrl: string,
  verbose = false
): Promise<Map<string, number>> {
  if (verbose) console.log('🖼️ Seeding assets...');
  
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
  
  if (verbose) console.log(`   ✓ ${assetUuids.size + videoIds.size} assets seeded\n`);
  return assetMap;
}

/**
 * Seed questions with all related data (translations, choices, lesson links)
 */
export async function seedQuestions(
  questions: CleanedQuestion[],
  categoryMap: Map<string, number>,
  regionMap: Map<string, number>,
  lessonMap: Map<number, number>,
  assetMap: Map<string, number>,
  options: { verbose?: boolean } = {}
): Promise<{ questionCount: number; choiceCount: number; questionLessonCount: number }> {
  const { verbose = false } = options;
  
  if (verbose) console.log('❓ Seeding questions...');
  
  let questionCount = 0;
  let choiceCount = 0;
  let questionLessonCount = 0;
  
  for (const q of questions) {
    const categoryId = categoryMap.get(q.categorySlug);
    const regionId = regionMap.get(q.regionCode);
    
    if (!categoryId) {
      console.warn(`   ⚠️ Category not found for ${q.originalId}: ${q.categorySlug}`);
      continue;
    }
    
    // Upsert question (insert or update on conflict)
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
    }).onConflictDoUpdate({
      target: schema.questions.originalId,
      set: {
        categoryId,
        regionId: regionId || null,
        answerType: q.answerType,
        answer: q.answer,
        isMajorFault: q.isMajorFault,
        source: q.source,
        imageAssetId: q.imageUuid ? assetMap.get(q.imageUuid) || null : null,
        videoAssetId: q.videoId ? assetMap.get(`video-${q.videoId}`) || null : null,
      },
    }).returning();
    
    // Upsert question translation
    await db.insert(schema.questionTranslations).values({
      questionId: insertedQuestion.id,
      locale: 'nl-BE',
      questionText: q.questionText,
      questionTextOriginal: q.questionTextOriginal,
      explanation: q.explanation,
      explanationOriginal: q.explanationOriginal,
    }).onConflictDoUpdate({
      target: [schema.questionTranslations.questionId, schema.questionTranslations.locale],
      set: {
        questionText: q.questionText,
        questionTextOriginal: q.questionTextOriginal,
        explanation: q.explanation,
        explanationOriginal: q.explanationOriginal,
      },
    });
    
    // Handle choices - delete ones no longer in seed data
    const seedChoicePositions = new Set(q.choices.map(c => c.position));
    const existingChoices = await db.select().from(schema.choices)
      .where(eq(schema.choices.questionId, insertedQuestion.id));
    
    for (const existingChoice of existingChoices) {
      if (!seedChoicePositions.has(existingChoice.position)) {
        await db.delete(schema.choices).where(eq(schema.choices.id, existingChoice.id));
      }
    }
    
    // Upsert choices
    for (const choice of q.choices) {
      const [insertedChoice] = await db.insert(schema.choices).values({
        questionId: insertedQuestion.id,
        position: choice.position,
        imageAssetId: choice.imageUuid ? assetMap.get(choice.imageUuid) || null : null,
      }).onConflictDoUpdate({
        target: [schema.choices.questionId, schema.choices.position],
        set: {
          imageAssetId: choice.imageUuid ? assetMap.get(choice.imageUuid) || null : null,
        },
      }).returning();
      
      // Upsert choice translation
      if (choice.text) {
        await db.insert(schema.choiceTranslations).values({
          choiceId: insertedChoice.id,
          locale: 'nl-BE',
          text: choice.text,
        }).onConflictDoUpdate({
          target: [schema.choiceTranslations.choiceId, schema.choiceTranslations.locale],
          set: { text: choice.text },
        });
      }
      
      choiceCount++;
    }
    
    // Handle question-lesson links - delete existing and recreate
    await db.delete(schema.questionLessons)
      .where(eq(schema.questionLessons.questionId, insertedQuestion.id));
    
    // Create lesson links
    const lessonNumbers = q.lessonNumbers || [];
    for (const lessonNum of lessonNumbers) {
      const lessonId = lessonMap.get(lessonNum);
      if (lessonId) {
        await db.insert(schema.questionLessons).values({
          questionId: insertedQuestion.id,
          lessonId,
        }).onConflictDoNothing();
        questionLessonCount++;
      }
    }
    
    questionCount++;
    if (verbose && questionCount % 500 === 0) {
      console.log(`   ✓ Seeded ${questionCount}/${questions.length} questions...`);
    }
  }
  
  if (verbose) {
    console.log(`   ✓ ${questionCount} questions seeded`);
    console.log(`   ✓ ${choiceCount} choices seeded`);
    console.log(`   ✓ ${questionLessonCount} question-lesson links created\n`);
  }
  
  return { questionCount, choiceCount, questionLessonCount };
}

// ============================================================================
// DATA FIXES
// ============================================================================

/**
 * Apply data fixes to existing data
 */
export async function applyDataFixes(verbose = false): Promise<void> {
  if (verbose) console.log('🔧 Applying data fixes...');
  
  // Fix ad-random category title
  await db.execute(sql`
    UPDATE category_translations 
    SET title = 'Ad random' 
    WHERE category_id = (SELECT id FROM categories WHERE slug = 'ad-random') 
    AND locale = 'nl-BE'
    AND title != 'Ad random'
  `);
  
  if (verbose) console.log('   ✓ Data fixes applied\n');
}

/**
 * Assign orphan questions to "Others" lesson
 */
export async function assignOrphanQuestionsToOthersLesson(verbose = false): Promise<number> {
  if (verbose) console.log('📦 Assigning orphan questions to "Others" lesson...');
  
  const OTHERS_LESSON_SLUG = 'les-others';
  const OTHERS_LESSON_TITLE = 'Others';
  
  // Get the maximum lesson number
  const maxLessonResult = await db
    .select({ maxNumber: sql<number>`COALESCE(MAX(number), 0)` })
    .from(schema.lessons);
  const maxLessonNumber = Number(maxLessonResult[0]?.maxNumber ?? 0);
  const othersLessonNumber = maxLessonNumber + 1;
  
  // Check if "Others" lesson exists
  const existingOthersLesson = await db
    .select()
    .from(schema.lessons)
    .where(eq(schema.lessons.slug, OTHERS_LESSON_SLUG));
  
  let othersLessonId: number;
  
  if (existingOthersLesson.length > 0) {
    othersLessonId = existingOthersLesson[0].id;
    if (verbose) console.log(`   ✓ "Others" lesson already exists (id: ${othersLessonId})`);
  } else {
    // Create the "Others" lesson
    const [insertedLesson] = await db.insert(schema.lessons).values({
      number: othersLessonNumber,
      slug: OTHERS_LESSON_SLUG,
      sortOrder: othersLessonNumber,
    }).returning();
    
    othersLessonId = insertedLesson.id;
    if (verbose) console.log(`   ✓ Created "Others" lesson (id: ${othersLessonId})`);
    
    // Add translation (upsert to handle re-seeding)
    await db.insert(schema.lessonTranslations).values({
      lessonId: othersLessonId,
      locale: 'nl-BE',
      title: OTHERS_LESSON_TITLE,
      description: 'Questions that do not belong to any specific lesson',
    }).onConflictDoUpdate({
      target: [schema.lessonTranslations.lessonId, schema.lessonTranslations.locale],
      set: {
        title: OTHERS_LESSON_TITLE,
        description: 'Questions that do not belong to any specific lesson',
      },
    });
  }
  
  // Find questions with lesson associations
  const questionsWithLessons = await db
    .select({ questionId: schema.questionLessons.questionId })
    .from(schema.questionLessons);
  
  const questionIdsWithLessons = questionsWithLessons.map(q => q.questionId);
  
  // Find orphan questions
  let orphanQuestions: { id: number }[];
  
  if (questionIdsWithLessons.length > 0) {
    orphanQuestions = await db
      .select({ id: schema.questions.id })
      .from(schema.questions)
      .where(notInArray(schema.questions.id, questionIdsWithLessons));
  } else {
    orphanQuestions = await db
      .select({ id: schema.questions.id })
      .from(schema.questions);
  }
  
  if (orphanQuestions.length === 0) {
    if (verbose) console.log('   ✓ No orphan questions found\n');
    return 0;
  }
  
  // Assign orphans to "Others" lesson
  let assignedCount = 0;
  for (const question of orphanQuestions) {
    await db.insert(schema.questionLessons).values({
      questionId: question.id,
      lessonId: othersLessonId,
    }).onConflictDoNothing();
    assignedCount++;
  }
  
  if (verbose) console.log(`   ✓ Assigned ${assignedCount} orphan questions to "Others" lesson\n`);
  return assignedCount;
}

// ============================================================================
// MAIN SEEDER FUNCTION
// ============================================================================

/**
 * Full database seeding - the main entry point
 * Always uses upsert mode to update existing data
 */
export async function seedDatabase(options: SeederOptions = {}): Promise<SeederResult> {
  const { verbose = true, applyFixes = true, assignOrphans = true } = options;
  
  if (verbose) console.log('🌱 Starting database seeding...\n');
  
  // Load data
  const { data: inputData } = await loadDataFile(verbose);
  const { data: questions, assetsBaseUrl, categories: categoryList, lessons: lessonList } = inputData;
  
  if (verbose) {
    console.log(`   Found ${questions.length} questions`);
    console.log(`   Found ${categoryList.length} categories`);
    console.log(`   Found ${lessonList?.length || 0} lessons\n`);
  }
  
  // Seed in order
  await seedLocales(verbose);
  const regionMap = await seedRegions(verbose);
  const categoryMap = await seedCategories(categoryList, questions, verbose);
  const lessonMap = await seedLessons(lessonList, verbose);
  const assetMap = await seedAssets(questions, assetsBaseUrl, verbose);
  
  const { questionCount, choiceCount, questionLessonCount } = await seedQuestions(
    questions,
    categoryMap,
    regionMap,
    lessonMap,
    assetMap,
    { verbose }
  );
  
  // Post-seeding tasks
  if (applyFixes) await applyDataFixes(verbose);
  if (assignOrphans) await assignOrphanQuestionsToOthersLesson(verbose);
  
  if (verbose) console.log('✅ Database seeding complete!');
  
  return {
    success: true,
    questionsSeeded: questionCount,
    categoriesSeeded: categoryMap.size,
    lessonsSeeded: lessonMap.size,
    assetsSeeded: assetMap.size,
    choicesSeeded: choiceCount,
    questionLessonLinks: questionLessonCount,
  };
}

