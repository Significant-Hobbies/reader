import { describe, it, expect } from 'vitest';
import {
  PROVIDER_LABELS,
  FALLBACK_MODELS,
  DEFAULT_AI_CONFIG,
  AI_CONFIG_STORAGE_KEY,
  type AIProvider,
  type AIConfig,
  type AIChatMessage,
  type PageContent,
  type AuthState,
} from '../types';

describe('types constants', () => {
  describe('PROVIDER_LABELS', () => {
    it('has a label for every AIProvider', () => {
      const providers: AIProvider[] = ['gateway', 'openai', 'anthropic', 'google'];
      for (const provider of providers) {
        expect(PROVIDER_LABELS[provider]).toBeDefined();
        expect(typeof PROVIDER_LABELS[provider]).toBe('string');
        expect(PROVIDER_LABELS[provider].length).toBeGreaterThan(0);
      }
    });

    it('contains exactly the expected providers', () => {
      expect(Object.keys(PROVIDER_LABELS).sort()).toEqual([
        'anthropic',
        'gateway',
        'google',
        'openai',
      ]);
    });
  });

  describe('FALLBACK_MODELS', () => {
    it('has models for every provider', () => {
      const providers: AIProvider[] = ['gateway', 'openai', 'anthropic', 'google'];
      for (const provider of providers) {
        expect(Array.isArray(FALLBACK_MODELS[provider])).toBe(true);
        expect(FALLBACK_MODELS[provider].length).toBeGreaterThan(0);
      }
    });

    it('every model is a non-empty string', () => {
      for (const models of Object.values(FALLBACK_MODELS)) {
        for (const model of models) {
          expect(typeof model).toBe('string');
          expect(model.length).toBeGreaterThan(0);
        }
      }
    });

    it('has the same provider keys as PROVIDER_LABELS', () => {
      expect(Object.keys(FALLBACK_MODELS).sort()).toEqual(Object.keys(PROVIDER_LABELS).sort());
    });
  });

  describe('DEFAULT_AI_CONFIG', () => {
    it('uses gateway as the default provider', () => {
      expect(DEFAULT_AI_CONFIG.provider).toBe('gateway');
    });

    it('uses the first gateway fallback model', () => {
      expect(DEFAULT_AI_CONFIG.model).toBe(FALLBACK_MODELS.gateway[0]);
    });

    it('has an empty API key by default', () => {
      expect(DEFAULT_AI_CONFIG.apiKey).toBe('');
    });

    it('satisfies AIConfig shape', () => {
      const config: AIConfig = DEFAULT_AI_CONFIG;
      expect(config).toHaveProperty('provider');
      expect(config).toHaveProperty('model');
      expect(config).toHaveProperty('apiKey');
    });
  });

  describe('AI_CONFIG_STORAGE_KEY', () => {
    it('is a non-empty string', () => {
      expect(typeof AI_CONFIG_STORAGE_KEY).toBe('string');
      expect(AI_CONFIG_STORAGE_KEY.length).toBeGreaterThan(0);
    });

    it('contains a version suffix for cache busting', () => {
      expect(AI_CONFIG_STORAGE_KEY).toMatch(/-v\d+$/);
    });
  });

  describe('type contracts (compile-time + runtime shape checks)', () => {
    it('AIChatMessage accepts user and assistant roles', () => {
      const userMsg: AIChatMessage = { role: 'user', content: 'hello' };
      const assistantMsg: AIChatMessage = { role: 'assistant', content: 'hi' };

      expect(userMsg.role).toBe('user');
      expect(assistantMsg.role).toBe('assistant');
    });

    it('PageContent has all required fields', () => {
      const page: PageContent = {
        title: 'Test',
        byline: null,
        content: '<p>content</p>',
        textContent: 'content',
        siteName: null,
        url: 'https://example.com',
      };

      expect(page).toHaveProperty('title');
      expect(page).toHaveProperty('byline');
      expect(page).toHaveProperty('content');
      expect(page).toHaveProperty('textContent');
      expect(page).toHaveProperty('siteName');
      expect(page).toHaveProperty('url');
    });

    it('AuthState has expected shape when unauthenticated', () => {
      const state: AuthState = { isAuthenticated: false, user: null };
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
    });

    it('AuthState has expected shape when authenticated', () => {
      const state: AuthState = {
        isAuthenticated: true,
        user: {
          uid: '123',
          email: 'test@example.com',
          displayName: 'Test User',
          photoURL: 'https://example.com/photo.jpg',
        },
      };
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).not.toBeNull();
      expect(state.user!.uid).toBe('123');
    });
  });
});
