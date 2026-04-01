import { describe, it, expect } from 'vitest';
import { formatPrice, formatChange, formatDate, rsiClass, directionClass, formatNumber } from '../src/utils/formatters';

describe('formatPrice', () => {
  it('formats a price with dollar sign', () => {
    expect(formatPrice(123.456)).toBe('$123.46');
  });
  it('returns dash for null', () => {
    expect(formatPrice(null)).toBe('—');
  });
  it('returns dash for undefined', () => {
    expect(formatPrice(undefined)).toBe('—');
  });
  it('formats zero', () => {
    expect(formatPrice(0)).toBe('$0.00');
  });
});

describe('formatChange', () => {
  it('formats positive change with plus sign', () => {
    expect(formatChange(2.5)).toBe('+2.50%');
  });
  it('formats negative change', () => {
    expect(formatChange(-1.75)).toBe('-1.75%');
  });
  it('returns dash for null', () => {
    expect(formatChange(null)).toBe('—');
  });
  it('formats zero', () => {
    expect(formatChange(0)).toBe('+0.00%');
  });
});

describe('formatDate', () => {
  it('formats a date string', () => {
    expect(formatDate('2024-01-15')).toBe('Jan 15');
  });
  it('returns dash for null', () => {
    expect(formatDate(null)).toBe('—');
  });
  it('returns dash for empty string', () => {
    expect(formatDate('')).toBe('—');
  });
});

describe('rsiClass', () => {
  it('returns oversold for RSI < 30', () => {
    expect(rsiClass(25)).toBe('oversold');
  });
  it('returns overbought for RSI > 70', () => {
    expect(rsiClass(75)).toBe('overbought');
  });
  it('returns neutral for RSI in range', () => {
    expect(rsiClass(50)).toBe('neutral');
  });
  it('returns neutral for null', () => {
    expect(rsiClass(null)).toBe('neutral');
  });
});

describe('directionClass', () => {
  it('returns sell for short', () => {
    expect(directionClass('short')).toBe('sell');
  });
  it('returns sell for sell', () => {
    expect(directionClass('sell')).toBe('sell');
  });
  it('returns buy for long', () => {
    expect(directionClass('long')).toBe('buy');
  });
  it('returns buy for buy', () => {
    expect(directionClass('buy')).toBe('buy');
  });
});

describe('formatNumber', () => {
  it('formats billions', () => {
    expect(formatNumber(2500000000)).toBe('2.5B');
  });
  it('formats millions', () => {
    expect(formatNumber(1200000)).toBe('1.2M');
  });
  it('formats thousands', () => {
    expect(formatNumber(5600)).toBe('5.6K');
  });
  it('returns dash for null', () => {
    expect(formatNumber(null)).toBe('—');
  });
});
