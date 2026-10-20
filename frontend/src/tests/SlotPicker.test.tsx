import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { SlotPicker } from '../components/appointments/SlotPicker';
import { StatusBadge } from '../components/appointments/StatusBadge';
import '../i18n';

describe('SlotPicker', () => {
  it('renders available slots as buttons', () => {
    render(
      <SlotPicker
        slots={[
          { time: '09:00', label: '09:00', capacity: 1, available: 1 },
          { time: '09:30', label: '09:30', capacity: 1, available: 1 },
        ]}
        selected={undefined}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByRole('option', { name: '09:00' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '09:30' })).toBeInTheDocument();
  });

  it('disables fully booked slots', () => {
    render(
      <SlotPicker
        slots={[{ time: '09:00', label: '09:00', capacity: 1, available: 0 }]}
        selected={undefined}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByRole('option', { name: '09:00' })).toBeDisabled();
  });

  it('shows a message when there are no slots', () => {
    render(<SlotPicker slots={[]} selected={undefined} onSelect={vi.fn()} />);
    expect(screen.getByText(/No available slots/i)).toBeInTheDocument();
  });

  it('calls onSelect when an available slot is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <SlotPicker
        slots={[{ time: '10:00', label: '10:00', capacity: 1, available: 1 }]}
        selected={undefined}
        onSelect={onSelect}
      />
    );
    await user.click(screen.getByRole('option', { name: '10:00' }));
    expect(onSelect).toHaveBeenCalledWith('10:00');
  });
});

describe('StatusBadge', () => {
  it('renders the translated status', () => {
    render(<StatusBadge status="Confirmed" />);
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
  });
});
