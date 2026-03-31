import { useQuery } from '@tanstack/react-query';
import { get } from '../../api/client';
import { Link } from 'react-router-dom';
import { formatChange } from '../../utils/formatters';

export default function RelatedStocksWidget({ symbol }) {
  const { data: response, isLoading } = useQuery({
    queryKey: ['peers', symbol],
    queryFn: () => get(`/api/stock/${symbol}/peers`),
    staleTime: 10 * 60 * 1000,
  });

  const peerList = response?.peers || response;

  if (isLoading) return <div className="loading-text">Loading peers...</div>;
  if (!peerList || !Array.isArray(peerList) || peerList.length === 0) return <div className="text-muted" style={{ padding: 12, fontSize: '0.85rem' }}>No related stocks found</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
      {peerList.map(p => (
        <Link key={p.symbol} to={`/stock/${p.symbol}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', borderRadius: 4, textDecoration: 'none', color: 'inherit', fontSize: '0.85rem' }} className="related-stock-item">
          <span><strong>{p.symbol}</strong>{p.name && <span className="text-muted" style={{ marginLeft: 6 }}>{p.name}</span>}</span>
          <span className={(p.change_pct || 0) >= 0 ? 'text-green' : 'text-red'}>{formatChange(p.change_pct)}</span>
        </Link>
      ))}
    </div>
  );
}
