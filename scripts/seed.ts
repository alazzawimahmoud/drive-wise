/**
 * Database Seeder Script
 * 
 * Seeds the PostgreSQL database with cleaned/rephrased question data.
 * Always uses upsert mode to update existing data while preserving user data.
 * 
 * Usage: npm run db:seed
 * 
 * Input: data/rephrased.json (or data/cleaned.json)
 * Output: Populated database tables
 */

import 'dotenv/config';
import { seedDatabase } from './lib/seeder.js';

async function main() {
  console.log('🌱 Starting database seeding...\n');
  
  try {
    const result = await seedDatabase({
      verbose: true,
      applyFixes: true,
      assignOrphans: true,
    });
    
    console.log('\n📊 Seeding Summary:');
    console.log(`   Questions: ${result.questionsSeeded}`);
    console.log(`   Categories: ${result.categoriesSeeded}`);
    console.log(`   Lessons: ${result.lessonsSeeded}`);
    console.log(`   Assets: ${result.assetsSeeded}`);
    console.log(`   Choices: ${result.choicesSeeded}`);
    console.log(`   Question-Lesson Links: ${result.questionLessonLinks}`);
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    process.exit(1);
  }
}

main();
