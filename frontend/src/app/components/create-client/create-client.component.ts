import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ClientService, IdentifiantsPortail } from '../../services/client.service';
import { STATUTS_CLIENT, Client } from '../../models/client.model';
import { CredentialsModalComponent } from '../shared/credentials-modal.component';
import { I18nService } from '../../i18n/i18n.service';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { apiErrorMessage } from '../../utils/api-error.util';

@Component({
  selector: 'app-create-client',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, CredentialsModalComponent, ...I18N_IMPORTS],
  templateUrl: './create-client.component.html',
})
export class CreateClientComponent implements OnInit {
  form!: FormGroup;
  statuts = STATUTS_CLIENT;
  loading = false;
  error: string | null = null;
  /** Identifiants émis à la création — affichés une seule fois dans la modale. */
  identifiants: IdentifiantsPortail | null = null;

  constructor(
    private fb: FormBuilder,
    private clientService: ClientService,
    private router: Router,
    private i18n: I18nService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      nom: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      telephone: [''],
      adresse: [''],
      statut: ['Actif', Validators.required],
      notes: [''],
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.value;
    const payload: Client = {
      nom: raw.nom,
      email: raw.email,
      telephone: raw.telephone || undefined,
      adresse: raw.adresse || undefined,
      statut: raw.statut,
      notes: raw.notes || undefined,
    };

    this.loading = true;
    this.error = null;
    this.clientService.create(payload).subscribe({
      next: (cree) => {
        this.loading = false;
        // Identifiants affichés UNE SEULE FOIS avant de quitter l'écran —
        // la fermeture de la modale acte la prise de note puis redirige.
        this.identifiants = cree.identifiants || null;
        if (!this.identifiants) this.router.navigate(['/clients']);
      },
      error: (err) => {
        this.error = apiErrorMessage(this.i18n, err, 'clients.createError');
        this.loading = false;
      },
    });
  }

  /** Fermeture de la modale d'identifiants -> retour à la liste des clients. */
  fermerIdentifiants(): void {
    this.identifiants = null;
    this.router.navigate(['/clients']);
  }
}
