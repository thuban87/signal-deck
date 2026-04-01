import { describe, it, expect } from 'vitest';
import { calculateTradeResult, calculatePositionSize, calculateAnnualizedReturn } from '../src/utils/calculations';

describe('calculateTradeResult', () => {
  it('calculates P&L for dollar amount', () => {
    const result = calculateTradeResult(100, 110, 1000, 'dollars');
    expect(result.shares).toBe(10);
    expect(result.pnl).toBeCloseTo(100);
    expect(result.pnlPct).toBeCloseTo(10);
  });

  it('calculates P&L for share count', () => {
    const result = calculateTradeResult(50, 45, 20, 'shares');
    expect(result.shares).toBe(20);
    expect(result.pnl).toBeCloseTo(-100);
    expect(result.pnlPct).toBeCloseTo(-10);
  });

  it('handles zero gain', () => {
    const result = calculateTradeResult(100, 100, 500, 'dollars');
    expect(result.pnl).toBeCloseTo(0);
    expect(result.pnlPct).toBeCloseTo(0);
  });
});

describe('calculatePositionSize', () => {
  it('calculates position size with ATR', () => {
    const result = calculatePositionSize(100000, 1, 5, 100);
    expect(result.shares).toBeGreaterThan(0);
    expect(result.stopLoss).toBeLessThan(100);
    expect(result.takeProfit).toBeGreaterThan(100);
  });

  it('stop loss is below entry', () => {
    const result = calculatePositionSize(50000, 2, 3, 50);
    expect(result.stopLoss).toBeLessThan(50);
  });

  it('take profit is above entry', () => {
    const result = calculatePositionSize(50000, 2, 3, 50);
    expect(result.takeProfit).toBeGreaterThan(50);
  });
});

describe('calculateAnnualizedReturn', () => {
  it('annualizes a 10% return over 30 days', () => {
    const result = calculateAnnualizedReturn(100, 110, 30);
    expect(result).toBeGreaterThan(100); // Should be very high annualized
  });

  it('returns 0 for 0 days', () => {
    expect(calculateAnnualizedReturn(100, 110, 0)).toBe(0);
  });

  it('handles negative returns', () => {
    const result = calculateAnnualizedReturn(100, 90, 30);
    expect(result).toBeLessThan(0);
  });
});
