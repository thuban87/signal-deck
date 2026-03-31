export default function StockCard({ symbol, name, price, change, onClick, children }) {
  const changeClass = change > 0 ? 'positive' : change < 0 ? 'negative' : '';
  const changeSign = change > 0 ? '+' : '';

  return (
    <div className="card stock-card" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <div className="stock-card-header">
        <span className="stock-symbol">{symbol}</span>
        {name && <span className="stock-name">{name}</span>}
      </div>
      <div className="stock-card-price">
        <span className="price">{price != null ? `$${Number(price).toFixed(2)}` : '—'}</span>
        {change != null && (
          <span className={`change ${changeClass}`}>
            {changeSign}{Number(change).toFixed(2)}%
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
