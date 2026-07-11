import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DemandeService } from '../../services/demande.service';
import { ContratService } from '../../services/contrat.service';
import {
  PRIORITES,
  CATEGORIES,
  SOUS_CATEGORIES,
  TYPES_DEMANDE,
  SERVICES_ENVIRONNEMENT,
  Demande,
} from '../../models/demande.model';
import { Contrat } from '../../models/contrat.model';

@Component({
  selector: 'app-create-demande',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './create-demande.component.html',
})
export class CreateDemandeComponent implements OnInit {
  form!: FormGroup;
  priorites = PRIORITES;
  categories = CATEGORIES;
  typesDemande = TYPES_DEMANDE;
  servicesEnvironnement = SERVICES_ENVIRONNEMENT;
  sousCategories: string[] = [];
  contrats: Contrat[] = [];
  loading = false;
  error: string | null = null;

  constructor(
    private fb: FormBuilder,
    private demandeService: DemandeService,
    private contratService: ContratService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      clientId: ['', Validators.required],
      objet: ['', Validators.required],
      typeDemande: ['', Validators.required],
      serviceEnvironnement: ['', Validators.required],
      categorie: ['', Validators.required],
      sousCategorie: ['', Validators.required],
      descriptionDetaillee: ['', [Validators.required, Validators.minLength(10)]],
      prioriteSouhaitee: ['Standard', Validators.required],
      dateSouhaiteeRealisation: [''],
      informationsComplementaires: [''],
      contrat: ['', Validators.required],
      piecesJointes: [''], // saisie libre séparée par des virgules
    });

    this.contratService.getAll().subscribe({
      next: (data) => (this.contrats = data),
      error: () => (this.contrats = []),
    });
  }

  /** Contrats du client actuellement saisi (ou l'ensemble des contrats du tenant à défaut). */
  contratsDisponibles(): Contrat[] {
    const clientId = this.form?.get('clientId')?.value;
    if (!clientId) return this.contrats;
    const forClient = this.contrats.filter((c) => c.clientId === clientId);
    return forClient.length ? forClient : this.contrats;
  }

  onCategorieChange(): void {
    const cat = this.form.get('categorie')?.value;
    this.sousCategories = SOUS_CATEGORIES[cat] || [];
    this.form.get('sousCategorie')?.setValue('');
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.value;
    const payload: Demande = {
      clientId: raw.clientId,
      objet: raw.objet,
      typeDemande: raw.typeDemande,
      serviceEnvironnement: raw.serviceEnvironnement,
      categorie: raw.categorie,
      sousCategorie: raw.sousCategorie,
      descriptionDetaillee: raw.descriptionDetaillee,
      prioriteSouhaitee: raw.prioriteSouhaitee,
      contrat: raw.contrat,
      informationsComplementaires: raw.informationsComplementaires || undefined,
      dateSouhaiteeRealisation: raw.dateSouhaiteeRealisation || undefined,
      piecesJointes: raw.piecesJointes
        ? raw.piecesJointes.split(',').map((s: string) => s.trim()).filter((s: string) => s)
        : [],
    };

    this.loading = true;
    this.error = null;
    this.demandeService.create(payload).subscribe({
      next: () => this.router.navigate(['/demandes']),
      error: (err) => {
        this.error = err.error?.message || 'Erreur lors de la création de la demande.';
        this.loading = false;
      },
    });
  }
}
