import { Request, Response } from 'express';
import { Changement, StatutChangement } from '../models/changement.model';
import { sendSupportEmail } from '../services/email.service';

/**
 * Création d'un changement.
 * - tenantId injecté depuis le JWT (req.tenantId)
 * - statut initialisé à "Soumis"
 * - Email asynchrone au Responsable Technique
 */
export const createChangement = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.tenantId) {
      res.status(401).json({ message: 'Tenant non identifié' });
      return;
    }

    const changement = new Changement({
      ...req.body,
      tenantId: req.tenantId,
      statut: 'Soumis' as StatutChangement,
    });
    await changement.save();

    const html = `
      <h2>Nouveau changement soumis</h2>
      <ul>
        <li><strong>Objet :</strong> ${changement.objetChangement}</li>
        <li><strong>Type :</strong> ${changement.typeChangement}</li>
        <li><strong>Catégorie :</strong> ${changement.categorie} / ${changement.sousCategorie}</li>
        <li><strong>Environnement :</strong> ${changement.serviceEnvironnement}</li>
        <li><strong>Fenêtre d'intervention :</strong> ${changement.fenetreIntervention}</li>
        <li><strong>Plan de retour arrière :</strong> ${changement.planRetourArriere}</li>
        <li><strong>Description :</strong> ${changement.descriptionDetaillee}</li>
      </ul>`;
    sendSupportEmail(`[Changement] ${changement.objetChangement}`, html).catch(console.error);

    res.status(201).json(changement);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: (err as Error).message });
  }
};

/**
 * Liste des changements du tenant.
 */
export const getAllChangements = async (req: Request, res: Response): Promise<void> => {
  try {
    const changements = await Changement.find({ tenantId: req.tenantId }).sort({ createdAt: -1 });
    res.status(200).json(changements);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: (err as Error).message });
  }
};

/**
 * Détail d'un changement (isolé par tenant).
 */
export const getChangementById = async (req: Request, res: Response): Promise<void> => {
  try {
    const changement = await Changement.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!changement) {
      res.status(404).json({ message: 'Changement introuvable' });
      return;
    }
    res.status(200).json(changement);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: (err as Error).message });
  }
};

/**
 * Mise à jour d'un changement (isolé par tenant).
 */
export const updateChangement = async (req: Request, res: Response): Promise<void> => {
  try {
    const changement = await Changement.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!changement) {
      res.status(404).json({ message: 'Changement introuvable' });
      return;
    }
    res.status(200).json(changement);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: (err as Error).message });
  }
};

/**
 * Suppression d'un changement (isolé par tenant).
 */
export const deleteChangement = async (req: Request, res: Response): Promise<void> => {
  try {
    const changement = await Changement.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.tenantId,
    });
    if (!changement) {
      res.status(404).json({ message: 'Changement introuvable' });
      return;
    }
    res.status(200).json({ message: 'Changement supprimé avec succès' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: (err as Error).message });
  }
};
