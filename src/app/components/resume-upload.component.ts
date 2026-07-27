import { ChangeDetectionStrategy, Component, inject, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ResumeUploadService } from '../services/resume-upload.service';
import { ResumeParserService } from '../services/resume-parser.service';
import { ResumeStorageService } from '../services/resume-storage.service';
import { ResumeData } from '../data/resume-data';
import { ApiKeys, resolveApiKeys } from '../services/ai-client';

type UploadStatus = 'idle' | 'extracting' | 'parsing' | 'saving' | 'success' | 'error';

@Component({
  selector: 'app-resume-upload',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  templateUrl: './resume-upload.component.html',
  styleUrls: ['./resume-upload.component.css'],
})
export class ResumeUploadComponent implements OnInit {
  private uploadService = inject(ResumeUploadService);
  private parserService = inject(ResumeParserService);
  private storageService = inject(ResumeStorageService);

  readonly resumeUploaded = output<{ data: ResumeData; key: string }>();
  readonly uploadCancelled = output<void>();

  // Signals so the async upload flow (extract → parse → save) repaints without zone.js.
  readonly status = signal<UploadStatus>('idle');
  readonly errorMessage = signal<string | null>(null);
  readonly selectedFile = signal<File | null>(null);
  readonly progress = signal(0);
  readonly apiKeys = signal<ApiKeys | null>(null);
  readonly showApiKeyInput = signal(false);
  readonly dragOver = signal(false);

  // Two-way [(ngModel)] fields stay plain (assignable); input events drive updates.
  openaiApiKey = '';
  anthropicApiKey = '';

  ngOnInit() {
    // Try to load API keys from environment or sessionStorage
    const envKeys = resolveApiKeys();
    if (envKeys.anthropic || envKeys.openai) {
      this.apiKeys.set(envKeys);
    }

    if (!this.apiKeys()) {
      const stored = sessionStorage.getItem('apiKeys');
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as ApiKeys;
          this.apiKeys.set(parsed);
          this.openaiApiKey = parsed.openai || '';
          this.anthropicApiKey = parsed.anthropic || '';
        } catch {
          // Ignore parse errors
        }
      }
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.dragOver.set(true);
  }

  onDragLeave() {
    this.dragOver.set(false);
  }

  onDropped(event: DragEvent) {
    event.preventDefault();
    this.dragOver.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.selectFile(files[0]);
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectFile(input.files[0]);
    }
  }

  private selectFile(file: File) {
    this.errorMessage.set(null);
    const validation = this.uploadService.validateFile(file);

    if (!validation.valid) {
      this.errorMessage.set(validation.error || 'Invalid file');
      return;
    }

    this.selectedFile.set(file);
    this.progress.set(0);
  }

  saveApiKeys() {
    if (!this.openaiApiKey && !this.anthropicApiKey) {
      this.errorMessage.set('Please provide at least one API key');
      return;
    }

    const keys: ApiKeys = {
      openai: this.openaiApiKey.trim(),
      anthropic: this.anthropicApiKey.trim(),
    };
    this.apiKeys.set(keys);
    sessionStorage.setItem('apiKeys', JSON.stringify(keys));
    this.showApiKeyInput.set(false);
    this.errorMessage.set(null);
  }

  async uploadResume() {
    const file = this.selectedFile();
    if (!file) {
      this.errorMessage.set('Please select a file');
      return;
    }

    const keys = this.apiKeys();
    if (!keys || (!keys.openai && !keys.anthropic)) {
      this.showApiKeyInput.set(true);
      return;
    }

    try {
      // Step 1: Extract text
      this.status.set('extracting');
      this.progress.set(20);
      const extractedText = await this.uploadService.extractResumeText(file);

      // Step 2: Parse with AI
      this.status.set('parsing');
      this.progress.set(50);
      const resumeData = await this.parserService.parseResumeText(extractedText, keys);

      // Step 3: Save to storage
      this.status.set('saving');
      this.progress.set(80);
      const saved = this.storageService.saveResume(file.name, resumeData);

      // Step 4: Success
      this.status.set('success');
      this.progress.set(100);

      setTimeout(() => {
        this.resumeUploaded.emit({ data: resumeData, key: saved.key });
      }, 500);
    } catch (error) {
      this.status.set('error');
      this.errorMessage.set(error instanceof Error ? error.message : 'An unexpected error occurred');
    }
  }

  cancel() {
    const status = this.status();
    if (status === 'idle' || status === 'error' || status === 'success') {
      this.selectedFile.set(null);
      this.errorMessage.set(null);
      this.uploadCancelled.emit();
    }
  }

  // Always-available close (the ✕ and backdrop). Blocked only while actively
  // extracting/parsing/saving so a half-finished upload can't be abandoned mid-flight.
  close() {
    const status = this.status();
    if (status === 'extracting' || status === 'parsing' || status === 'saving') return;
    this.selectedFile.set(null);
    this.errorMessage.set(null);
    this.uploadCancelled.emit();
  }

  retry() {
    this.status.set('idle');
    this.errorMessage.set(null);
    this.progress.set(0);
  }
}
