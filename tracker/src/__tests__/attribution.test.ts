import { describe, expect, it } from 'vitest';
import { parseRef } from '../state/telemetry';
import { shareResultLink } from '../domain/plateau';

describe('parseRef', () => {
  it('reads ?ref= before the hash', () => {
    expect(parseRef('?ref=reddit', '#/welcome')).toBe('reddit');
  });
  it('reads ?ref= inside the hash route', () => {
    expect(parseRef('', '#/welcome?ref=ig')).toBe('ig');
  });
  it('prefers the query before the hash when both are present', () => {
    expect(parseRef('?ref=wa', '#/app/plateau-check?ref=share')).toBe('wa');
  });
  it('lowercases, strips odd characters and caps the length', () => {
    expect(parseRef('?ref=Gym-Anytime_Fitness!<b>')).toBe('gym-anytimefitnessb');
    expect(parseRef(`?ref=${'a'.repeat(60)}`)).toHaveLength(40);
  });
  it('returns null when there is no usable ref', () => {
    expect(parseRef('', '#/')).toBeNull();
    expect(parseRef('?ref=%%%')).toBeNull();
    expect(parseRef('?utm_source=x')).toBeNull();
  });
});

describe('shareResultLink', () => {
  it('opens WhatsApp with the headline and a tagged link back to the check', () => {
    const link = shareResultLink({}, 'https://peakx.live/');
    expect(link.startsWith('https://wa.me/?text=')).toBe(true);
    const text = decodeURIComponent(link.slice('https://wa.me/?text='.length));
    expect(text).toContain('No clear cause yet');
    expect(text).toContain('https://peakx.live/?ref=share#/app/plateau-check');
  });
});
