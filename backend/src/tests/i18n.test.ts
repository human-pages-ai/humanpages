import { describe, it, expect } from 'vitest';
import { t, getTranslator, supportedLanguages } from '../i18n/index.js';

describe('i18n', () => {
  describe('supportedLanguages', () => {
    it('should have 8 supported languages', () => {
      expect(supportedLanguages).toHaveLength(8);
      expect(supportedLanguages).toContain('en');
      expect(supportedLanguages).toContain('es');
      expect(supportedLanguages).toContain('zh');
      expect(supportedLanguages).toContain('tl');
      expect(supportedLanguages).toContain('hi');
      expect(supportedLanguages).toContain('vi');
      expect(supportedLanguages).toContain('tr');
      expect(supportedLanguages).toContain('th');
    });
  });

  describe('t function', () => {
    it('should translate to English by default', () => {
      const result = t('email.jobOffer.title');
      expect(result).toBe('Title');
    });

    it('should translate to specified language', () => {
      const result = t('email.jobOffer.title', { lng: 'es' });
      expect(result).toBe('Título');
    });

    it('should interpolate variables', () => {
      const result = t('email.jobOffer.subject', { jobTitle: 'Test Job' });
      expect(result).toBe('New job offer: Test Job');
    });

    it('should interpolate variables in different languages', () => {
      const result = t('email.jobOffer.greeting', { lng: 'zh', name: 'Alice' });
      expect(result).toBe('Alice，你好，');
    });
  });

  describe('getTranslator', () => {
    it('should return translator for English', () => {
      const translator = getTranslator('en');
      expect(translator('email.jobOffer.title')).toBe('Title');
      expect(translator('email.jobOffer.description')).toBe('Description');
    });

    it('should return translator for Spanish', () => {
      const translator = getTranslator('es');
      expect(translator('email.jobOffer.title')).toBe('Título');
      expect(translator('email.jobOffer.description')).toBe('Descripción');
    });

    it('should return translator for Chinese', () => {
      const translator = getTranslator('zh');
      expect(translator('email.jobOffer.title')).toBe('标题');
      expect(translator('email.jobOffer.viewOffer')).toBe('查看邀约');
    });

    it('should return translator for Filipino', () => {
      const translator = getTranslator('tl');
      expect(translator('email.jobOffer.title')).toBe('Titulo');
      expect(translator('email.jobOffer.viewOffer')).toBe('Tingnan ang Offer');
    });

    it('should return translator for Hindi', () => {
      const translator = getTranslator('hi');
      expect(translator('email.jobOffer.title')).toBe('शीर्षक');
      expect(translator('email.jobOffer.greeting', { name: 'Test' })).toBe('नमस्ते Test,');
    });

    it('should return translator for Vietnamese', () => {
      const translator = getTranslator('vi');
      expect(translator('email.jobOffer.title')).toBe('Tiêu đề');
      expect(translator('email.jobOffer.from')).toBe('Từ');
    });

    it('should return translator for Turkish', () => {
      const translator = getTranslator('tr');
      expect(translator('email.jobOffer.title')).toBe('Başlık');
      expect(translator('email.jobOffer.price')).toBe('Fiyat');
    });

    it('should return translator for Thai', () => {
      const translator = getTranslator('th');
      expect(translator('email.jobOffer.title')).toBe('ชื่อ');
      expect(translator('email.jobOffer.greeting', { name: 'Test' })).toBe('สวัสดี Test,');
    });

    it('should fallback to English for unsupported language', () => {
      const translator = getTranslator('fr'); // French not supported
      expect(translator('email.jobOffer.title')).toBe('Title');
    });

    it('should fallback to English for empty language', () => {
      const translator = getTranslator('');
      expect(translator('email.jobOffer.title')).toBe('Title');
    });

    it('should handle interpolation with options', () => {
      const translator = getTranslator('es');
      const result = translator('email.jobOffer.subject', { jobTitle: 'Desarrollador' });
      expect(result).toBe('Nueva oferta de trabajo: Desarrollador');
    });
  });

  describe('email translation keys', () => {
    const requiredKeys = [
      'email.jobOffer.subject',
      'email.jobOffer.greeting',
      'email.jobOffer.newOffer',
      'email.jobOffer.title',
      'email.jobOffer.category',
      'email.jobOffer.from',
      'email.jobOffer.price',
      'email.jobOffer.description',
      'email.jobOffer.viewOffer',
      'email.jobOffer.loginToView',
      'email.jobOffer.footer',
      'email.common.newJobOffer',
    ];

    supportedLanguages.forEach((lang) => {
      it(`should have all required keys for ${lang}`, () => {
        const translator = getTranslator(lang);
        requiredKeys.forEach((key) => {
          const result = translator(key);
          // Result should not be the key itself (means missing translation)
          expect(result).not.toBe(key);
          // Result should not be empty
          expect(result.length).toBeGreaterThan(0);
        });
      });
    });
  });
});
