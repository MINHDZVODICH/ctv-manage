export function LoadingState({ label = 'Đang tải dữ liệu...' }: { label?: string }) {
  return <p className="loading-state" aria-live="polite">{label}</p>;
}
