import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { ProjectService } from '../../services/project.service';
import { ToastService } from '../../services/toast.service';
import { UserService } from '../../services/user.service';
import { AppUser } from '../../models/user.model';
import { Methodology, Priority, ProjectRoleKey, ProjectStatus } from '../../models/project.model';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { I18nService } from '../../i18n/i18n.service';
import { METHODOLOGIES, PRIORITIES, PROJECT_MEMBER_ROLES, PROJECT_STATUSES } from './project.constants';

interface TeamPick {
  userId: string;
  roleKey: ProjectRoleKey;
}

/**
 * Assistant de création de projet : identité, équipe, planification,
 * méthodologie & budget. La référence (PRJ-AAAA-NNNN) est générée côté
 * SERVEUR — elle est affichée à titre indicatif avant soumission.
 */
@Component({
  selector: 'app-project-new',
  standalone: true,
  imports: [CommonModule, FormsModule, ...I18N_IMPORTS],
  templateUrl: './project-new.component.html',
})
export class ProjectNewComponent implements OnInit, OnDestroy {
  step = 1;

  // Étape 1 — identité
  name = '';
  description = '';
  stakeholder = '';
  tagsInput = '';
  tags: string[] = [];

  // Étape 2 — équipe
  users: AppUser[] = [];
  usersLoading = false;
  managerId = '';
  team: TeamPick[] = [];
  teamQuery = '';

  // Étape 3 — planification
  startDate = '';
  endDate = '';
  methodology: Methodology = 'kanban';
  status: ProjectStatus = 'planning';
  priority: Priority = 'medium';
  visibility: 'private' | 'team' | 'tenant' = 'team';
  budgetEnabled = false;
  budgetAmount = 0;

  submitting = false;
  error = '';

  readonly methodologies = METHODOLOGIES;
  readonly priorities = PRIORITIES;
  readonly statuses = PROJECT_STATUSES;
  readonly memberRoles = PROJECT_MEMBER_ROLES;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private api: ProjectService,
    private usersApi: UserService,
    private toast: ToastService,
    private i18n: I18nService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadUsers('');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get canNextStep(): boolean {
    if (this.step === 1) return !!this.name.trim();
    return true;
  }

  loadUsers(q: string): void {
    this.usersLoading = true;
    this.usersApi
      .getAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (users) => {
          this.users = users.filter((u) => u.status !== 'suspended');
          this.usersLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.usersLoading = false;
        },
      });
  }

  get filteredUsers(): AppUser[] {
    const q = this.teamQuery.trim().toLowerCase();
    const base = this.users.filter((u) => !this.team.some((t) => t.userId === u._id) && u._id !== this.managerId);
    if (q.length < 2) return base.slice(0, 8);
    return base.filter((u) => `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(q)).slice(0, 8);
  }

  fullName(u: AppUser): string {
    return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
  }

  userName(userId: string): string {
    const u = this.users.find((x) => x._id === userId);
    return u ? this.fullName(u) : userId;
  }

  get currentYear(): number {
    return new Date().getFullYear();
  }

  addTeamMember(u: AppUser): void {
    if (!u._id) return;
    this.team.push({ userId: u._id, roleKey: 'project_member' });
    this.teamQuery = '';
  }

  removeTeamMember(userId: string): void {
    this.team = this.team.filter((t) => t.userId !== userId);
  }

  addTag(): void {
    const tag = this.tagsInput.trim();
    if (tag && !this.tags.includes(tag)) {
      this.tags.push(tag.slice(0, 30));
      this.tagsInput = '';
    }
  }

  removeTag(tag: string): void {
    this.tags = this.tags.filter((t) => t !== tag);
  }

  next(): void {
    if (this.step < 3) this.step += 1;
  }

  back(): void {
    if (this.step > 1) this.step -= 1;
  }

  submit(): void {
    if (!this.name.trim()) return;
    this.submitting = true;
    this.error = '';
    this.api
      .create({
        name: this.name,
        description: this.description,
        stakeholder: this.stakeholder,
        tags: this.tags,
        managerId: this.managerId || null,
        methodology: this.methodology,
        status: this.status,
        priority: this.priority,
        visibility: this.visibility,
        startDate: this.startDate || null,
        endDate: this.endDate || null,
        budget: { enabled: this.budgetEnabled, amount: this.budgetAmount || 0, currency: 'EUR' },
        teamMembers: this.team,
      })
      .subscribe({
        next: (r) => {
          this.toast.success(this.i18n.t('projects.new.created', { code: r.project.code }));
          this.router.navigate(['/projets', r.project._id]);
        },
        error: (err) => {
          this.error = err?.error?.message || 'projects.errors.create';
          this.submitting = false;
        },
      });
  }

  trackUser(_i: number, u: AppUser): string {
    return u._id || u.email;
  }
}
