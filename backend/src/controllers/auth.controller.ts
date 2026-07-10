import { Request, Response } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { Utilisateur } from '../models/user.model';
import { sendResetPasswordEmail } from '../services/email.service';

/**
 * Inscription d'un nouvel utilisateur (attribution du tenantId).
 */
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId, email, password, role } = req.body;

    const existing = await Utilisateur.findOne({ email });
    if (existing) {
      res.status(409).json({ message: 'Cet email est déjà utilisé' });
      return;
    }

    const user = new Utilisateur({
      tenantId,
      email,
      password,
      role: role || 'CLIENT',
    });
    await user.save();

    res.status(201).json({ message: 'Utilisateur créé avec succès', userId: user._id });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: (err as Error).message });
  }
};

/**
 * Connexion : vérifie les identifiants et renvoie un JWT contenant
 * tenantId + userId + role.
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await Utilisateur.findOne({ email });
    if (!user) {
      res.status(401).json({ message: 'Identifiants invalides' });
      return;
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      res.status(401).json({ message: 'Identifiants invalides' });
      return;
    }

    const secret = process.env.JWT_SECRET as jwt.Secret;
    const expiresIn = (process.env.JWT_EXPIRES_IN || '7d') as SignOptions['expiresIn'];
    const token = jwt.sign(
      { tenantId: user.tenantId, userId: user._id, role: user.role },
      secret,
      { expiresIn }
    );

    res.status(200).json({
      token,
      userId: user._id,
      tenantId: user.tenantId,
      role: user.role,
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: (err as Error).message });
  }
};

/**
 * Mot de passe oublié : génère un token UUID (valable 1h) et envoie
 * un email de réinitialisation de façon asynchrone.
 */
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    const user = await Utilisateur.findOne({ email });
    // Réponse neutre pour ne pas révéler l'existence de l'email
    if (!user) {
      res.status(200).json({
        message: 'Si l\'email existe, un lien de réinitialisation a été envoyé',
      });
      return;
    }

    const token = uuidv4();
    user.resetToken = token;
    user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 heure
    await user.save();

    // Envoi asynchrone (ne bloque pas la réponse HTTP)
    sendResetPasswordEmail(email, token).catch(console.error);

    res.status(200).json({
      message: 'Si l\'email existe, un lien de réinitialisation a été envoyé',
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: (err as Error).message });
  }
};

/**
 * Réinitialisation effective du mot de passe à partir d'un token valide.
 */
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, password } = req.body;

    const user = await Utilisateur.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() },
    });
    if (!user) {
      res.status(400).json({ message: 'Token invalide ou expiré' });
      return;
    }

    user.password = password; // hashé via le hook pre-save
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    res.status(200).json({ message: 'Mot de passe réinitialisé avec succès' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: (err as Error).message });
  }
};

/**
 * Renvoie le profil de l'utilisateur authentifié (sans données sensibles).
 */
export const me = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await Utilisateur.findOne({
      _id: req.userId,
      tenantId: req.tenantId,
    }).select('-password -resetToken -resetTokenExpiry');

    if (!user) {
      res.status(404).json({ message: 'Utilisateur introuvable' });
      return;
    }
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: (err as Error).message });
  }
};
