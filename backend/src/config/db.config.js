const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Charge les variables d'environnement (.env) pour TOUS les chemins
// d'accès à la base (serveur comme scripts de seed).
dotenv.config();

// Une opération mise en file d'attente échoue en 3 s au lieu de patienter
// ~10 s par requête quand la base est injoignable (cause n°1 de « latence »).
mongoose.set('bufferTimeoutMS', 3000);

/**
 * Établit la connexion à MongoDB.
 * @throws Error si MONGO_URI est absent du fichier .env
 */
const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error(
      'MONGO_URI est manquant. Copiez ".env.example" en ".env" et renseignez MONGO_URI (puis relancez).'
    );
  }
  try {
    await mongoose.connect(uri, {
      // Échec de sélection du serveur en 5 s (défaut : 30 s de silence) avec
      // message d'aide — indispensable quand mongod est arrêté/mal exposé.
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('[ServiceDesk] MongoDB connecté avec succès');
  } catch (error) {
    console.error('[ServiceDesk] Échec de connexion MongoDB :', error.message);
    console.error(
      '[ServiceDesk] Vérifiez : 1) mongod est démarré, 2) MONGO_URI dans .env ' +
        "(préférez 127.0.0.1 à localhost — ce dernier résout parfois en IPv6 ::1 alors que mongod n'écoute qu'en IPv4), " +
        '3) port et règles de pare-feu.'
    );
    process.exit(1);
  }
};

module.exports = { connectDB };
