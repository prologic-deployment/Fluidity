import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ContratService } from '../../services/contrat.service';
import { ClientService } from '../../services/client.service';
import { STATUTS_CONTRAT, TYPES_CONTRAT, Contrat } from '../../models/contrat.model';
import { Client } from '../../models/client.model';
import { I18nService } from '../../i18n/i18n.service';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { apiErrorMessage } from '../../utils/api-error.util';

@Component({
  selector: 'app-create-contrat',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ...I18N_IMPORTS],
  templateUrl: './create-contrat.component.html',
})
export class CreateContratComponent implements OnInit {
  form!: FormGroup;
  statuts = STATUTS_CONTRAT;
  types = TYPES_CONTRAT;
  clients: Client[] = [];
  loading = false;
  error: string | null = null;

  constructor(
    private fb: FormBuilder,
    private contratService: ContratService,
    private clientService: ClientService,
    private router: Router,
    private i18n: I18nService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      clientId: ['', Validators.required],
      reference: ['', Validators.required],
      intitule: ['', Validators.required],
      typeContrat: ['Support', Validators.required],
      statut: ['Actif', Validators.required],
      dateDebut: ['', Validators.required],
      dateFin: [''],
      description: [''],
    });

    this.clientService.getAll().subscribe({
      next: (data) => (this.clients = data),
      error: () => (this.clients = []),
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.value;
    const payload: Contrat = {
      clientId: raw.clientId,
      reference: raw.reference,
      intitule: raw.intitule,
      typeContrat: raw.typeContrat,
      statut: raw.statut,
      dateDebut: raw.dateDebut,
      dateFin: raw.dateFin || undefined,
      description: raw.description || undefined,
    };

    this.loading = true;
    this.error = null;
    this.contratService.create(payload).subscribe({
      next: () => this.router.navigate(['/contrats']),
      error: (err) => {
        this.error = apiErrorMessage(this.i18n, err, 'contracts.createError');
        this.loading = false;
      },
    });
  }
}
