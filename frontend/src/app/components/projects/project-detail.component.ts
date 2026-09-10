import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Subject, switchMap, takeUntil } from 'rxjs';
import { ProjectService } from '../../services/project.service';
import { Project, ProjectDetailResponse } from '../../models/project.model';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { BreadcrumbService } from '../shared/breadcrumb.service';
import { UrlUploadPipe } from '../../pipes/upload-url.pipe';
import { HEALTH_BADGE } from './project.constants';

interface Tab {
  path: string;
  labelKey: string;
  exact: boolean;
  show: boolean;
}

/**
 * Coquille d'un projet (route /projets/:id) : en-tête d'espace de travail
 * (statut, progression, échéance, responsable, équipe, santé) + onglets +
 * sous-routes. Enregistre un libellé de fil d'Ariane LISIBLE (jamais
 * d'ObjectId brut).
 */
@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet, UrlUploadPipe, ...I18N_IMPORTS],
  templateUrl: './project-detail.component.html',
})
export class ProjectDetailComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  data: ProjectDetailResponse | null = null;
  project: Project | null = null;
  healthBadge = HEALTH_BADGE;
  taskStats: { total: number; progress: number; overdue: number; blocked: number; open: number; completed: number } | null = null;

  tabs: Tab[] = [];

  private readonly destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ProjectService,
    private breadcrumbs: BreadcrumbService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.params
      .pipe(
        takeUntil(this.destroy$),
        switchMap((p) => {
          this.loading = true;
          this.error = '';
          return this.api.get(p['id']);
        })
      )
      .subscribe({
        next: (r) => {
          this.data = r;
          this.project = r.project;
          this.taskStats = r.taskStats || null;
          this.buildTabs(r.project);
          // Fil d'Ariane lisible : « Refonte Portail Client » au lieu de l'ObjectId.
          this.breadcrumbs.setLabel(`/projets/${r.project._id}`, r.project.code);
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = err?.status === 404 ? 'projects.errors.notFound' : 'projects.errors.load';
          this.loading = false;
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.project) this.breadcrumbs.clearLabel(`/projets/${this.project._id}`);
  }

  private buildTabs(p: Project): void {
    const base = `/projets/${p._id}`;
    const scrum = p.methodology === 'scrum' || p.methodology === 'hybrid';
    const waterfall = p.methodology === 'waterfall' || p.methodology === 'hybrid';
    this.tabs = [
      { path: base, labelKey: 'projects.tabs.overview', exact: true, show: true },
      { path: `${base}/taches`, labelKey: 'projects.tabs.tasks', exact: false, show: true },
      { path: `${base}/board`, labelKey: 'projects.tabs.board', exact: false, show: true },
      { path: `${base}/sprints`, labelKey: 'projects.tabs.sprints', exact: false, show: scrum },
      { path: `${base}/backlog`, labelKey: 'projects.tabs.backlog', exact: false, show: scrum },
      { path: `${base}/planning`, labelKey: 'projects.tabs.planning', exact: false, show: true },
      { path: `${base}/temps`, labelKey: 'projects.tabs.time', exact: false, show: true },
      { path: `${base}/livrables`, labelKey: 'projects.tabs.deliverables', exact: false, show: true },
      { path: `${base}/reunions`, labelKey: 'projects.tabs.events', exact: false, show: true },
      { path: `${base}/jalons`, labelKey: 'projects.tabs.milestones', exact: false, show: true },
      { path: `${base}/equipe`, labelKey: 'projects.tabs.team', exact: false, show: true },
      { path: `${base}/fichiers`, labelKey: 'projects.tabs.files', exact: false, show: true },
      { path: `${base}/activite`, labelKey: 'projects.tabs.activity', exact: false, show: true },
      { path: `${base}/risques`, labelKey: 'projects.tabs.risks', exact: false, show: true },
      { path: `${base}/problemes`, labelKey: 'projects.tabs.issues', exact: false, show: true },
      { path: `${base}/calendrier`, labelKey: 'projects.tabs.calendar', exact: false, show: true },
      { path: `${base}/rapports`, labelKey: 'projects.tabs.reports', exact: false, show: true },
      { path: `${base}/parametres`, labelKey: 'projects.tabs.settings', exact: false, show: true },
    ];
  }

  /** Les sous-onglets planification (Waterfall) restent couverts par Jalons (phases). */
  get isWaterfallish(): boolean {
    return this.project?.methodology === 'waterfall' || this.project?.methodology === 'hybrid';
  }

  get progress(): number | null {
    return this.taskStats ? this.taskStats.progress : null;
  }

  isPast(date: string | null): boolean {
    if (!date) return false;
    return new Date(date).getTime() < Date.now() - 86400000;
  }

  initials(name?: string): string {
    const n = (name || '?').trim();
    return n
      .split(/\s+/)
      .map((w) => w.charAt(0))
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  get teamList(): { name: string; avatarUrl: string | null; id: string }[] {
    return (this.data?.members || []).slice(0, 8).map((m) => {
      const u = typeof m.userId === 'object' ? m.userId : null;
      const name = u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : '';
      return { name: name || '?', avatarUrl: u?.avatarUrl || null, id: typeof m.userId === 'string' ? m.userId : m.userId?._id || '' };
    });
  }

  goBack(): void {
    this.router.navigate(['/projets']);
  }
}
