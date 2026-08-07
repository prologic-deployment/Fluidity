import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modal.component.html',
})
export class ModalComponent {
  @Input() open = false;
  @Input() title = '';
  @Input() subtitle = '';
  /**
   * Largeur de la boîte : 'md' (défaut, dialogues de confirmation) ou 'xl'
   * (fiches de détail riches). La hauteur reste bornée (85vh) avec défilement
   * interne ; sur mobile la modale occupe toujours la largeur disponible.
   */
  @Input() size: 'md' | 'xl' = 'md';
  @Output() closed = new EventEmitter<void>();

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.open) this.close();
  }

  close(): void {
    this.closed.emit();
  }
}
