export function calculateTradeResult(entryPrice, exitPrice, amount, amountType = 'dollars') {
  const shares = amountType === 'dollars' ? amount / entryPrice : amount;
  const invested = shares * entryPrice;
  const exitValue = shares * exitPrice;
  const pnl = exitValue - invested;
  const pnlPct = ((exitPrice - entryPrice) / entryPrice) * 100;

  return { shares, invested, exitValue, pnl, pnlPct };
}

export function calculatePositionSize(accountSize, riskPct, atr, entryPrice) {
  const riskPerShare = atr * 1.5;
  const riskAmount = accountSize * (riskPct / 100);
  const shares = Math.floor(riskAmount / riskPerShare);
  const stopLoss = entryPrice - riskPerShare;
  const takeProfit = entryPrice + atr * 2.5;
  const stopLossPct = Math.max((riskPerShare / entryPrice) * 100, 1.0);
  const takeProfitPct = Math.max((atr * 2.5 / entryPrice) * 100, 1.5);

  return { shares, stopLoss, takeProfit, riskPerShare, stopLossPct, takeProfitPct };
}

export function calculateAnnualizedReturn(entryPrice, exitPrice, daysHeld) {
  if (daysHeld <= 0) return 0;
  const totalReturn = (exitPrice - entryPrice) / entryPrice;
  return (Math.pow(1 + totalReturn, 365 / daysHeld) - 1) * 100;
}
