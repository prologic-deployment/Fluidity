import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Subject, switchMap, takeUntil } from 'rxjs';
import { ProjectService } from '../../services/project.service';
import { UploadService } from '../../services/upload.service';
import { ToastService } from '../../services/toast.service';
import { I18nService } from '../../i18n/i18n.service';
import { ProjectFile } from '../../models/project.model';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { UrlUploadPipe } from '../../pipes/upload-url.pipe';
import { FILE_FOLDERS } from './project.constants';

/**
 * Fichiers du projet (route /projets/:id/fichiers) : navigation par dossier
 * (Documents / Tasks / Milestones / Attachments), téléversement organisé
 * uploads/tenants/<tenant>/projects/<code>/<dossier>/, suppression.
 */
@Component({
  selector: 'app-project-files',
  standalone: true,
  imports: [CommonModule, UrlUploadPipe, ...I18N_IMPORTS],
  templateUrl: './project-files.component.html',
})
export class ProjectFilesComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  projectId = '';
  projectCode = '';
  files: ProjectFile[] = [];
  folders: string[] = [...FILE_FOLDERS];
  folder = '';
  uploading = false;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private api: ProjectService,
    private uploads: UploadService,
    private toast: ToastService,
    private i18n: I18nService,
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
          this.projectCode = r.project?.code || '';
          this.refresh();
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

  refresh(): void {
    this.api.files(this.projectId, this.folder || undefined).subscribe({
      next: (r) => {
        this.files = r.files;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.error = 'projects.errors.load';
        this.loading = false;
      },
    });
  }

  selectFolder(f: string): void {
    this.folder = this.folder === f ? '' : f;
    this.refresh();
  }

  onFilesPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    if (!files.length) return;
    this.uploading = true;
    const folder = this.folder || 'Documents';
    const subpath = this.projectCode ? `${this.projectCode}/${folder}` : folder;
    this.uploads.upload(files, 'projects', subpath).subscribe({
      next: (uploaded) => {
        let remaining = uploaded.length;
        for (const u of uploaded) {
          this.api
            .registerFile(this.projectId, { folder, name: u.nom, url: u.url, size: u.taille, type: u.type })
            .subscribe({
              next: () => {
                remaining -= 1;
                if (remaining <= 0) {
                  this.uploading = false;
                  this.refresh();
                  this.toast.success(this.i18n.t('projects.files.uploaded'));
                }
              },
              error: () => {
                this.uploading = false;
                this.toast.error(this.i18n.t('projects.errors.upload'));
              },
            });
        }
      },
      error: () => {
        this.uploading = false;
        this.toast.error(this.i18n.t('projects.errors.upload'));
      },
    });
    input.value = '';
  }

  remove(f: ProjectFile): void {
    this.api.deleteFile(this.projectId, f._id).subscribe({
      next: () => {
        this.refresh();
        this.toast.success(this.i18n.t('projects.files.deleted'));
      },
      error: () => this.toast.error(this.i18n.t('projects.errors.save')),
    });
  }

  sizeOf(bytes: number): string {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
    return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  }

  trackF(_i: number, f: ProjectFile): string {
    return f._id;
  }

  uploadedByName(f: ProjectFile): string {
    const u = f.uploadedBy as { firstName?: string; lastName?: string } | undefined;
    return u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : '';
  }
}
