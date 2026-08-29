import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Bookly brand mark — a rounded calendar tile with an emerald checkmark.
 * Reusable inline SVG used in the login header and anywhere the brand
 * needs to be represented.
 */
@Component({
  selector: 'app-brand-logo',
  standalone: true,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Bookly"
    >
      <defs>
        <linearGradient id="booklyTileBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#0a2a1f" />
          <stop offset="1" stop-color="#06110e" />
        </linearGradient>
        <linearGradient id="booklyCheck" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#34d399" />
          <stop offset="1" stop-color="#10b981" />
        </linearGradient>
      </defs>
      <rect x="3" y="3" width="58" height="58" rx="15" fill="url(#booklyTileBg)" stroke="rgba(52,211,153,0.28)" stroke-width="1.5" />
      <rect x="18" y="12" width="12" height="5" rx="2.5" fill="rgba(52,211,153,0.45)" />
      <rect x="34" y="12" width="12" height="5" rx="2.5" fill="rgba(52,211,153,0.45)" />
      <line x1="13" y1="24" x2="51" y2="24" stroke="rgba(52,211,153,0.2)" stroke-width="1.5" />
      <path d="M21 41 L28.5 48.5 L43 31" fill="none" stroke="url(#booklyCheck)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      vertical-align: middle;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrandLogoComponent {
  readonly size = input<number>(64);
}
