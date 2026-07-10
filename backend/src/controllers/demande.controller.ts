import { Request, Response } from 'express';
import { Demande, StatutDemande } from '../models/demande.model';
import { sendSupportEmail } from '../services/email.service';

/**
 * Création d'une demande.
 * - tenantId injecté depuis le JWT (req.tenantId)
 * - statut initialisé à "Ouverte"
 * - Email asynchrone au Support N1
 */
export const createDemande = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.tenantId) {
      res.status(401).json({ message: 'Tenant non identifié' });
      return;
    }

    const demande = new Demande({
      ...req.body,
      tenantId: req.tenantId,
      statut: 'Ouverte' as StatutDemande,
    });
    await demande.save();

    const html = `
      <h2>Nouvelle demande reçue</h2>
      <ul>
        <li><strong>Objet :</strong> ${demande.objet}</li>
        <li><strong>Type :</strong> ${demande.typeDemande}</li>
        <li><strong>Catégorie :</strong> ${demande.categorie} / ${demande.sousCategorie}</li>
        <li><strong>Environnement :</strong> ${demande.serviceEnvironnement}</li>
        <li><strong>Priorité :</strong> ${demande.prioriteSouhaitee}</li>
        <li><strong>Contrat :</strong> ${demande.contrat}</li>
        <li><strong>Description :</strong> ${demande.descriptionDetaillee}</li>
      </ul>`;
    sendSupportEmail(`[Demande] ${demande.objet}`, html).catch(console.error);

    res.status(201).json(demande);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: (err as Error).message });
  }
};

/**
 * Liste des demandes du tenant (tri décroissant par date).
 */
export const getAllDemandes = async (req: Request, res: Response): Promise<void> => {
  try {
    const demandes = await Demande.find({ tenantId: req.tenantId }).sort({ createdAt: -1 });
    res.status(200).json(demandes);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: (err as Error).message });
  }
};

/**
 * Détail d'une demande (isolée par tenant).
 */
export const getDemandeById = async (req: Request, res: Response): Promise<void> => {
  try {
    const demande = await Demande.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!demande) {
      res.status(404).json({ message: 'Demande introuvable' });
      return;
    }
    res.status(200).json(demande);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: (err as Error).message });
  }
};

/**
 * Mise à jour d'une demande (isolée par tenant).
 */
export const updateDemande = async (req: Request, res: Response): Promise<void> => {
  try {
    const demande = await Demande.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!demande) {
      res.status(404).json({ message: 'Demande introuvable' });
      return;
    }
    res.status(200).json(demande);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: (err as Error).message });
  }
};

/**
 * Suppression d'une demande (isolée par tenant).
 */
export const deleteDemande = async (req: Request, res: Response): Promise<void> => {
  try {
    const demande = await Demande.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.tenantId,
    });
    if (!demande) {
      res.status(404).json({ message: 'Demande introuvable' });
      return;
    }
    res.status(200).json({ message: 'Demande supprimée avec succès' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: (err as Error).message });
  }
};
