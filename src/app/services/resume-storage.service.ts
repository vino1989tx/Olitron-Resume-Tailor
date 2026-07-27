import { Injectable } from '@angular/core';
import { ResumeData } from '../data/resume-data';

export interface SavedResume {
  key: string;
  name: string;
  timestamp: number;
  data: ResumeData;
}

@Injectable({
  providedIn: 'root',
})
export class ResumeStorageService {
  private readonly STORAGE_PREFIX = 'resume_';

  /**
   * Save a resume to localStorage
   */
  saveResume(fileName: string, data: ResumeData): SavedResume {
    const key = this.generateKey(fileName);
    const timestamp = Date.now();
    const savedResume: SavedResume = { key, name: fileName, timestamp, data };

    try {
      localStorage.setItem(key, JSON.stringify(savedResume));
    } catch (error) {
      throw new Error(
        `Failed to save resume: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    return savedResume;
  }

  /**
   * Load a resume from localStorage
   */
  loadResume(key: string): ResumeData | null {
    try {
      const item = localStorage.getItem(key);
      if (!item) {
        return null;
      }

      const savedResume = JSON.parse(item) as SavedResume;
      return savedResume.data;
    } catch (error) {
      console.error(`Failed to load resume: ${error}`);
      return null;
    }
  }

  /**
   * List all saved resumes
   */
  listSavedResumes(): SavedResume[] {
    const resumes: SavedResume[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.STORAGE_PREFIX)) {
        try {
          const item = localStorage.getItem(key);
          if (item) {
            const savedResume = JSON.parse(item) as SavedResume;
            resumes.push(savedResume);
          }
        } catch (error) {
          console.error(`Failed to parse resume at key ${key}: ${error}`);
        }
      }
    }

    // Sort by timestamp (newest first)
    return resumes.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Delete a resume from localStorage
   */
  deleteResume(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      throw new Error(
        `Failed to delete resume: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get storage stats
   */
  getStorageStats(): { count: number; totalSizeKB: number } {
    const resumes = this.listSavedResumes();
    let totalSize = 0;

    for (const resume of resumes) {
      const json = JSON.stringify(resume);
      totalSize += json.length;
    }

    return {
      count: resumes.length,
      totalSizeKB: Math.round(totalSize / 1024),
    };
  }

  /**
   * Clear all saved resumes
   */
  clearAllResumes(): void {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.STORAGE_PREFIX)) {
        keys.push(key);
      }
    }

    for (const key of keys) {
      localStorage.removeItem(key);
    }
  }

  /**
   * Generate a unique key for storage
   */
  private generateKey(fileName: string): string {
    const sanitized = fileName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const timestamp = Date.now();
    return `${this.STORAGE_PREFIX}${sanitized}_${timestamp}`;
  }
}
