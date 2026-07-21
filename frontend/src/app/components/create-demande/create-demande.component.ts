import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DemandeService } from '../../services/demande.service';
import { ContratService } from '../../services/contrat.service';
import { AuthService } from '../../services/auth.service';
import {
  PRIORITES,
  CATEGORIES,
  SOUS_CATEGORIES,
  TYPES_DEMANDE,
  SERVICES_ENVIRONNEMENT,
  Demande,
} from '../../models/demande.model';
import { Contrat } from '../../models/contrat.model';
import { DropzoneComponent } from '../shared/dropzone.component';
import { UploadedFile } from '../../services/upload.service';

@Component({
  selector: 'app-create-demande',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, DropzoneComponent],
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
  piecesJointes: UploadedFile[] = [];
  loading = false;
  error: string | null = null;

  constructor(
    private fb: FormBuilder,
    private demandeService: DemandeService,
    private contratService: ContratService,
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
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
    });

    // Contrats du client connecté uniquement (une demande est toujours créée en son nom)
    this.contratService.getAll(this.auth.getEmail() || undefined).subscribe({
      next: (data) => (this.contrats = data),
      error: () => (this.contrats = []),
    });
  }

  onPiecesJointesChange(files: UploadedFile[]): void {
    this.piecesJointes = files;
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
    // clientId est dérivé côté serveur du compte authentifié (jamais envoyé par le client)
    const payload: Demande = {
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
      piecesJointes: this.piecesJointes.map((f) => f.url),
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
