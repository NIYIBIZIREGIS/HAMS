import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import '../i18n';

/** The class the compact label treatment is applied through. */
const compactLabel = 'mb-1 block text-xs font-medium text-text-main';
const defaultLabel = 'mb-1.5 block text-sm font-medium text-text-main';

describe('Modal', () => {
  it('renders nothing while closed', () => {
    render(
      <Modal open={false} onClose={vi.fn()} title="Hidden">
        <p>Body</p>
      </Modal>
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('exposes the title as the dialog label', () => {
    render(
      <Modal open onClose={vi.fn()} title="Edit Patient">
        <p>Body</p>
      </Modal>
    );
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Edit Patient');
  });

  it('closes on the close button', async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Edit Patient">
        <p>Body</p>
      </Modal>
    );
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape and locks body scroll while open', async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Edit Patient">
        <p>Body</p>
      </Modal>
    );
    expect(document.body.style.overflow).toBe('hidden');
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders the footer outside the scrolling body', () => {
    render(
      <Modal
        open
        onClose={vi.fn()}
        title="Edit Patient"
        footer={<button type="button">Save Changes</button>}
      >
        <p>Body</p>
      </Modal>
    );
    const dialog = screen.getByRole('dialog');
    const scroller = dialog.querySelector('.overflow-y-auto');
    const action = screen.getByRole('button', { name: 'Save Changes' });
    // The action must sit inside the dialog but outside the scroll container, otherwise "Save"
    // scrolls away on a long form.
    expect(dialog).toContainElement(action);
    expect(scroller?.contains(action)).toBe(false);
  });

  it('omits the footer strip when no footer is given', () => {
    render(
      <Modal open onClose={vi.fn()} title="Patient Details">
        <p>Body</p>
      </Modal>
    );
    const dialog = screen.getByRole('dialog');
    const scroller = dialog.querySelector('.overflow-y-auto');
    expect(scroller).not.toBeNull();
    expect(scroller?.querySelector('button')).toBeNull();
  });
});

describe('Modal density', () => {
  it('leaves fields at the default size when density is not set', () => {
    render(
      <Modal open onClose={vi.fn()} title="Patient Details">
        <Input label="Email" value="" onChange={vi.fn()} />
        <Select label="Gender" options={[]} value="" onChange={vi.fn()} />
      </Modal>
    );
    expect(screen.getByText('Email')).toHaveClass(defaultLabel);
    expect(screen.getByText('Gender')).toHaveClass(defaultLabel);
  });

  it('packs every field into the compact treatment when density="compact"', () => {
    render(
      <Modal open onClose={vi.fn()} title="Register" density="compact">
        <Input label="Email" value="" onChange={vi.fn()} />
        <Select label="Gender" options={[]} value="" onChange={vi.fn()} />
      </Modal>
    );
    expect(screen.getByText('Email')).toHaveClass(compactLabel);
    expect(screen.getByText('Gender')).toHaveClass(compactLabel);
  });

  it('lets an explicit field density override the inherited one', () => {
    render(
      <Modal open onClose={vi.fn()} title="Register" density="compact">
        <Input label="Email" value="" onChange={vi.fn()} density="default" />
      </Modal>
    );
    expect(screen.getByText('Email')).toHaveClass(defaultLabel);
  });
});
