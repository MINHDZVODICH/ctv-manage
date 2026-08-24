import type { RegistrationRequestDetail } from './useRegistrationRequests';

interface ViewRequestModalProps {
  request: RegistrationRequestDetail | null;
  isLoading: boolean;
  error: string | null;
  isDeciding: boolean;
  onClose: () => void;
  onDecision: (decision: 'APPROVED' | 'REJECTED') => void;
}

export function ViewRequestModal({ request, isLoading, error, isDeciding, onClose, onDecision }: ViewRequestModalProps) {
  return (
    <div className="dialog-backdrop">
      <section className="request-dialog" role="dialog" aria-modal="true" aria-label="Chi tiết hồ sơ đăng ký CTV">
        <header>
          <div><p className="eyebrow">Hồ sơ Cộng tác viên</p><h2>{request?.displayName ?? 'Đang tải hồ sơ...'}</h2></div>
          <button type="button" aria-label="Đóng chi tiết hồ sơ" onClick={onClose}>×</button>
        </header>
        {isLoading && <p aria-live="polite">Đang tải chi tiết...</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {request && (
          <div className="request-detail-grid">
            <Detail label="Email" value={request.email} />
            <Detail label="Số điện thoại" value={request.phone ?? 'Chưa cung cấp'} />
            <Detail label="Ngày sinh" value={request.dateOfBirth ?? 'Chưa cung cấp'} />
            <Detail label="Giới tính" value={request.gender ?? 'Chưa cung cấp'} />
            <Detail label="Địa chỉ" value={request.address ?? 'Chưa cung cấp'} />
            <section className="request-files">
              <h3>Hồ sơ đính kèm</h3>
              {request.files.length === 0 && <p>Không có tệp đính kèm.</p>}
              {request.files.map((file) => (
                <a key={file.id} href={`/api/v1/files/${file.id}/content`} target="_blank" rel="noreferrer">
                  {file.originalName} · {formatBytes(file.sizeBytes)}
                </a>
              ))}
            </section>
          </div>
        )}
        <footer>
          <button type="button" className="reject-action" disabled={!request || isDeciding} onClick={() => onDecision('REJECTED')}>Từ chối hồ sơ</button>
          <button type="button" className="approve-action" disabled={!request || isDeciding} onClick={() => onDecision('APPROVED')}>Phê duyệt</button>
        </footer>
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <p><strong>{label}</strong><span>{value}</span></p>;
}

function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
