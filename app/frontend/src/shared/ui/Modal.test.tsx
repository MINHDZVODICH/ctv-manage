// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { Modal } from './Modal';

afterEach(cleanup);

it('closes on Escape, traps focus, and restores the trigger focus', async () => {
  const onClose = vi.fn();
  const user = userEvent.setup();
  render(<><button type="button">Mở</button><Modal isOpen title="Hộp thoại kiểm thử" onClose={onClose}><button type="button">Đầu</button><button type="button">Cuối</button></Modal></>);

  const trigger = screen.getByRole('button', { name: 'Mở' });
  trigger.focus();
  const dialog = screen.getByRole('dialog', { name: 'Hộp thoại kiểm thử' });
  expect(dialog).toHaveAttribute('aria-modal', 'true');
  expect(document.body.style.overflow).toBe('hidden');
  await user.tab();
  expect(screen.getByRole('button', { name: 'Đầu' })).toHaveFocus();
  await user.tab();
  expect(screen.getByRole('button', { name: 'Cuối' })).toHaveFocus();
  await user.tab();
  expect(screen.getByRole('button', { name: 'Đầu' })).toHaveFocus();
  await user.keyboard('{Escape}');
  expect(onClose).toHaveBeenCalledOnce();
});

it('does not render closed content or lock scrolling', () => {
  render(<Modal isOpen={false} title="Không hiển thị" onClose={() => undefined}>Nội dung</Modal>);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(document.body.style.overflow).toBe('');
});
