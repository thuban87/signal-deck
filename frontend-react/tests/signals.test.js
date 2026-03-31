import { describe, it, expect } from 'vitest';
import { getActionRecommendation } from '../src/utils/signals';

describe('getActionRecommendation', () => {
  it('returns HIGH BUY in uptrend with 1 strong + 1 support', () => {
    const result = getActionRecommendation({
      strong_bullish: 1, support_bullish: 1, strong_bearish: 0, support_bearish: 0, trend: 'uptrend',
    });
    expect(result.action).toBe('BUY');
    expect(result.confidence).toBe('HIGH');
  });

  it('returns HIGH BUY with 2+ strong bullish', () => {
    const result = getActionRecommendation({
      strong_bullish: 2, support_bullish: 0, strong_bearish: 0, support_bearish: 0, trend: 'neutral',
    });
    expect(result.action).toBe('BUY');
    expect(result.confidence).toBe('HIGH');
  });

  it('returns MEDIUM BUY with 1 strong + 2 support', () => {
    const result = getActionRecommendation({
      strong_bullish: 1, support_bullish: 2, strong_bearish: 0, support_bearish: 0, trend: 'neutral',
    });
    expect(result.action).toBe('BUY');
    expect(result.confidence).toBe('MEDIUM');
  });

  it('returns LOW BUY with 1 strong + 1 support (not uptrend)', () => {
    const result = getActionRecommendation({
      strong_bullish: 1, support_bullish: 1, strong_bearish: 0, support_bearish: 0, trend: 'neutral',
    });
    expect(result.action).toBe('BUY');
    expect(result.confidence).toBe('LOW');
  });

  it('returns HIGH SELL in downtrend with 1 strong + 1 support bearish', () => {
    const result = getActionRecommendation({
      strong_bullish: 0, support_bullish: 0, strong_bearish: 1, support_bearish: 1, trend: 'downtrend',
    });
    expect(result.action).toBe('SELL');
    expect(result.confidence).toBe('HIGH');
  });

  it('returns HOLD when no clear signals', () => {
    const result = getActionRecommendation({
      strong_bullish: 0, support_bullish: 0, strong_bearish: 0, support_bearish: 0, trend: 'neutral',
    });
    expect(result.action).toBe('HOLD');
  });

  it('defaults missing fields', () => {
    const result = getActionRecommendation({});
    expect(result.action).toBe('HOLD');
    expect(result.confidence).toBe('LOW');
  });
});
