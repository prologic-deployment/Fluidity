import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ChangementService } from '../../services/changement.service';
import { Changement } from '../../models/changement.model';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-dashboard-changements',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard-changements.component.html',
})
export class DashboardChangementsComponent implements OnInit {
  changements: Changement[] = [];
  loading = false;
  error: string | null = null;
  active = 'changements';

  constructor(
    private changementService: ChangementService,
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;
    this.changementService.getAll().subscribe({
      next: (data) => {
        this.changements = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Erreur de chargement des changements.';
        this.loading = false;
      },
    });
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  deleteChangement(id: string | undefined): void {
    if (!id) return;
    if (!confirm('Confirmer la suppression de ce changement ?')) return;
    this.changementService.delete(id).subscribe({
      next: () => this.load(),
      error: (err) => (this.error = err.error?.message || 'Échec de la suppression.'),
    });
  }

  statutClass(statut?: string): string {
    switch (statut) {
      case 'Soumis':
        return 'bg-blue-100 text-blue-700';
      case 'En revue':
        return 'bg-indigo-100 text-indigo-700';
      case 'Approuvé':
        return 'bg-green-100 text-green-700';
      case 'Rejeté':
        return 'bg-red-100 text-red-700';
      case 'En cours':
        return 'bg-amber-100 text-amber-700';
      case 'Clôturé':
        return 'bg-slate-200 text-slate-600';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  }

  typeClass(type?: string): string {
    switch (type) {
      case 'Urgent':
        return 'bg-red-100 text-red-700';
      case 'Majeur':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  }
}
