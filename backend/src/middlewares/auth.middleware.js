const jwt = require('jsonwebtoken');

/**
 * Middleware d'authentification.
 * Vérifie le JWT présent dans l'en-tête "Authorization: Bearer <token>",
 * puis injecte :
 *   - req.userId   : ObjectId du principal (Utilisateur OU Client)
 *   - req.userRole : rôle effectif ('CLIENT' pour un accès portail client)
 *   - req.userEmail
 *   - req.principalType : 'UTILISATEUR' | 'CLIENT'
 *   - req.tokenIat
 */
const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ message: 'Authentification requise' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      res.status(500).json({ message: 'Configuration JWT manquante' });
      return;
    }

    const decoded = jwt.verify(token, secret);
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    req.userEmail = decoded.email;
    req.principalType = decoded.principal || 'UTILISATEUR';
    req.tokenIat = decoded.iat;

    next();
  } catch (err) {
    res.status(401).json({ message: 'Token invalide ou expiré' });
  }
};

module.exports = { authMiddleware, requireRole };

/**
 * Middleware de contrôle d'accès par rôle.
 * Usage : router.post('/', authMiddleware, requireRole('ADMIN'), handler)
 * Le rôle effectif d'un accès portail client est 'CLIENT' (ROLE_PORTAIL).
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      res.status(403).json({ message: 'Accès refusé : permissions insuffisantes' });
      return;
    }
    next();
  };
}
