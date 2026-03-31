export default function FilterBar({ filters, values, onChange, children }) {
  return (
    <div className="filter-bar">
      {filters.map((filter) => (
        <div key={filter.key} className="filter-group">
          {filter.label && <label>{filter.label}</label>}
          {filter.type === 'select' ? (
            <select
              value={values[filter.key] || ''}
              onChange={(e) => onChange(filter.key, e.target.value)}
            >
              {filter.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={filter.type || 'text'}
              value={values[filter.key] || ''}
              onChange={(e) => onChange(filter.key, e.target.value)}
              placeholder={filter.placeholder}
              min={filter.min}
              max={filter.max}
              step={filter.step}
            />
          )}
        </div>
      ))}
      {children}
    </div>
  );
}
