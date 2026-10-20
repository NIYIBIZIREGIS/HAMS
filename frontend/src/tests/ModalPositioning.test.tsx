import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

function overlayOf(dialog: HTMLElement): HTMLElement {
  return dialog.parentElement as HTMLElement;
}

describe('modal vertical positioning', () => {
  it('places the shared Modal 40px from the top, still horizontally centered', () => {
    render(
      <Modal isOpen onClose={() => undefined} title="Add Doctor">
        <p>Body</p>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Add Doctor' });
    const overlay = overlayOf(dialog);

    expect(overlay.className).toContain('pt-10');
    expect(overlay.className).toContain('items-start');
    expect(overlay.className).toContain('justify-center');
    expect(overlay.className).not.toContain('items-center');
  });

  it('caps the shared Modal to the viewport so it cannot extend below the fold', () => {
    render(
      <Modal isOpen onClose={() => undefined} title="Add Doctor">
        <p>Body</p>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Add Doctor' });

    expect(dialog.className).toContain('max-h-[calc(100dvh-3.5rem)]');
    expect(dialog.className).toContain('flex-col');
    expect(overlayOf(dialog).className).toContain('overflow-hidden');
  });

  it('keeps the header and footer fixed while the body scrolls', () => {
    render(
      <Modal isOpen onClose={() => undefined} title="Add Doctor" footer={<button type="button">Save</button>}>
        <p>Body</p>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Add Doctor' });
    const [, body, footer] = Array.from(dialog.children);

    expect(body.className).toContain('overflow-y-auto');
    expect(body.className).toContain('min-h-0');
    expect(body.className).not.toContain('shrink-0');
    expect(footer.className).toContain('shrink-0');
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('applies the same top-aligned, viewport-capped layout to confirmation dialogs', () => {
    render(
      <ConfirmDialog
        open
        onClose={() => undefined}
        onConfirm={() => undefined}
        title="Delete user"
        message="This cannot be undone."
      />,
    );
    const dialog = screen.getByRole('alertdialog', { name: 'Delete user' });
    const overlay = overlayOf(dialog);
    const [header, body, footer] = Array.from(dialog.children);

    expect(overlay.className).toContain('pt-10');
    expect(overlay.className).toContain('items-start');
    expect(overlay.className).not.toContain('items-center');
    expect(dialog.className).toContain('max-h-[calc(100dvh-3.5rem)]');
    expect(header.className).toContain('shrink-0');
    expect(body.className).toContain('overflow-y-auto');
    expect(body.className).toContain('min-h-0');
    expect(footer.className).toContain('shrink-0');
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
  });
});
