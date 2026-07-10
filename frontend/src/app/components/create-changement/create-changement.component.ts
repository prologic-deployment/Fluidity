import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ChangementService } from '../../services/changement.service';
import {
  CATEGORIES_CHANGEMENT,
  SOUS_CATEGORIES_CHANGEMENT,
  TYPES_CHANGEMENT,
  Changement,
} from '../../models/changement.model';

@Component({
  selector: 'app-create-changement',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './create-changement.component.html',
})
export class CreateChangementComponent implements OnInit {
  form!: FormGroup;
  typesChangement = TYPES_CHANGEMENT;
  categories = CATEGORIES_CHANGEMENT;
  sousCategories: string[] = [];
  loading = false;
  error: string | null = null;

  constructor(
    private fb: FormBuilder,
    private changementService: ChangementService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      clientId: ['', Validators.required],
      objetChangement: ['', Validators.required],
      descriptionDetaillee: ['', [Validators.required, Validators.minLength(10)]],
      serviceEnvironnement: ['', Validators.required],
      categorie: ['', Validators.required],
      sousCategorie: ['', Validators.required],
      fenetreIntervention: ['', Validators.required],
      prerequisNecessaires: [''],
      planRetourArriere: ['', Validators.required],
      typeChangement: ['Normal', Validators.required],
      general: this.fb.group({
        ressourcesConcernees: [''],
        environnement: [''],
        commentaire: [''],
      }),
      serveur: this.fb.group({
        os: [''],
        cpuCores: [null],
        ramGo: [null],
        disqueNvmeGo: [null],
        disqueSasGo: [null],
      }),
      reseau: this.fb.group({
        vlan: [''],
        adresseIp: [''],
        masqueSousReseau: [''],
        passerelle: [''],
      }),
      backup: this.fb.group({
        espaceBackupSupplementaireGo: [null],
        retentionSouhaitee: [''],
        licencesNecessaires: [''],
      }),
    });
  }

  onCategorieChange(): void {
    const cat = this.form.get('categorie')?.value;
    this.sousCategories = SOUS_CATEGORIES_CHANGEMENT[cat] || [];
    this.form.get('sousCategorie')?.setValue('');
  }

  /** Retire les champs vides/null pour ne pas polluer le payload. */
  private clean(obj: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      const v = obj[key];
      if (v === '' || v === null || v === undefined) continue;
      out[key] = v;
    }
    return out;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.value;
    const general = this.clean(raw.general);
    const serveur = this.clean(raw.serveur);
    const reseau = this.clean(raw.reseau);
    const backup = this.clean(raw.backup);

    const specifications: any = {};
    if (Object.keys(general).length) specifications.general = general;
    if (Object.keys(serveur).length) specifications.serveur = serveur;
    if (Object.keys(reseau).length) specifications.reseau = reseau;
    if (Object.keys(backup).length) specifications.backup = backup;

    const payload: Changement = {
      clientId: raw.clientId,
      objetChangement: raw.objetChangement,
      descriptionDetaillee: raw.descriptionDetaillee,
      serviceEnvironnement: raw.serviceEnvironnement,
      categorie: raw.categorie,
      sousCategorie: raw.sousCategorie,
      fenetreIntervention: raw.fenetreIntervention,
      prerequisNecessaires: raw.prerequisNecessaires || undefined,
      planRetourArriere: raw.planRetourArriere,
      typeChangement: raw.typeChangement,
      specifications: Object.keys(specifications).length ? specifications : undefined,
    };

    this.loading = true;
    this.error = null;
    this.changementService.create(payload).subscribe({
      next: () => this.router.navigate(['/changements']),
      error: (err) => {
        this.error = err.error?.message || 'Erreur lors de la création du changement.';
        this.loading = false;
      },
    });
  }
}
