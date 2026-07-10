import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Charge les variables d'environnement (.env) pour TOUS les chemins
// d'accès à la base (serveur comme scripts de seed).
dotenv.config();

/**
 * Établit la connexion à MongoDB.
 * @throws Error si MONGO_URI est absent du fichier .env
 */
export const connectDB = async (): Promise<void> => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error(
      'MONGO_URI est manquant. Copiez ".env.example" en ".env" et renseignez MONGO_URI (puis relancez).'
    );
  }
  try {
    await mongoose.connect(uri);
    console.log('[Fluidity] MongoDB connecté avec succès');
  } catch (error) {
    console.error('[Fluidity] Échec de connexion MongoDB :', error);
    process.exit(1);
  }
};
