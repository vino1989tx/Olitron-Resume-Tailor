import { ChangeDetectionStrategy, Component, inject, OnInit, output, signal } from '@angular/core';
import { ResumeStorageService, SavedResume } from '../services/resume-storage.service';
import { ResumeData } from '../data/resume-data';

@Component({
  selector: 'app-resume-history',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './resume-history.component.html',
  styleUrls: ['./resume-history.component.css'],
})
export class ResumeHistoryComponent implements OnInit {
  private storageService = inject(ResumeStorageService);

  readonly resumeSelected = output<{ data: ResumeData; key: string }>();
  readonly closeHistory = output<void>();

  readonly savedResumes = signal<SavedResume[]>([]);
  readonly selectedKey = signal<string | null>(null);

  ngOnInit() {
    this.loadSavedResumes();
  }

  loadSavedResumes() {
    this.savedResumes.set(this.storageService.listSavedResumes());
  }

  selectResume(key: string) {
    this.selectedKey.set(key);
  }

  loadResume(resume: SavedResume) {
    this.resumeSelected.emit({ data: resume.data, key: resume.key });
    this.close();
  }

  deleteResume(key: string, event: Event) {
    event.stopPropagation();

    if (confirm('Are you sure you want to delete this resume?')) {
      this.storageService.deleteResume(key);
      this.loadSavedResumes();

      if (this.selectedKey() === key) {
        this.selectedKey.set(null);
      }
    }
  }

  close() {
    this.closeHistory.emit();
  }

  formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
    }
  }
}
