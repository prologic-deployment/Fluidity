import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TicketService } from '../../services/ticket.service';
import { ContratService } from '../../services/contrat.service';
import { Contrat } from '../../models/contrat.model';
import { DropzoneComponent } from '../shared/dropzone.component';
import { UploadedFile } from '../../services/upload.service';
import {
  CATEGORIES_TICKET,
  SOUS_CATEGORIES_TICKET,
  TYPES_TICKET,
  IMPACTS_TICKET,
  URGENCES_TICKET,
  calculatePriority,
  champsDiagnostic,
  PrioriteTicket,
} from '../../models/ticket.model';

const AUTRE = 'Autre';

@Component({
  selector: 'app-create-ticket',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, DropzoneComponent],
  templateUrl: './create-ticket.component.html',
})
export class CreateTicketComponent implements OnInit {
  form!: FormGroup;
  types = TYPES_TICKET;
  categories = CATEGORIES_TICKET;
  impacts = IMPACTS_TICKET;
  urgences = URGENCES_TICKET;
  sousCategories: string[] = [];
  contrats: Contrat[] = [];
  piecesJointes: UploadedFile[] = [];
  loading = false;
  error: string | null = null;

  constructor(
    private fb: FormBuilder,
    private tickets: TicketService,
    private contratService: ContratService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      objet: ['', [Validators.required, Validators.maxLength(200)]],
      descriptionDetaillee: ['', [Validators.required, Validators.minLength(10)]],
      type: ['Incident', Validators.required],
      categorie: ['', Validators.required],
      categorieAutre: [''],
      sousCategorie: ['', Validators.required],
      sousCategorieAutre: [''],
      impact: ['', Validators.required],
      urgence: ['', Validators.required],
      contrat: ['', Validators.required],
      diagnostic: this.fb.group({
        source: [''],
        destination: [''],
        protocole: [''],
        port: [''],
        direction: [''],
        comportement: [''],
        nomVm: [''],
        environnement: [''],
        hote: [''],
        ip: [''],
        systemeStockage: [''],
        volume: [''],
        capacite: [''],
        systemeAffecte: [''],
        evenementSecurite: [''],
        heureDetection: [''],
      }),
    });

    this.form.get('categorie')?.valueChanges.subscribe((cat: string) => {
      const estAutre = cat === AUTRE;
      this.sousCategories = SOUS_CATEGORIES_TICKET[cat] || [];
      this.form.get('sousCategorie')?.setValue('');
      this.form.get('sousCategorieAutre')?.setValue('');
      if (!estAutre) this.form.get('categorieAutre')?.setValue('');
      this.setRequired('categorieAutre', estAutre);
      this.setRequired('sousCategorie', !estAutre);
      this.setRequired('sousCategorieAutre', estAutre);
      this.resetDiagnostic();
    });
    this.form.get('sousCategorie')?.valueChanges.subscribe((val: string) => {
      if (this.form.get('categorie')?.value === AUTRE) return;
      this.setRequired('sousCategorieAutre', val === AUTRE);
    });

    this.contratService.getAll().subscribe({
      next: (data) => (this.contrats = data.filter((c) => c.statut === 'Actif')),
      error: () => (this.contrats = []),
    });
  }

  get prioriteCalculee(): PrioriteTicket | null {
    return calculatePriority(this.form?.get('impact')?.value, this.form?.get('urgence')?.value);
  }

  showDiag(champ: string): boolean {
    return champsDiagnostic(this.form?.get('categorie')?.value).includes(champ);
  }

  onPiecesJointesChange(files: UploadedFile[]): void {
    this.piecesJointes = files;
  }

  private setRequired(name: string, required: boolean): void {
    const c = this.form.get(name);
    if (!c) return;
    c.setValidators(required ? [Validators.required] : []);
    c.updateValueAndValidity({ emitEvent: false });
  }

  private resetDiagnostic(): void {
    this.form.get('diagnostic')?.reset({});
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.value;
    const categorie = raw.categorie === AUTRE ? raw.categorieAutre : raw.categorie;
    const sousCategorie = raw.sousCategorie === AUTRE ? raw.sousCategorieAutre : raw.sousCategorie;
    const diagnostic: Record<string, string> = {};
    for (const key of champsDiagnostic(raw.categorie)) {
      const v = raw.diagnostic?.[key];
      if (v) diagnostic[key] = v;
    }

    this.loading = true;
    this.error = null;
    this.tickets
      .create({
        objet: raw.objet.trim(),
        descriptionDetaillee: raw.descriptionDetaillee.trim(),
        type: 'Incident',
        categorie,
        sousCategorie,
        impact: raw.impact,
        urgence: raw.urgence,
        contrat: raw.contrat,
        piecesJointes: this.piecesJointes.map((f) => f.url),
        diagnostic,
      })
      .subscribe({
        next: (t) => this.router.navigate(['/tickets', t._id]),
        error: (err) => {
          this.error = err.error?.message || 'Erreur lors de la création du ticket.';
          this.loading = false;
        },
      });
  }
}
