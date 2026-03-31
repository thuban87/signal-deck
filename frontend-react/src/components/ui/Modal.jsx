export default function Modal({ open, onClose, title, children }) {
  if (!open) return null;

  return (
    <div className="modal">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content">
        {title && <h3>{title}</h3>}
        {children}
      </div>
    </div>
  );
}
