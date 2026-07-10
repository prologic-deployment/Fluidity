import mongoose from 'mongoose';
import { connectDB } from '../config/db.config';
import { seedUsers } from './user.seed';

/**
 * Script autonome de seed : se connecte, insère les utilisateurs de
 * démonstration si la collection est vide, puis se déconnecte.
 * Usage : npm run seed
 */
(async () => {
  try {
    await connectDB();
    await seedUsers();
  } catch (err) {
    console.error('[Seed] Échec du seed :', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
