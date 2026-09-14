import { Component, ElementRef, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';

interface EmojiEntry {
  char: string;
  category: 'business' | 'tech' | 'people' | 'nature' | 'symbols';
  keywords: string;
}

/**
 * A5.1 — sélecteur d'emoji SANS dépendance (unicode natif, 100 % hors-ligne) :
 * catégories + recherche bilingue par mots-clés. Usage : [(value)]="form.emoji".
 * Le choix reste un simple caractère stocké tel quel (aucune librairie à charger).
 */
const EMOJIS: EmojiEntry[] = [
  { char: '📦', category: 'business', keywords: 'colis package box produit product' },
  { char: '📊', category: 'business', keywords: 'graphique chart stats pilotage dashboard' },
  { char: '📈', category: 'business', keywords: 'croissance growth hausse trend' },
  { char: '📉', category: 'business', keywords: 'baisse decline drop' },
  { char: '💼', category: 'business', keywords: 'mallette briefcase travail work business' },
  { char: '📋', category: 'business', keywords: 'presse-papiers clipboard liste list' },
  { char: '📌', category: 'business', keywords: 'punaise pin important' },
  { char: '📎', category: 'business', keywords: 'trombone attache clip' },
  { char: '📁', category: 'business', keywords: 'dossier folder fichier file' },
  { char: '📂', category: 'business', keywords: 'dossier ouvert folder open' },
  { char: '🗂️', category: 'business', keywords: 'classeur archive séparateurs divider' },
  { char: '🗄️', category: 'business', keywords: 'meuble tiroir archive drawer' },
  { char: '📅', category: 'business', keywords: 'calendrier calendar date planning' },
  { char: '⏰', category: 'business', keywords: 'réveil alarm alarme heure time' },
  { char: '💰', category: 'business', keywords: 'argent money finance sac bag' },
  { char: '💳', category: 'business', keywords: 'carte bancaire card paiement payment' },
  { char: '🧾', category: 'business', keywords: 'reçu facture receipt invoice' },
  { char: '📝', category: 'business', keywords: 'note mémo écrire write memo' },
  { char: '📢', category: 'business', keywords: 'annonce mégaphone announcement' },
  { char: '🎯', category: 'business', keywords: 'cible objectif target goal' },
  { char: '🏆', category: 'business', keywords: 'trophée victoire trophy win succès' },
  { char: '🤝', category: 'business', keywords: 'poignée main accord deal partenariat partner' },
  { char: '💻', category: 'tech', keywords: 'ordinateur portable laptop computer' },
  { char: '🖥️', category: 'tech', keywords: 'écran moniteur screen monitor desktop' },
  { char: '⌨️', category: 'tech', keywords: 'clavier keyboard' },
  { char: '📱', category: 'tech', keywords: 'téléphone mobile phone smartphone' },
  { char: '💾', category: 'tech', keywords: 'disquette sauvegarde save backup' },
  { char: '💿', category: 'tech', keywords: 'disque cd dvd disc' },
  { char: '📡', category: 'tech', keywords: 'antenne satellite signal réseau network' },
  { char: '🌐', category: 'tech', keywords: 'web internet monde world globe' },
  { char: '🔗', category: 'tech', keywords: 'lien link chaînon' },
  { char: '⚙️', category: 'tech', keywords: 'engrenage réglage settings paramètre parameter' },
  { char: '🛠️', category: 'tech', keywords: 'outils maintenance tools' },
  { char: '🔧', category: 'tech', keywords: 'clé réparation wrench fix' },
  { char: '🧪', category: 'tech', keywords: 'test éprouvette science lab' },
  { char: '🔬', category: 'tech', keywords: 'microscope analyse analysis' },
  { char: '🤖', category: 'tech', keywords: 'robot ia intelligence artificielle ai bot' },
  { char: '👾', category: 'tech', keywords: 'alien jeu game bug' },
  { char: '🔑', category: 'tech', keywords: 'clé accès key access' },
  { char: '🔒', category: 'tech', keywords: 'cadenas verrou lock sécurité security' },
  { char: '🔓', category: 'tech', keywords: 'déverrouillé unlock ouvert open' },
  { char: '☁️', category: 'tech', keywords: 'nuage cloud hébergement hosting' },
  { char: '👥', category: 'people', keywords: 'équipe groupe team group utilisateurs users' },
  { char: '🧑‍💼', category: 'people', keywords: 'employé cadre employee manager' },
  { char: '🧑‍💻', category: 'people', keywords: 'développeur developer dev code' },
  { char: '🧑‍🔧', category: 'people', keywords: 'technicien support technician' },
  { char: '👋', category: 'people', keywords: 'bonjour salut accueil hello welcome' },
  { char: '💬', category: 'people', keywords: 'discussion message chat commentaire comment' },
  { char: '🗣️', category: 'people', keywords: 'parler réunion speak meeting' },
  { char: '🧠', category: 'people', keywords: 'cerveau idée brain idea réflexion' },
  { char: '🎓', category: 'people', keywords: 'diplôme formation training education' },
  { char: '💡', category: 'people', keywords: 'idée astuce idea tip innovation' },
  { char: '🌱', category: 'nature', keywords: 'pousse démarrage growth start jeune' },
  { char: '🌿', category: 'nature', keywords: 'feuille plante leaf plant écologie eco' },
  { char: '🍀', category: 'nature', keywords: 'trèfle chance luck' },
  { char: '🌳', category: 'nature', keywords: 'arbre tree nature' },
  { char: '🌞', category: 'nature', keywords: 'soleil météo sun weather' },
  { char: '🌙', category: 'nature', keywords: 'lune nuit moon night' },
  { char: '⭐', category: 'nature', keywords: 'étoile favori star favorite' },
  { char: '✨', category: 'nature', keywords: 'étincelles nouveau new magic' },
  { char: '🔥', category: 'nature', keywords: 'feu urgent hot populaire popular' },
  { char: '💧', category: 'nature', keywords: 'goutte eau drop water' },
  { char: '✅', category: 'symbols', keywords: 'validé ok terminé done check succès success' },
  { char: '❌', category: 'symbols', keywords: 'non erreur error faux false cross' },
  { char: '⚠️', category: 'symbols', keywords: 'attention avertissement warning alerte alert' },
  { char: 'ℹ️', category: 'symbols', keywords: 'information info aide help' },
  { char: '❓', category: 'symbols', keywords: 'question aide help interrogation' },
  { char: '❗', category: 'symbols', keywords: 'exclamation important alerte alert' },
  { char: '⛔', category: 'symbols', keywords: 'interdit stop accès refusé denied' },
  { char: '🔔', category: 'symbols', keywords: 'cloche notification rappel bell reminder' },
  { char: '🎉', category: 'symbols', keywords: 'fête lancement party launch célébration' },
  { char: '❤️', category: 'symbols', keywords: 'cœur amour heart love favori' },
  { char: '🔴', category: 'symbols', keywords: 'rouge red critique critical rond circle' },
  { char: '🟢', category: 'symbols', keywords: 'vert green ok valide valid rond circle' },
  { char: '🟡', category: 'symbols', keywords: 'jaune yellow attente pending rond circle' },
  { char: '🔵', category: 'symbols', keywords: 'bleu blue info rond circle' },
  { char: '➕', category: 'symbols', keywords: 'plus ajouter add nouveau new' },
  { char: '➡️', category: 'symbols', keywords: 'flèche droite suivre next arrow right' },
];

@Component({
  selector: 'app-emoji-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, ...I18N_IMPORTS],
  template: `
    <div class="relative inline-block">
      <button
        type="button"
        class="input flex items-center justify-center !w-14 text-xl"
        (click)="toggle($event)"
        [title]="'emoji.pick' | t"
        [attr.aria-label]="'emoji.pick' | t"
      >
        {{ value || '📦' }}
      </button>
      <div *ngIf="open" class="card absolute left-0 top-full z-50 mt-1 w-72 p-2 shadow-xl">
        <div class="flex gap-1 mb-2 flex-wrap">
          <button
            *ngFor="let c of categories"
            type="button"
            class="btn-ghost btn-sm !px-2 !py-0.5 !text-xs"
            [class.!bg-primary]="category === c"
            [class.!text-primary-foreground]="category === c"
            (click)="category = c"
          >
            {{ 'emoji.categories.' + c | t }}
          </button>
        </div>
        <input
          type="search"
          class="input !py-1.5 !text-xs mb-2"
          [(ngModel)]="query"
          [attr.placeholder]="'emoji.search' | t"
        />
        <div class="grid grid-cols-8 gap-0.5 max-h-44 overflow-y-auto">
          <button
            *ngFor="let e of filtered()"
            type="button"
            class="rounded-md p-1 text-lg leading-none hover:bg-muted"
            (click)="pick(e.char)"
          >
            {{ e.char }}
          </button>
        </div>
        <p *ngIf="!filtered().length" class="text-xs text-muted-foreground py-3 text-center">{{ 'emoji.empty' | t }}</p>
      </div>
    </div>
  `,
})
export class EmojiPickerComponent {
  @Input() value = '';
  @Output() valueChange = new EventEmitter<string>();

  open = false;
  query = '';
  category: 'all' | EmojiEntry['category'] = 'all';
  readonly categories: ('all' | EmojiEntry['category'])[] = ['all', 'business', 'tech', 'people', 'nature', 'symbols'];

  constructor(private host: ElementRef) {}

  toggle(event: Event): void {
    event.stopPropagation();
    this.open = !this.open;
    if (this.open) this.query = '';
  }

  pick(char: string): void {
    this.value = char;
    this.valueChange.emit(char);
    this.open = false;
  }

  filtered(): EmojiEntry[] {
    const q = this.query.trim().toLowerCase();
    return EMOJIS.filter(
      (e) => (this.category === 'all' || e.category === this.category) && (!q || e.keywords.includes(q))
    );
  }

  /** Clic hors du panneau ou Échap → fermeture (accessibilité clavier). */
  @HostListener('document:click', ['$event'])
  onOutsideClick(event: Event): void {
    if (this.open && !this.host.nativeElement.contains(event.target)) this.open = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.open = false;
  }
}
