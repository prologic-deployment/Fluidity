import mongoose from 'mongoose';

/**
 * Établit la connexion à MongoDB.
 * @throws Error si MONGO_URI est absent du fichier .env
 */
export const connectDB = async (): Promise<void> => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI est manquant dans le fichier .env');
  }
  try {
    await mongoose.connect(uri);
    console.log('[Fluidity] MongoDB connecté avec succès');
  } catch (error) {
    console.error('[Fluidity] Échec de connexion MongoDB :', error);
    process.exit(1);
  }
};
