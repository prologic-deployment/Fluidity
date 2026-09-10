import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Subject, switchMap, takeUntil } from 'rxjs';
import { ProjectService } from '../../services/project.service';
import { ReportsData } from '../../models/project.model';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { ProjectStatePipe } from './project.pipes';
import { HEALTH_BADGE, SEVERITY_BADGE } from './project.constants';

/**
 * Rapports du projet (route /projets/:id/rapports) : progression,
 * complétion, retards, charge, jalons, santé, vélocité des sprints et
 * matrice de risques — avec export (impression / CSV pour les listes).
 */
@Component({
  selector: 'app-project-reports',
  standalone: true,
  imports: [CommonModule, ProjectStatePipe, ...I18N_IMPORTS],
  templateUrl: './project-reports.component.html',
})
export class ProjectReportsComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  projectId = '';
  data: ReportsData | null = null;
  healthBadge = HEALTH_BADGE;
  severityBadge = SEVERITY_BADGE;

  private readonly destroy$ = new Subject<void>();

  constructor(private route: ActivatedRoute, private api: ProjectService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.route.parent?.params
      .pipe(
        takeUntil(this.destroy$),
        switchMap((p) => {
          this.projectId = p['id'];
          return this.api.reports(p['id']);
        })
      )
      .subscribe({
        next: (d) => {
          this.data = d;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.error = 'projects.errors.load';
          this.loading = false;
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Export CSV (tâches agrégées par statut — la liste détaillée est exportable à la demande). */
  exportStatusCsv(): void {
    if (!this.data) return;
    const rows = Object.entries(this.data.taskStats.byStatus || {});
    const lines = [['projects.reports.statusHeader', 'projects.reports.countHeader']];
    rows.forEach(([k, v]) => lines.push([k, String(v)]));
    const csv = lines.map((r) => r.join(';')).join('\n');
    this.download(`${this.projectId}-statuts.csv`, csv);
  }

  exportRisksCsv(): void {
    if (!this.data) return;
    const lines = [['Title', 'Severity', 'Probability', 'Impact', 'Status', 'Owner'].join(';')];
    for (const r of this.data.risks) {
      lines.push([r.title, r.severity, r.probability, r.impact, r.status, ''].join(';'));
    }
    this.download(`${this.projectId}-risques.csv`, lines.join('\n'));
  }

  private download(name: string, content: string): void {
    const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  printReport(): void {
    window.print();
  }

  /** Lignes de répartition par statut (labels résolus par le pipe t dans le template). */
  get statusRows(): { label: string; count: number; ratio: number }[] {
    const by = this.data?.taskStats.byStatus || {};
    const total = this.data?.taskStats.total || 1;
    return Object.entries(by)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({ label: k, count: v, ratio: Math.round((v / total) * 100) }));
  }

  milestoneBadge(status: string): string {
    return {
      not_started: 'badge-outline',
      in_progress: 'badge-secondary',
      completed: 'badge-success',
      delayed: 'badge-destructive',
    }[status] || 'badge-outline';
  }
}
