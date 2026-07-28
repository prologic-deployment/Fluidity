import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TenantService } from '../../services/tenant.service';
import { TENANT_TYPES, TENANT_PLANS, Tenant } from '../../models/tenant.model';

@Component({
  selector: 'app-create-tenant',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './create-tenant.component.html',
})
export class CreateTenantComponent implements OnInit {
  form!: FormGroup;
  types = TENANT_TYPES;
  plans = TENANT_PLANS;
  loading = false;
  error: string | null = null;

  constructor(
    private fb: FormBuilder,
    private tenantService: TenantService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      name: ['', Validators.required],
      slug: [''],
      type: ['Company', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      address: [''],
      website: [''],
      plan: ['Free', Validators.required],
      maxUsers: [5, [Validators.required, Validators.min(1)]],
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.value;
    const payload: Tenant = {
      name: raw.name,
      slug: raw.slug || undefined,
      type: raw.type,
      email: raw.email,
      phone: raw.phone || undefined,
      address: raw.address || undefined,
      website: raw.website || undefined,
      plan: raw.plan,
      maxUsers: raw.maxUsers,
    };

    this.loading = true;
    this.error = null;
    this.tenantService.create(payload).subscribe({
      next: () => this.router.navigate(['/plateforme/tenants']),
      error: (err) => {
        this.error = err.error?.message || 'Erreur lors de la création du tenant.';
        this.loading = false;
      },
    });
  }
}
