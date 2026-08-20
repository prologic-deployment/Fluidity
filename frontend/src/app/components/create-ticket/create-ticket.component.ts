import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TicketService } from '../../services/ticket.service';
import { ContratService } from '../../services/contrat.service';
import { AuthService } from '../../services/auth.service';
import { CATEGORIES, SOUS_CATEGORIES } from '../../models/demande.model';
import {
  IMPACTS_TICKET,
  URGENCES_TICKET,
  calculatePriority,
  champsDiagnostic,
  Ticket,
  TicketDiagnostic,
} from '../../models/ticket.model';
import { Contrat } from '../../models/contrat.model';
import { DropzoneComponent } from '../shared/dropzone.component';
import { UploadedFile } from '../../services/upload.service';

const AUTRE = 'Autre';

@Component({
  selector: 'app-create-ticket',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, DropzoneComponent],
  templateUrl: './create-ticket.component.html',
})
export class CreateTicketComponent implements OnInit {
  form!: FormGroup;
  categories = CATEGORIES;
  impacts = IMPACTS_TICKET;
  urgences = URGENCES_TICKET;
  sousCategories: string[] = [];
  diagnosticChamps: string[] = [];
  contrats: Contrat[] = [];
  piecesJointes: UploadedFile[] = [];
  loading = false;
  error: string | null = null;

  constructor(
    private fb: FormBuilder,
    private ticketService: TicketService,
    private contratService: ContratService,
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      objet: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(200)]],
      descriptionDetaillee: ['', [Validators.required, Validators.minLength(10)]],
      categorie: ['', Validators.required],
      categorieAutre: [''],
      sousCategorie: ['', Validators.required],
      sousCategorieAutre: [''],
      impact: ['', Validators.required],
      urgence: ['', Validators.required],
      contrat: ['', Validators.required],
      diagnostic: this.fb.group({
        source: [''], destination: [''], protocole: [''], port: [''], direction: [''],
        comportement: [''], nomVm: [''], environnement: [''], hote: [''], ip: [''],
        systemeStockage: [''], volume: [''], capacite: [''], systemeAffecte: [''],
        evenementSecurite: [''], heureDetection: [''],
      }),
    });

    this.form.get('categorie')?.valueChanges.subscribe((cat: string) => {
      this.sousCategories = SOUS_CATEGORIES[cat] || [];
      this.diagnosticChamps = champsDiagnostic(cat);
      this.form.get('sousCategorie')?.setValue('');
      this.form.get('sousCategorieAutre')?.setValue('');
      this.setValidator(this.form.get('categorieAutre'), cat === AUTRE);
      this.setValidator(this.form.get('sousCategorie'), cat !== AUTRE);
      this.setValidator(this.form.get('sousCategorieAutre'), cat === AUTRE);
    });

    this.form.get('sousCategorie')?.valueChanges.subscribe((val: string) => {
      if (this.form.get('categorie')?.value === AUTRE) return;
      this.setValidator(this.form.get('sousCategorieAutre'), val === AUTRE);
    });

    this.contratService.getAll(this.auth.getEmail() || undefined).subscribe({
      next: (data) => (this.contrats = data),
      error: () => (this.contrats = []),
    });
  }

  private setValidator(control: any, required: boolean): void {
    if (!control) return;
    control.setValidators(required ? [Validators.required] : []);
    control.updateValueAndValidity({ emitEvent: false });
  }

  onPiecesJointesChange(files: UploadedFile[]): void {
    this.piecesJointes = files;
  }

  /** Priorité calculée (matrice Impact × Urgence) — prévisualisation seulement. */
  priorityPreview(): string | null {
    return calculatePriority(this.form?.get('impact')?.value, this.form?.get('urgence')?.value);
  }

  isDiagnosticFieldVisible(field: string): boolean {
    return this.diagnosticChamps.includes(field);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.value;
    const categorie = raw.categorie === AUTRE ? raw.categorieAutre : raw.categorie;
    const sousCategorie = raw.sousCategorie === AUTRE ? raw.sousCategorieAutre : raw.sousCategorie;

    // Nettoyer le diagnostic : ne conserver que les champs visibles pour la catégorie
    const diagnostic: Record<string, string> = {};
    for (const f of this.diagnosticChamps) {
      if (raw.diagnostic[f]) diagnostic[f] = raw.diagnostic[f];
    }

    const payload: Partial<Ticket> = {
      objet: raw.objet.trim(),
      descriptionDetaillee: raw.descriptionDetaillee.trim(),
      categorie,
      sousCategorie,
      impact: raw.impact,
      urgence: raw.urgence,
      contrat: raw.contrat,
      diagnostic: Object.keys(diagnostic).length ? diagnostic : undefined,
      piecesJointes: this.piecesJointes.map((f) => f.url),
    };

    this.loading = true;
    this.error = null;
    this.ticketService.create(payload).subscribe({
      next: (ticket) => this.router.navigate(['/tickets', ticket._id]),
      error: (err) => {
        this.error = err.error?.message || 'Erreur lors de la création du ticket.';
        this.loading = false;
      },
    });
  }
}
