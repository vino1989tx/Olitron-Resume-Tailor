import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  effect,
  ElementRef,
  HostListener,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../environments/environment.generated';
import { emptyResumeData, ResumeData, withHeaderExtras } from './data/resume-data';
import { applyGlobalChanges, tailorBullets } from './services/ai-client';
import { exportElementToPdf } from './services/pdf-export';
import {
  getAllScopes,
  getScopeBullets,
  getScopeLabel,
  ResumeScope,
  setScopeBullets,
  SUMMARY_SCOPE_ID,
} from './services/scopes';
import { exportResumeToDocx } from './services/word-export';
import { ResumeUploadComponent } from './components/resume-upload.component';
import { ResumeHistoryComponent } from './components/resume-history.component';
import { ResumeStorageService } from './services/resume-storage.service';
import { AuthService } from './services/auth.service';

const CURRENT_RESUME_KEY_STORAGE = 'resume-tailor-current-key';
const HEADER_COLOR_STORAGE = 'resume-tailor-header-color';
const THEME_STORAGE = 'resume-tailor-theme';
const DEFAULT_HEADER_COLOR = '#1f4e78';

type RequestStatus = 'idle' | 'loading' | 'success' | 'error';
type Theme = 'light' | 'dark';
type ResumePath = Array<string | number>;

function cloneResume(resume: ResumeData): ResumeData {
  return structuredClone(resume);
}

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, ResumeUploadComponent, ResumeHistoryComponent],
  templateUrl: './app.component.html',
  styleUrls: [
    './app.component.css',
    './styles/header-editor.css',
    './styles/job-role-editor.css',
    './styles/tailor-panel.css',
    './styles/resume-preview.css',
  ],
})
export class AppComponent implements OnInit {
  // Zoneless app: state lives in signals so the view updates without zone.js.
  // ChangeDetectorRef is retained only for the preview destroy/recreate trick.
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly storageService = inject(ResumeStorageService);
  readonly auth = inject(AuthService);

  private readonly loginButton = viewChild<ElementRef<HTMLElement>>('loginButton');

  private readonly resumePreview = viewChild<ElementRef<HTMLElement>>('resumePreview');

  readonly headerFields = [
    { key: 'name', label: 'Full Name' },
    { key: 'title', label: 'Title' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
    { key: 'linkedin', label: 'LinkedIn' },
    { key: 'location', label: 'Location' },
  ] as const;

  constructor() {
    // When the login gate is visible and Google Identity Services is ready,
    // render the official "Sign in with Google" button into its container.
    effect(() => {
      const host = this.loginButton();
      if (this.auth.enabled && this.auth.ready() && !this.auth.user() && host) {
        this.auth.renderButton(host.nativeElement);
      }
    });
  }

  // True when the managed AI backend is configured; all AI runs server-side.
  get usesBackend(): boolean {
    return !!(environment.apiBaseUrl || '').trim();
  }

  // Whether the app should block on Google sign-in (auth configured but signed out).
  get loginRequired(): boolean {
    return this.auth.enabled && !this.auth.user();
  }
  readonly defaultHeaderColor = DEFAULT_HEADER_COLOR;
  readonly companyName = 'Olitron';
  readonly currentYear = new Date().getFullYear();

  // --- Reactive state (signals) exposed through getters so templates stay simple ---
  // The app starts empty; a resume appears only after upload or open.
  private readonly _resume = signal<ResumeData>(cloneResume(emptyResumeData));
  // Pristine copy of the currently loaded resume — the baseline that "Reset"
  // reverts to and that "Tailored" highlighting is diffed against.
  private baselineResume = cloneResume(emptyResumeData);
  private readonly _selectedScopeIds = signal<string[]>([]);
  private readonly _changedScopeIds = signal<string[]>([]);
  private readonly _status = signal<RequestStatus>('idle');
  private readonly _globalStatus = signal<RequestStatus>('idle');
  private readonly _progressLabel = signal('');
  private readonly _error = signal('');
  private readonly _globalError = signal('');
  private readonly _pdfBusy = signal(false);
  private readonly _wordBusy = signal(false);
  private readonly _headerColor = signal(this.getSavedHeaderColor());
  private readonly _showUploadPanel = signal(false);
  private readonly _showResumeHistory = signal(false);
  private readonly _theme = signal<Theme>(this.getSavedTheme());
  // Which header dropdown is open ('resume' | 'download' | null) — only one at a time.
  private readonly _openMenu = signal<'resume' | 'download' | null>(null);
  // Mobile: the tailor panel is a slide-in drawer that's closed by default.
  private readonly _tailorPanelOpen = signal(false);

  // Two-way [(ngModel)] fields must be assignable, so they stay plain fields.
  // They only change on input events, which drive change detection on their own.
  jobDescription = '';
  commonChanges = '';

  // Toggled off/on to force the preview to re-render from the model (see rerenderPreview).
  previewVisible = true;
  private addedProjectCounter = 0;

  get resume(): ResumeData {
    return this._resume();
  }
  get selectedScopeIds(): string[] {
    return this._selectedScopeIds();
  }
  get changedScopeIds(): string[] {
    return this._changedScopeIds();
  }
  get status(): RequestStatus {
    return this._status();
  }
  get globalStatus(): RequestStatus {
    return this._globalStatus();
  }
  get progressLabel(): string {
    return this._progressLabel();
  }
  get error(): string {
    return this._error();
  }
  get globalError(): string {
    return this._globalError();
  }
  get pdfBusy(): boolean {
    return this._pdfBusy();
  }
  get wordBusy(): boolean {
    return this._wordBusy();
  }
  get headerColor(): string {
    return this._headerColor();
  }
  get showUploadPanel(): boolean {
    return this._showUploadPanel();
  }
  get showResumeHistory(): boolean {
    return this._showResumeHistory();
  }

  get theme(): Theme {
    return this._theme();
  }

  get isDark(): boolean {
    return this._theme() === 'dark';
  }

  toggleTheme(): void {
    const next: Theme = this.isDark ? 'light' : 'dark';
    this._theme.set(next);
    globalThis.localStorage?.setItem(THEME_STORAGE, next);
    this.applyColorScheme(next);
  }

  private getSavedTheme(): Theme {
    const saved = globalThis.localStorage?.getItem(THEME_STORAGE);
    if (saved === 'dark' || saved === 'light') return saved;
    // Default to the OS preference on first visit.
    return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  // Hint native controls (scrollbars, color popups, form fields) to match the theme.
  private applyColorScheme(theme: Theme): void {
    globalThis.document?.documentElement?.style.setProperty('color-scheme', theme);
  }

  get scopes(): ResumeScope[] {
    return getAllScopes(this.resume);
  }

  // True once a resume has been uploaded or opened; false on the empty landing state.
  get isResumeLoaded(): boolean {
    const r = this.resume;
    return Boolean(
      r.name ||
        r.title ||
        r.email ||
        r.phone ||
        r.location ||
        r.linkedin ||
        r.education ||
        r.summary.length ||
        r.skills.length ||
        r.experience.length,
    );
  }

  get allSelected(): boolean {
    return this.scopes.length > 0 && this.scopes.every((scope) => this.isSelected(scope.id));
  }

  get canTailor(): boolean {
    return (
      this.status !== 'loading' &&
      Boolean(this.jobDescription.trim()) &&
      this.usesBackend &&
      this.selectedScopeIds.length > 0
    );
  }

  get canApplyCommonChanges(): boolean {
    return this.globalStatus !== 'loading' && Boolean(this.commonChanges.trim()) && this.usesBackend;
  }

  get canReset(): boolean {
    return (
      this.selectedScopeIds.length > 0 &&
      this.selectedScopeIds.some(
        (scopeId) =>
          JSON.stringify(getScopeBullets(this.baselineResume, scopeId)) !==
          JSON.stringify(getScopeBullets(this.resume, scopeId)),
      )
    );
  }

  updateHeaderField(field: string, value: string): void {
    this._resume.update((r) => ({ ...r, [field]: value }) as ResumeData);
  }

  updateJobRole(jobIndex: number, value: string): void {
    this._resume.update((r) => ({
      ...r,
      experience: r.experience.map((job, i) => (i === jobIndex ? { ...job, role: value } : job)),
    }));
  }

  editInline(path: ResumePath, event: FocusEvent): void {
    const value = (event.currentTarget as HTMLElement).textContent ?? '';
    this._resume.update((current) => {
      const next = structuredClone(current);
      let cursor = next as unknown as Record<string | number, unknown>;
      for (let index = 0; index < path.length - 1; index += 1) {
        cursor = cursor[path[index]] as Record<string | number, unknown>;
      }
      cursor[path[path.length - 1]] = value;
      return next;
    });
  }

  finishInlineEdit(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      (event.currentTarget as HTMLElement).blur();
    }
  }

  // --- Structural editing: add or remove optional parts of the resume ---
  // Updating the signal notifies Angular, so the view repaints with no manual
  // change detection and no reliance on zone.js.

  addLeftExtra(): void {
    this._resume.update((r) => ({ ...r, leftExtras: [...r.leftExtras, ''] }));
  }

  removeLeftExtra(index: number): void {
    this._resume.update((r) => ({ ...r, leftExtras: r.leftExtras.filter((_, i) => i !== index) }));
  }

  addRightExtra(): void {
    this._resume.update((r) => ({ ...r, rightExtras: [...r.rightExtras, ''] }));
  }

  removeRightExtra(index: number): void {
    this._resume.update((r) => ({ ...r, rightExtras: r.rightExtras.filter((_, i) => i !== index) }));
  }

  addSummaryBullet(): void {
    this._resume.update((r) => ({ ...r, summary: [...r.summary, ''] }));
  }

  removeSummaryBullet(index: number): void {
    this._resume.update((r) => ({ ...r, summary: r.summary.filter((_, i) => i !== index) }));
  }

  addSkill(): void {
    this._resume.update((r) => ({ ...r, skills: [...r.skills, { label: '', items: '' }] }));
  }

  removeSkill(index: number): void {
    this._resume.update((r) => ({ ...r, skills: r.skills.filter((_, i) => i !== index) }));
  }

  addBullet(jobIndex: number, projectIndex: number): void {
    this.mutateProject(jobIndex, projectIndex, (bullets) => [...bullets, '']);
  }

  removeBullet(jobIndex: number, projectIndex: number, bulletIndex: number): void {
    this.mutateProject(jobIndex, projectIndex, (bullets) => bullets.filter((_, i) => i !== bulletIndex));
  }

  private mutateProject(
    jobIndex: number,
    projectIndex: number,
    updateBullets: (bullets: string[]) => string[],
  ): void {
    this._resume.update((r) => ({
      ...r,
      experience: r.experience.map((job, ji) =>
        ji !== jobIndex
          ? job
          : {
              ...job,
              projects: job.projects.map((project, pi) =>
                pi !== projectIndex ? project : { ...project, bullets: updateBullets(project.bullets) },
              ),
            },
      ),
    }));
  }

  addProject(jobIndex: number): void {
    const id = this.newProjectId();
    this._resume.update((r) => ({
      ...r,
      experience: r.experience.map((job, ji) =>
        ji !== jobIndex
          ? job
          : { ...job, projects: [...job.projects, { id, clientLabel: '', duration: '', bullets: [''] }] },
      ),
    }));
  }

  removeProject(jobIndex: number, projectIndex: number): void {
    const removed = this.resume.experience[jobIndex]?.projects[projectIndex];
    this._resume.update((r) => ({
      ...r,
      experience: r.experience.map((job, ji) =>
        ji !== jobIndex ? job : { ...job, projects: job.projects.filter((_, pi) => pi !== projectIndex) },
      ),
    }));
    if (removed) this.forgetScope(removed.id);
  }

  addJob(): void {
    this._resume.update((r) => ({
      ...r,
      experience: [...r.experience, { role: '', company: '', duration: '', clientsLine: '', projects: [] }],
    }));
  }

  removeJob(jobIndex: number): void {
    const removed = this.resume.experience[jobIndex];
    this._resume.update((r) => ({
      ...r,
      experience: r.experience.filter((_, ji) => ji !== jobIndex),
    }));
    removed?.projects.forEach((project) => this.forgetScope(project.id));
  }

  // Drop a removed section's id from selection/change tracking so stale ids don't linger.
  private forgetScope(scopeId: string): void {
    this._selectedScopeIds.update((ids) => ids.filter((id) => id !== scopeId));
    this._changedScopeIds.update((ids) => ids.filter((id) => id !== scopeId));
  }

  // Unique id for a newly added project so it never collides with existing scope ids.
  private newProjectId(): string {
    return `added-project-${Date.now()}-${this.addedProjectCounter++}`;
  }

  isSelected(scopeId: string): boolean {
    return this.selectedScopeIds.includes(scopeId);
  }

  isChanged(scopeId: string): boolean {
    return this.changedScopeIds.includes(scopeId);
  }

  isBulletChanged(scopeId: string, bulletIndex: number, bullet: string): boolean {
    if (!this.isChanged(scopeId)) return false;
    const originalBullets = getScopeBullets(this.baselineResume, scopeId);
    return !originalBullets || originalBullets[bulletIndex] !== bullet;
  }

  toggleScope(scopeId: string): void {
    this._selectedScopeIds.update((ids) =>
      ids.includes(scopeId) ? ids.filter((id) => id !== scopeId) : [...ids, scopeId],
    );
    this._status.set('idle');
    this._error.set('');
  }

  toggleAll(): void {
    this._selectedScopeIds.set(this.allSelected ? [] : this.scopes.map((scope) => scope.id));
    this._status.set('idle');
    this._error.set('');
  }

  async tailorSelected(): Promise<void> {
    this._status.set('loading');
    this._error.set('');
    const newlyChanged: string[] = [];

    const scopeIds = this.selectedScopeIds;
    for (let index = 0; index < scopeIds.length; index += 1) {
      const scopeId = scopeIds[index];
      const scopeLabel = getScopeLabel(this.resume, scopeId);
      this._progressLabel.set(`Tailoring ${index + 1}/${scopeIds.length}: ${scopeLabel}...`);

      try {
        const currentBullets = getScopeBullets(this.resume, scopeId);
        if (!currentBullets) throw new Error(`Could not find the "${scopeLabel}" section.`);

        const updatedBullets = await tailorBullets({
          clientLabel: scopeLabel,
          currentBullets,
          jobDescription: this.jobDescription,
        });
        const updatedResume = cloneResume(this.resume);
        setScopeBullets(updatedResume, scopeId, [...updatedBullets]);
        this._resume.set(updatedResume);
        newlyChanged.push(scopeId);
        this._changedScopeIds.update((ids) => [...new Set([...ids, scopeId])]);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Something went wrong calling the AI service.';
        this._error.set(`Failed on "${scopeLabel}": ${message}`);
        this._status.set('error');
        this._changedScopeIds.update((ids) => [...new Set([...ids, ...newlyChanged])]);
        this._progressLabel.set('');
        return;
      }
    }

    this._changedScopeIds.update((ids) => [...new Set([...ids, ...newlyChanged])]);
    this._status.set('success');
    this._progressLabel.set('');
    void this.auth.refreshUsage();
  }

  resetSelected(): void {
    const selected = this.selectedScopeIds;
    this._resume.update((current) => {
      const next = cloneResume(current);
      for (const scopeId of selected) {
        const originalBullets = getScopeBullets(this.baselineResume, scopeId);
        if (originalBullets) setScopeBullets(next, scopeId, [...originalBullets]);
      }
      return next;
    });
    this._changedScopeIds.update((ids) => ids.filter((id) => !selected.includes(id)));
    this._status.set('idle');
    this._error.set('');
    this.rerenderPreview();
  }

  async applyCommonChanges(): Promise<void> {
    this._globalStatus.set('loading');
    this._globalError.set('');

    try {
      const previousResume = this.resume;
      const updated = await applyGlobalChanges({
        resume: previousResume,
        instructions: this.commonChanges,
      });
      const touchedScopes: string[] = [];

      if (JSON.stringify(updated.summary) !== JSON.stringify(previousResume.summary)) {
        touchedScopes.push(SUMMARY_SCOPE_ID);
      }
      updated.experience.forEach((job, jobIndex) => {
        job.projects.forEach((project, projectIndex) => {
          const oldBullets = previousResume.experience[jobIndex].projects[projectIndex].bullets;
          if (JSON.stringify(project.bullets) !== JSON.stringify(oldBullets)) {
            touchedScopes.push(project.id);
          }
        });
      });

      this._resume.set(withHeaderExtras(updated));
      this._changedScopeIds.update((ids) => [...new Set([...ids, ...touchedScopes])]);
      this._globalStatus.set('success');
      this.rerenderPreview();
      void this.auth.refreshUsage();
    } catch (error: unknown) {
      this._globalError.set(
        error instanceof Error ? error.message : 'Something went wrong calling the AI service.',
      );
      this._globalStatus.set('error');
    }
  }

  resetAll(): void {
    this._resume.set(cloneResume(this.baselineResume));
    this._changedScopeIds.set([]);
    this._status.set('idle');
    this._error.set('');
    this._globalStatus.set('idle');
    this._globalError.set('');
    this.rerenderPreview();
  }

  // True once the working resume differs from the originally uploaded/opened one.
  get canResetToUploaded(): boolean {
    return this.isResumeLoaded && JSON.stringify(this.resume) !== JSON.stringify(this.baselineResume);
  }

  // Discard all edits, tailoring, and removals — restore the uploaded resume.
  resetToUploaded(): void {
    if (!this.canResetToUploaded) return;
    if (!globalThis.confirm?.('Discard all edits and restore the uploaded resume?')) return;
    const restored = cloneResume(this.baselineResume);
    this._resume.set(restored);
    this._changedScopeIds.set([]);
    this._selectedScopeIds.update((ids) =>
      ids.filter((id) => getAllScopes(restored).some((scope) => scope.id === id)),
    );
    this._status.set('idle');
    this._error.set('');
    this._globalStatus.set('idle');
    this._globalError.set('');
    this.rerenderPreview();
  }

  // Destroy and recreate the preview subtree so every contenteditable field is
  // re-rendered from the current model. Uses detectChanges() to flush the removal
  // before the re-add — signal batching alone would collapse the toggle.
  private rerenderPreview(): void {
    this.previewVisible = false;
    this.changeDetector.detectChanges();
    this.previewVisible = true;
    this.changeDetector.detectChanges();
  }

  get resumeMenuOpen(): boolean {
    return this._openMenu() === 'resume';
  }

  get downloadMenuOpen(): boolean {
    return this._openMenu() === 'download';
  }

  toggleResumeMenu(): void {
    this._openMenu.update((m) => (m === 'resume' ? null : 'resume'));
  }

  toggleDownloadMenu(): void {
    this._openMenu.update((m) => (m === 'download' ? null : 'download'));
  }

  closeMenus(): void {
    this._openMenu.set(null);
  }

  get tailorPanelOpen(): boolean {
    return this._tailorPanelOpen();
  }

  toggleTailorPanel(): void {
    this._tailorPanelOpen.update((open) => !open);
  }

  closeTailorPanel(): void {
    this._tailorPanelOpen.set(false);
  }

  // Close any open header dropdown when clicking outside the dropdowns.
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this._openMenu() && !(event.target as HTMLElement).closest('.hdr-dropdown')) {
      this._openMenu.set(null);
    }
  }

  async downloadPdf(): Promise<void> {
    const preview = this.resumePreview();
    if (!preview) return;
    this._pdfBusy.set(true);
    try {
      await exportElementToPdf(preview.nativeElement, `${this.fileSafeName()}_Resume.pdf`);
    } finally {
      this._pdfBusy.set(false);
    }
  }

  async downloadWord(): Promise<void> {
    this._wordBusy.set(true);
    try {
      await exportResumeToDocx(
        this.resume,
        `${this.fileSafeName()}_Resume.docx`,
        this.headerColor.replace('#', '').toUpperCase(),
      );
    } finally {
      this._wordBusy.set(false);
    }
  }

  private fileSafeName(): string {
    return this.resume.name.replace(/\s+/g, '_');
  }

  ngOnInit(): void {
    this.applyColorScheme(this.theme);
    this.auth.init();
    this.restoreLastResume();
  }

  // Upload and resume management methods
  onResumeUploaded(event: { data: ResumeData; key: string }): void {
    this.loadResume(event.data, event.key);
    this._showUploadPanel.set(false);
  }

  onUploadCancelled(): void {
    this._showUploadPanel.set(false);
  }

  onResumeSelected(event: { data: ResumeData; key: string }): void {
    this.loadResume(event.data, event.key);
    this._showResumeHistory.set(false);
  }

  private loadResume(data: ResumeData, key: string): void {
    const normalized = withHeaderExtras(data);
    this.baselineResume = cloneResume(normalized);
    this._resume.set(cloneResume(normalized));
    globalThis.localStorage?.setItem(CURRENT_RESUME_KEY_STORAGE, key);
    this._selectedScopeIds.set([]);
    this._changedScopeIds.set([]);
    this._status.set('idle');
    this._error.set('');
    this._globalStatus.set('idle');
    this._globalError.set('');
  }

  // Reload the resume the user last worked on so uploads survive a page refresh.
  private restoreLastResume(): void {
    const savedKey = globalThis.localStorage?.getItem(CURRENT_RESUME_KEY_STORAGE);
    if (!savedKey) return;
    const saved = this.storageService.loadResume(savedKey);
    if (saved) {
      this.loadResume(saved, savedKey);
    } else {
      globalThis.localStorage?.removeItem(CURRENT_RESUME_KEY_STORAGE);
    }
  }

  openUploadPanel(): void {
    this._showUploadPanel.set(true);
  }

  openResumeHistory(): void {
    this._showResumeHistory.set(true);
  }

  closeResumeHistory(): void {
    this._showResumeHistory.set(false);
  }

  updateHeaderColor(value: string): void {
    if (!/^#[0-9a-fA-F]{6}$/.test(value)) return;
    this._headerColor.set(value);
    globalThis.localStorage?.setItem(HEADER_COLOR_STORAGE, value);
  }

  resetHeaderColor(): void {
    this.updateHeaderColor(this.defaultHeaderColor);
  }

  get isDefaultHeaderColor(): boolean {
    return this.headerColor.toLowerCase() === this.defaultHeaderColor;
  }

  // Light tint of the accent for section-header backgrounds. Computed as a
  // concrete hex (not CSS color-mix) so html2canvas renders it in the PDF.
  get headerColorSoft(): string {
    const match = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(this.headerColor);
    if (!match) return '#d9e2f3';
    const mix = (hex: string) => {
      const channel = parseInt(hex, 16);
      const blended = Math.round(channel + (255 - channel) * 0.84);
      return blended.toString(16).padStart(2, '0');
    };
    return `#${mix(match[1])}${mix(match[2])}${mix(match[3])}`;
  }

  private getSavedHeaderColor(): string {
    const saved = globalThis.localStorage?.getItem(HEADER_COLOR_STORAGE) ?? '';
    return /^#[0-9a-fA-F]{6}$/.test(saved) ? saved : DEFAULT_HEADER_COLOR;
  }

}
