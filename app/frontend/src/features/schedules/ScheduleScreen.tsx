import { CTVScheduleWorkspace } from './CTVScheduleWorkspace';

export function ScheduleScreen() {
  return (
    <section className="feature-screen schedule-screen">
      <div className="screen-heading"><p className="eyebrow">Không gian làm việc</p><h1>Lịch làm việc của tôi</h1></div>
      <CTVScheduleWorkspace />
    </section>
  );
}
