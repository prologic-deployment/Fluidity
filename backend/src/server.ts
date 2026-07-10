import app from './app';
import { connectDB } from './config/db.config';

const PORT = process.env.PORT || 3000;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[Fluidity] Serveur démarré sur le port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[Fluidity] Impossible de démarrer le serveur :', err);
  });
