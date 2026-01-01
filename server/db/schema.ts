import { pgTable, serial, varchar, text, boolean, integer, json, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// LOCALES
// ============================================================================

export const locales = pgTable('locales', {
  code: varchar('code', { length: 10 }).primaryKey(), // nl-BE, fr-BE, de-BE, en
  name: varchar('name', { length: 100 }).notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
});

// ============================================================================
// REGIONS
// ============================================================================

export const regions = pgTable('regions', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 50 }).unique().notNull(), // brussels, flanders, wallonia, national
  name: varchar('name', { length: 100 }).notNull(),
});

// ============================================================================
// ASSETS
// ============================================================================

export const assets = pgTable('assets', {
  id: serial('id').primaryKey(),
  uuid: varchar('uuid', { length: 100 }).unique().notNull(),
  type: varchar('type', { length: 20 }).notNull(), // image, video
  originalUrl: text('original_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================================
// CATEGORIES
// ============================================================================

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  slug: varchar('slug', { length: 100 }).unique().notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const categoryTranslations = pgTable('category_translations', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id').references(() => categories.id).notNull(),
  locale: varchar('locale', { length: 10 }).references(() => locales.code).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
});

// ============================================================================
// LESSONS
// ============================================================================

export const lessons = pgTable('lessons', {
  id: serial('id').primaryKey(),
  number: integer('number').unique().notNull(), // Lesson number (1-34)
  slug: varchar('slug', { length: 50 }).unique().notNull(), // les-1, les-2, etc.
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const lessonTranslations = pgTable('lesson_translations', {
  id: serial('id').primaryKey(),
  lessonId: integer('lesson_id').references(() => lessons.id).notNull(),
  locale: varchar('locale', { length: 10 }).references(() => locales.code).notNull(),
  title: varchar('title', { length: 255 }).notNull(), // Topic name
  description: text('description'),
});

// ============================================================================
// QUESTIONS
// ============================================================================

export const questions = pgTable('questions', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id').references(() => categories.id).notNull(),
  regionId: integer('region_id').references(() => regions.id),
  originalId: varchar('original_id', { length: 100 }).notNull(), // Original ID from source data
  answerType: varchar('answer_type', { length: 20 }).notNull(), // SINGLE_CHOICE, YES_NO, INPUT, ORDER
  answer: json('answer').notNull(), // Can be number, string, or array
  isMajorFault: boolean('is_major_fault').default(false).notNull(),
  source: integer('source').notNull(), // 1 or 2 from original data
  imageAssetId: integer('image_asset_id').references(() => assets.id),
  videoAssetId: integer('video_asset_id').references(() => assets.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const questionTranslations = pgTable('question_translations', {
  id: serial('id').primaryKey(),
  questionId: integer('question_id').references(() => questions.id).notNull(),
  locale: varchar('locale', { length: 10 }).references(() => locales.code).notNull(),
  questionText: text('question_text').notNull(),
  questionTextOriginal: text('question_text_original'), // Original before rephrasing
  explanation: text('explanation'),
  explanationOriginal: text('explanation_original'), // Original before rephrasing
});

// ============================================================================
// CHOICES
// ============================================================================

export const choices = pgTable('choices', {
  id: serial('id').primaryKey(),
  questionId: integer('question_id').references(() => questions.id).notNull(),
  position: integer('position').notNull(), // 0, 1, 2, etc.
  imageAssetId: integer('image_asset_id').references(() => assets.id),
});

export const choiceTranslations = pgTable('choice_translations', {
  id: serial('id').primaryKey(),
  choiceId: integer('choice_id').references(() => choices.id).notNull(),
  locale: varchar('locale', { length: 10 }).references(() => locales.code).notNull(),
  text: text('text'),
});

// ============================================================================
// QUESTION-LESSON JUNCTION (many-to-many)
// ============================================================================

export const questionLessons = pgTable('question_lessons', {
  id: serial('id').primaryKey(),
  questionId: integer('question_id').references(() => questions.id).notNull(),
  lessonId: integer('lesson_id').references(() => lessons.id).notNull(),
});

// ============================================================================
// RELATIONS
// ============================================================================

export const categoriesRelations = relations(categories, ({ many }) => ({
  translations: many(categoryTranslations),
  questions: many(questions),
}));

export const categoryTranslationsRelations = relations(categoryTranslations, ({ one }) => ({
  category: one(categories, {
    fields: [categoryTranslations.categoryId],
    references: [categories.id],
  }),
  locale: one(locales, {
    fields: [categoryTranslations.locale],
    references: [locales.code],
  }),
}));

export const questionsRelations = relations(questions, ({ one, many }) => ({
  category: one(categories, {
    fields: [questions.categoryId],
    references: [categories.id],
  }),
  region: one(regions, {
    fields: [questions.regionId],
    references: [regions.id],
  }),
  imageAsset: one(assets, {
    fields: [questions.imageAssetId],
    references: [assets.id],
  }),
  videoAsset: one(assets, {
    fields: [questions.videoAssetId],
    references: [assets.id],
  }),
  translations: many(questionTranslations),
  choices: many(choices),
  questionLessons: many(questionLessons),
}));

export const questionTranslationsRelations = relations(questionTranslations, ({ one }) => ({
  question: one(questions, {
    fields: [questionTranslations.questionId],
    references: [questions.id],
  }),
  locale: one(locales, {
    fields: [questionTranslations.locale],
    references: [locales.code],
  }),
}));

export const choicesRelations = relations(choices, ({ one, many }) => ({
  question: one(questions, {
    fields: [choices.questionId],
    references: [questions.id],
  }),
  imageAsset: one(assets, {
    fields: [choices.imageAssetId],
    references: [assets.id],
  }),
  translations: many(choiceTranslations),
}));

export const choiceTranslationsRelations = relations(choiceTranslations, ({ one }) => ({
  choice: one(choices, {
    fields: [choiceTranslations.choiceId],
    references: [choices.id],
  }),
  locale: one(locales, {
    fields: [choiceTranslations.locale],
    references: [locales.code],
  }),
}));

export const lessonsRelations = relations(lessons, ({ many }) => ({
  translations: many(lessonTranslations),
  questionLessons: many(questionLessons),
}));

export const lessonTranslationsRelations = relations(lessonTranslations, ({ one }) => ({
  lesson: one(lessons, {
    fields: [lessonTranslations.lessonId],
    references: [lessons.id],
  }),
  locale: one(locales, {
    fields: [lessonTranslations.locale],
    references: [locales.code],
  }),
}));

export const questionLessonsRelations = relations(questionLessons, ({ one }) => ({
  question: one(questions, {
    fields: [questionLessons.questionId],
    references: [questions.id],
  }),
  lesson: one(lessons, {
    fields: [questionLessons.lessonId],
    references: [lessons.id],
  }),
}));

