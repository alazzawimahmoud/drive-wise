/**
 * Database Schema Initialization Script
 * 
 * Ensures the database schema is up to date.
 * Only handles schema/structure - does NOT seed data.
 * 
 * Usage: npm run db:init
 */

import 'dotenv/config';
import { pushSchema } from './lib/seeder.js';

async function main(): Promise<void> {
  console.log('🚀 DriveWise Database Schema Initialization\n');
  console.log('='.repeat(50) + '\n');
  
  try {
    await pushSchema(true);
    
    console.log('='.repeat(50));
    console.log('✅ Database schema initialization complete!\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Database schema initialization failed:', error);
    process.exit(1);
  }
}

main();
