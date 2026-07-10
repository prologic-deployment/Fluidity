import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

/**
 * Charge utile décodée depuis le JWT.
 */
interface JwtPayload {
  tenantId: string;
  userId: string;
  role: string;
}

/**
 * Middleware d'authentification.
 * Vérifie le JWT présent dans l'en-tête "Authorization: Bearer <token>",
 * puis injecte req.tenantId, req.userId et req.userRole.
 */
export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
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

    const decoded = jwt.verify(token, secret) as JwtPayload;
    req.tenantId = decoded.tenantId;
    req.userId = decoded.userId;
    req.userRole = decoded.role;

    next();
  } catch (err) {
    res.status(401).json({ message: 'Token invalide ou expiré' });
  }
};
