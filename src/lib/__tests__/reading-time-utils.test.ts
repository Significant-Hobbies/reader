import { describe, expect, it } from 'vitest';

import { formatReadingTime } from '../reading-time-utils';

describe('formatReadingTime', () => {
  it('returns "< 1 min read" for undefined input', () => {
    expect(formatReadingTime(undefined)).toBe('< 1 min read');
  });

  it('returns "< 1 min read" for 0 minutes', () => {
    expect(formatReadingTime(0)).toBe('< 1 min read');
  });

  it('returns "< 1 min read" for negative values', () => {
    expect(formatReadingTime(-5)).toBe('< 1 min read');
  });

  it('formats single minute correctly', () => {
    expect(formatReadingTime(1)).toBe('1 min read');
  });

  it('formats multiple minutes correctly', () => {
    expect(formatReadingTime(5)).toBe('5 min read');
    expect(formatReadingTime(15)).toBe('15 min read');
    expect(formatReadingTime(59)).toBe('59 min read');
  });

  it('formats exactly 60 minutes as hours', () => {
    expect(formatReadingTime(60)).toBe('1 hr read');
  });

  it('formats hours with remaining minutes', () => {
    expect(formatReadingTime(90)).toBe('1 hr 30 min read');
    expect(formatReadingTime(75)).toBe('1 hr 15 min read');
  });

  it('formats multiple hours correctly', () => {
    expect(formatReadingTime(120)).toBe('2 hr read');
    expect(formatReadingTime(180)).toBe('3 hr read');
  });

  it('formats multiple hours with remaining minutes', () => {
    expect(formatReadingTime(125)).toBe('2 hr 5 min read');
    expect(formatReadingTime(200)).toBe('3 hr 20 min read');
  });
});
