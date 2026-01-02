/**
 * Type definitions inferred from Drizzle schema
 */

import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import * as schema from '../db/schema.js';

// ============================================================================
// INFERRED TABLE TYPES (SELECT)
// ============================================================================

export type Locale = InferSelectModel<typeof schema.locales>;
export type Region = InferSelectModel<typeof schema.regions>;
export type Asset = InferSelectModel<typeof schema.assets>;
export type Category = InferSelectModel<typeof schema.categories>;
export type CategoryTranslation = InferSelectModel<typeof schema.categoryTranslations>;
export type Lesson = InferSelectModel<typeof schema.lessons>;
export type LessonTranslation = InferSelectModel<typeof schema.lessonTranslations>;
export type Question = InferSelectModel<typeof schema.questions>;
export type QuestionTranslation = InferSelectModel<typeof schema.questionTranslations>;
export type Choice = InferSelectModel<typeof schema.choices>;
export type ChoiceTranslation = InferSelectModel<typeof schema.choiceTranslations>;
export type QuestionLesson = InferSelectModel<typeof schema.questionLessons>;

// ============================================================================
// INFERRED INSERT TYPES
// ============================================================================

export type NewLocale = InferInsertModel<typeof schema.locales>;
export type NewRegion = InferInsertModel<typeof schema.regions>;
export type NewAsset = InferInsertModel<typeof schema.assets>;
export type NewCategory = InferInsertModel<typeof schema.categories>;
export type NewCategoryTranslation = InferInsertModel<typeof schema.categoryTranslations>;
export type NewLesson = InferInsertModel<typeof schema.lessons>;
export type NewLessonTranslation = InferInsertModel<typeof schema.lessonTranslations>;
export type NewQuestion = InferInsertModel<typeof schema.questions>;
export type NewQuestionTranslation = InferInsertModel<typeof schema.questionTranslations>;
export type NewChoice = InferInsertModel<typeof schema.choices>;
export type NewChoiceTranslation = InferInsertModel<typeof schema.choiceTranslations>;
export type NewQuestionLesson = InferInsertModel<typeof schema.questionLessons>;

// ============================================================================
// ENUM TYPES
// ============================================================================

export type AnswerType = 'SINGLE_CHOICE' | 'YES_NO' | 'INPUT' | 'ORDER';
export type RegionCode = 'national' | 'brussels' | 'flanders' | 'wallonia';
export type LocaleCode = 'nl-BE' | 'fr-BE' | 'de-BE' | 'en';
export type AssetType = 'image' | 'video';

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/** Category with translation */
export interface CategoryWithTranslation {
  id: number;
  slug: string;
  sortOrder: number;
  title: string | null;
  description: string | null;
}

/** Choice in API response */
export interface ApiChoice {
  position: number;
  text: string | null;
  imageUrl: string | null;
}

/** Question in API response */
export interface ApiQuestion {
  id: number;
  originalId: string;
  answerType: AnswerType;
  answer?: Question['answer'];
  isMajorFault: boolean;
  questionText: string | null;
  explanation?: string | null;
  category: {
    slug: string | null;
    title: string | null;
  };
  region: {
    code: string | null;
    name: string | null;
  } | null;
  imageUrl: string | null;
  choices: ApiChoice[];
  lessons: ApiQuestionLesson[];
}

/** Exam configuration */
export interface ExamConfig {
  totalQuestions: number;
  passThreshold: number;
  majorFaultPenalty: number;
  minorFaultPenalty: number;
  maxScore: number;
  timeLimitMinutes: number;
}

/** Exam generation response */
export interface ExamGenerateResponse {
  config: ExamConfig;
  generatedAt: string;
  questions: ApiQuestion[];
}

/** Answer submission */
export interface AnswerSubmission {
  questionId: number;
  answer: number | string | number[];
}

/** Scoring detail for a single question */
export interface ScoreDetail {
  questionId: number;
  submitted: number | string | number[];
  correct: Question['answer'];
  isCorrect: boolean;
  isMajorFault: boolean;
}

/** Exam result */
export interface ExamResult {
  totalQuestions: number;
  correct: number;
  incorrect: number;
  majorFaults: number;
  minorFaults: number;
  score: number;
  maxScore: number;
  passed: boolean;
  passThreshold: number;
  percentage: number;
}

/** Exam score response */
export interface ExamScoreResponse {
  result: ExamResult;
  details: ScoreDetail[];
}

// ============================================================================
// RAW DATA TYPES (for import scripts)
// ============================================================================

/** Raw question from data_final.json */
export interface RawQuestion {
  id: string;
  title: string;
  seriesId: string | number;
  image?: string;
  video?: string;
  question: string;
  answer: number | string | number[];
  explanation: string;
  answerType: AnswerType;
  isMajorFault: boolean;
  choices: RawChoice[];
  source: number;
}

/** Raw choice from data_final.json */
export interface RawChoice {
  text?: string;
  image?: string;
}

/** Cleaned/processed question */
export interface CleanedQuestion {
  originalId: string;
  categorySlug: string;
  categoryTitle: string;
  regionCode: RegionCode;
  imageUuid?: string;
  videoId?: string;
  questionText: string;
  questionTextOriginal: string;
  explanation: string;
  explanationOriginal: string;
  answer: number | string | number[];
  answerType: AnswerType;
  isMajorFault: boolean;
  choices: CleanedChoice[];
  source: number;
  lessonNumbers: number[]; // Lesson numbers extracted from explanation
}

/** Cleaned choice */
export interface CleanedChoice {
  position: number;
  text?: string;
  imageUuid?: string;
}

// ============================================================================
// LESSON TYPES
// ============================================================================

/** Extracted lesson from cleanup process */
export interface ExtractedLesson {
  number: number;
  slug: string;
  topic: string;
  questionCount: number;
}

/** Lesson reference for a question */
export interface LessonReference {
  lessonNumber: number;
  lessonSlug: string;
}

/** Lesson with translation in API response */
export interface ApiLesson {
  id: number;
  number: number;
  slug: string;
  title: string | null;
  description: string | null;
  questionCount: number;
}

/** Lesson in question API response */
export interface ApiQuestionLesson {
  number: number;
  slug: string;
  title: string | null;
}
