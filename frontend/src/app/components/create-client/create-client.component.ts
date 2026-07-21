import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ClientService } from '../../services/client.service';
import { STATUTS_CLIENT, Client } from '../../models/client.model';

@Component({
  selector: 'app-create-client',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './create-client.component.html',
})
export class CreateClientComponent implements OnInit {
  form!: FormGroup;
  statuts = STATUTS_CLIENT;
  loading = false;
  error: string | null = null;

  constructor(
    private fb: FormBuilder,
    private clientService: ClientService,
    private router: Router
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
      next: () => this.router.navigate(['/clients']),
      error: (err) => {
        this.error = err.error?.message || 'Erreur lors de la création du client.';
        this.loading = false;
      },
    });
  }
}
