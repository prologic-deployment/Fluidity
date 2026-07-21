import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UploadService, UploadedFile } from '../../services/upload.service';

interface DropzoneItem {
  id: string;
  name: string;
  size: number;
  status: 'uploading' | 'done' | 'error';
  url?: string;
  errorMsg?: string;
}

/**
 * Dropzone générique et réutilisable (glisser-déposer + sélection de
 * fichiers), utilisée partout dans l'app où une pièce jointe est
 * nécessaire (Demandes, Changements...). Téléverse immédiatement les
 * fichiers déposés via UploadService et émet la liste courante des
 * fichiers effectivement envoyés (URLs) à chaque changement.
 */
@Component({
  selector: 'app-dropzone',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dropzone.component.html',
})
export class DropzoneComponent {
  @Input() accept = '';
  @Input() multiple = true;
  @Input() label = 'Glissez vos fichiers ici';
  @Input() hint = 'ou cliquez pour parcourir — 15 Mo max par fichier';
  @Input() initialFiles: UploadedFile[] = [];

  /** Émis à chaque changement, avec la liste des fichiers effectivement téléversés (statut "done"). */
  @Output() filesChange = new EventEmitter<UploadedFile[]>();

  items: DropzoneItem[] = [];
  isDragOver = false;

  constructor(private uploadService: UploadService) {}

  ngOnInit(): void {
    this.items = this.initialFiles.map((f) => ({
      id: this.generateId(),
      name: f.nom,
      size: f.taille,
      status: 'done',
      url: f.url,
    }));
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
    if (event.dataTransfer?.files?.length) {
      this.handleFiles(event.dataTransfer.files);
    }
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.handleFiles(input.files);
    }
    input.value = ''; // permet de resélectionner le même fichier
  }

  private handleFiles(fileList: FileList): void {
    const files = this.multiple ? Array.from(fileList) : [fileList[0]];
    const pending: DropzoneItem[] = files.map((f) => ({
      id: this.generateId(),
      name: f.name,
      size: f.size,
      status: 'uploading',
    }));
    this.items = this.multiple ? [...this.items, ...pending] : pending;

    this.uploadService.upload(files).subscribe({
      next: (uploaded) => {
        pending.forEach((item, i) => {
          item.status = 'done';
          item.url = uploaded[i]?.url;
        });
        this.emitCurrent();
      },
      error: () => {
        pending.forEach((item) => {
          item.status = 'error';
          item.errorMsg = "Échec de l'envoi";
        });
      },
    });
  }

  remove(id: string): void {
    this.items = this.items.filter((i) => i.id !== id);
    this.emitCurrent();
  }

  private emitCurrent(): void {
    const done = this.items.filter((i) => i.status === 'done' && i.url);
    this.filesChange.emit(done.map((i) => ({ url: i.url!, nom: i.name, taille: i.size, type: '' })));
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  }

  private generateId(): string {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}
