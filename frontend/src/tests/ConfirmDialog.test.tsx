import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

/**
 * The logout confirmation is rendered inside layout headers and sidebars, and those carry
 * `backdrop-blur` and fixed z-index stacking — either of which traps a plain fixed overlay
 * and made the dialog appear nowhere. The contract: it always lands on <body>, never inside
 * its React parent.
 */
describe('ConfirmDialog', () => {
  it('renders into document.body, outside a blurred header', () => {
    render(
      <div data-testid="blurred-header" className="backdrop-blur-xl">
        <ConfirmDialog
          open
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          title="Log out of HAS?"
          message="You will need to sign in again."
        />
      </div>,
    );

    const dialog = screen.getByRole('alertdialog');
    expect(document.body.contains(dialog)).toBe(true);
    expect(dialog.closest('[data-testid="blurred-header"]')).toBeNull();
  });

  it('renders nothing at all when closed', () => {
    render(
      <ConfirmDialog
        open={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Log out of HAS?"
        message="You will need to sign in again."
      />,
    );

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
