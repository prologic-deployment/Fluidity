import app from './app';
import { connectDB } from './config/db.config';
import { seedUsers } from './seed/user.seed';

const PORT = process.env.PORT || 3000;

/**
 * Bootstrap : connexion DB -> seed automatique (1ère exécution) -> écoute.
 */
(async () => {
  try {
    await connectDB();
    // Crée les utilisateurs de démonstration automatiquement au 1er lancement
    await seedUsers();
    app.listen(PORT, () => {
      console.log(`[Fluidity] Serveur démarré sur le port ${PORT}`);
    });
  } catch (err) {
    console.error('[Fluidity] Impossible de démarrer le serveur :', err);
  }
})();
