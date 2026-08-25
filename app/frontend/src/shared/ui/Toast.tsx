export function Toast({ message, onClose }: { message: string; onClose?: () => void }) {
  return <div className="success-notice" role="status"><span>{message}</span>{onClose && <button type="button" aria-label="Đóng thông báo" onClick={onClose}>×</button>}</div>;
}
