import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ContratService } from '../../services/contrat.service';
import { STATUTS_CONTRAT, TYPES_CONTRAT, Contrat } from '../../models/contrat.model';

@Component({
  selector: 'app-create-contrat',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './create-contrat.component.html',
})
export class CreateContratComponent implements OnInit {
  form!: FormGroup;
  statuts = STATUTS_CONTRAT;
  types = TYPES_CONTRAT;
  loading = false;
  error: string | null = null;

  constructor(
    private fb: FormBuilder,
    private contratService: ContratService,
    private router: Router
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
        this.error = err.error?.message || "Erreur lors de l'ouverture du contrat.";
        this.loading = false;
      },
    });
  }
}
