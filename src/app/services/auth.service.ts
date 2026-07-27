import { Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment.generated';

/** Signed-in Google user (decoded from the ID token). */
export interface GoogleUser {
  sub: string;
  email: string;
  name: string;
  picture: string;
}

/** Cumulative usage + quota returned by the backend for the current user. */
export interface UsageInfo {
  email: string;
  name: string;
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
  requests: number;
  limit: number;
  remaining: number;
  estimatedCost: number;
}

// Minimal shape of the Google Identity Services global we use.
interface GoogleCredentialResponse {
  credential: string;
}
declare const google: any;

const TOKEN_STORAGE_KEY = 'googleIdToken';

/**
 * Google sign-in + per-user usage state.
 *
 * When `environment.googleClientId` is set, the app requires Google sign-in and
 * every backend AI call carries the user's ID token (read from sessionStorage by
 * the ai-client). When it is empty (local dev without auth), `enabled` is false
 * and the app falls back to the bring-your-own-key flow.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly enabled = !!(environment.googleClientId || '').trim();

  private readonly _user = signal<GoogleUser | null>(null);
  private readonly _usage = signal<UsageInfo | null>(null);
  private readonly _ready = signal(false);

  readonly user = this._user.asReadonly();
  readonly usage = this._usage.asReadonly();
  /** True once Google Identity Services has loaded and the button can render. */
  readonly ready = this._ready.asReadonly();

  private idToken = '';

  /** Initialize Google Identity Services and restore any existing session. */
  init(): void {
    if (!this.enabled) return;

    // Restore a token kept for this browser session (survives reloads within it).
    const stored = this.readStoredToken();
    if (stored) {
      const user = this.decodeUser(stored);
      if (user) {
        this.idToken = stored;
        this._user.set(user);
        void this.refreshUsage();
      }
    }

    this.whenGoogleReady(() => {
      google.accounts.id.initialize({
        client_id: environment.googleClientId,
        callback: (resp: GoogleCredentialResponse) => this.handleCredential(resp),
        auto_select: true,
      });
      this._ready.set(true);
    });
  }

  /** Render the official Google button into the given element. */
  renderButton(element: HTMLElement): void {
    if (!this.enabled) return;
    this.whenGoogleReady(() => {
      google.accounts.id.renderButton(element, {
        theme: 'filled_blue',
        size: 'large',
        shape: 'pill',
        text: 'signin_with',
        logo_alignment: 'left',
      });
      google.accounts.id.prompt();
    });
  }

  signOut(): void {
    try {
      google?.accounts?.id?.disableAutoSelect();
    } catch {
      // ignore
    }
    this.idToken = '';
    this._user.set(null);
    this._usage.set(null);
    try {
      globalThis.sessionStorage?.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  getToken(): string {
    return this.idToken;
  }

  /** Fetch the current user's cumulative usage + quota from the backend. */
  async refreshUsage(): Promise<void> {
    const baseUrl = (environment.apiBaseUrl || '').trim();
    if (!baseUrl || !this.idToken) return;
    try {
      const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/me`, {
        headers: { authorization: `Bearer ${this.idToken}` },
      });
      if (response.status === 401) {
        // Token expired — force a fresh sign-in.
        this.signOut();
        return;
      }
      if (!response.ok) return;
      this._usage.set((await response.json()) as UsageInfo);
    } catch {
      // Network hiccup — leave the last known usage in place.
    }
  }

  private handleCredential(resp: GoogleCredentialResponse): void {
    const user = this.decodeUser(resp.credential);
    if (!user) return;
    this.idToken = resp.credential;
    try {
      globalThis.sessionStorage?.setItem(TOKEN_STORAGE_KEY, resp.credential);
    } catch {
      // ignore
    }
    this._user.set(user);
    void this.refreshUsage();
  }

  private readStoredToken(): string {
    try {
      return globalThis.sessionStorage?.getItem(TOKEN_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  }

  /** Decode the ID token's JWT payload; returns null if malformed/expired. */
  private decodeUser(idToken: string): GoogleUser | null {
    try {
      const payloadSegment = idToken.split('.')[1];
      const json = atob(payloadSegment.replace(/-/g, '+').replace(/_/g, '/'));
      const claims = JSON.parse(json) as {
        sub: string;
        email?: string;
        name?: string;
        picture?: string;
        exp?: number;
      };
      if (claims.exp && claims.exp * 1000 < Date.now()) return null;
      return {
        sub: claims.sub,
        email: claims.email || '',
        name: claims.name || '',
        picture: claims.picture || '',
      };
    } catch {
      return null;
    }
  }

  private whenGoogleReady(callback: () => void, attempts = 0): void {
    if (typeof google !== 'undefined' && google?.accounts?.id) {
      callback();
      return;
    }
    if (attempts > 50) return; // ~5s; GSI script failed to load
    setTimeout(() => this.whenGoogleReady(callback, attempts + 1), 100);
  }
}
