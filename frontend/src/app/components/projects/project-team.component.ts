import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subject, switchMap, takeUntil } from 'rxjs';
import { ProjectService } from '../../services/project.service';
import { ProjectCapabilitiesService, hasProjectPermission } from '../../services/project-capabilities.service';
import { ProjectMember, WorkloadRow, ProjectCapabilities } from '../../models/project.model';
import { ToastService } from '../../services/toast.service';
import { I18nService } from '../../i18n/i18n.service';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { UrlUploadPipe } from '../../pipes/upload-url.pipe';
import { PROJECT_MEMBER_ROLES } from './project.constants';
import { apiErrorMessage } from '../../utils/api-error.util';

interface AvailableUser {
  _id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string | null;
  jobTitle?: string;
  status?: string;
  isMember?: boolean;
  hasLicense?: boolean;
}

/**
 * Équipe projet (route /projets/:id/equipe) : membres + rôles projet, charge
 * de travail (barres d'utilisation : sous-utilisé / normal / élevé /
 * surchargé), ajout/retrait — réservé aux gestionnaires.
 */
@Component({
  selector: 'app-project-team',
  standalone: true,
  imports: [CommonModule, FormsModule, UrlUploadPipe, ...I18N_IMPORTS],
  templateUrl: './project-team.component.html',
})
export class ProjectTeamComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  projectId = '';
  members: ProjectMember[] = [];
  workload: WorkloadRow[] = [];
  roles = PROJECT_MEMBER_ROLES;
  readonly Math = Math;
  caps: ProjectCapabilities | null = null;
  adding = false;
  candidates: AvailableUser[] = [];
  candidateQuery = '';
  candidateLoading = false;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private api: ProjectService,
    private toast: ToastService,
    private i18n: I18nService,
    private capsApi: ProjectCapabilitiesService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.parent?.params
      .pipe(
        takeUntil(this.destroy$),
        switchMap((p) => {
          this.projectId = p['id'];
          return this.api.get(p['id']);
        })
      )
      .subscribe({
        next: (r) => {
          this.capsApi
            .forProject(this.projectId)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (caps) => {
                this.caps = caps;
                this.cdr.markForCheck();
              },
            });
          this.refresh();
        },
        error: () => {
          this.error = 'projects.errors.load';
          this.loading = false;
        },
      });
  }

  /** Membres : `member.manage` + rang 5, comme le serveur. */
  get canManage(): boolean {
    return hasProjectPermission(this.caps, 'project.member.manage') && !!this.caps?.can.manageMembers;
  }

  /** Rôles attribuables : plafond au rang courant (Fix 14), rangs fournis par le serveur. */
  grantableRoles(): string[] {
    const rank = this.caps?.rank ?? 0;
    const ranks = this.caps?.ranks || {};
    return this.roles.filter((r) => (ranks[r] ?? 99) <= rank);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  refresh(): void {
    this.api.members(this.projectId).subscribe({
      next: (m) => {
        this.members = m.members;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.error = 'projects.errors.load';
        this.loading = false;
      },
    });
    // Charge de travail (agrégat serveur).
    this.api.projectDashboard(this.projectId).subscribe({
      next: (d) => {
        this.workload = d.workload;
        this.cdr.markForCheck();
      },
      error: () => undefined,
    });
  }

  toggleAdding(): void {
    this.adding = !this.adding;
    if (this.adding) this.searchCandidates('');
  }

  searchCandidates(q: string): void {
    this.candidateQuery = q;
    this.candidateLoading = true;
    this.api
      .availableUsers(this.projectId, q)
      .subscribe({
        next: (r) => {
          this.candidates = r.users;
          this.candidateLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.candidateLoading = false;
        },
      });
  }

  addUser(u: AvailableUser): void {
    this.api.addMember(this.projectId, u._id, 'project_member').subscribe({
      next: () => {
        this.adding = false;
        this.refresh();
        this.toast.success(this.i18n.t('projects.team.added'));
      },
      error: (err) => this.toast.error(apiErrorMessage(this.i18n, err, 'projects.errors.save')),
    });
  }

  changeRole(m: ProjectMember, roleKey: string): void {
    this.api.updateMemberRole(this.projectId, this.memberId(m), roleKey).subscribe({
      next: () => this.refresh(),
      error: (err) => this.toast.error(apiErrorMessage(this.i18n, err, 'projects.errors.save')),
    });
  }

  remove(m: ProjectMember): void {
    this.api.removeMember(this.projectId, this.memberId(m)).subscribe({
      next: () => {
        this.refresh();
        this.toast.success(this.i18n.t('projects.team.removed'));
      },
      error: (err) => this.toast.error(apiErrorMessage(this.i18n, err, 'projects.errors.save')),
    });
  }

  memberId(m: ProjectMember): string {
    return typeof m.userId === 'object' ? m.userId?._id || '' : m.userId;
  }

  member(m: ProjectMember): { name: string; email?: string; avatarUrl?: string | null; jobTitle?: string } | null {
    const u = typeof m.userId === 'object' ? m.userId : null;
    if (!u) return null;
    return {
      name: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
      email: u.email,
      avatarUrl: u.avatarUrl,
      jobTitle: u.jobTitle,
    };
  }

  initials(m: ProjectMember): string {
    const name = this.member(m)?.name || '?';
    return name.split(/\s+/).map((w) => w.charAt(0)).slice(0, 2).join('').toUpperCase();
  }

  loadOf(m: ProjectMember): WorkloadRow | null {
    return this.workload.find((w) => w.userId === this.memberId(m)) || null;
  }

  levelOf(w: WorkloadRow): 'low' | 'normal' | 'high' | 'over' {
    if (w.overdue >= 3 || w.tasks >= 8) return 'over';
    if (w.overdue >= 1 || w.tasks >= 5) return 'high';
    if (w.tasks <= 1 && !w.overdue) return 'low';
    return 'normal';
  }

  levelBadge(level: string): string {
    return { low: 'badge-outline', normal: 'badge-success', high: 'badge-warning', over: 'badge-destructive' }[level] || 'badge-outline';
  }

  trackM(_i: number, m: ProjectMember): string {
    return m._id;
  }
}
