import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { ImageLightbox, ZoomableImage } from '../components/ui/ImageLightbox';
import '../i18n';

const SRC = 'https://example.test/photo.jpg';

describe('ImageLightbox', () => {
  it('renders nothing while closed', () => {
    render(
      <MemoryRouter>
        <ImageLightbox open={false} src={SRC} alt="Profile photo" onClose={() => {}} />
      </MemoryRouter>
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens as a modal dialog when there is an image', () => {
    render(
      <MemoryRouter>
        <ImageLightbox open src={SRC} alt="Profile photo" onClose={() => {}} />
      </MemoryRouter>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByAltText('Profile photo')).toBeInTheDocument();
  });

  it('shows the current zoom level and can zoom in and back out', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ImageLightbox open src={SRC} alt="Profile photo" onClose={() => {}} />
      </MemoryRouter>
    );

    expect(screen.getByText('100%')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByText('150%')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    let closed = false;
    render(
      <MemoryRouter>
        <ImageLightbox open src={SRC} alt="Profile photo" onClose={() => { closed = true; }} />
      </MemoryRouter>
    );

    await user.keyboard('{Escape}');
    expect(closed).toBe(true);
  });

  it('closes from the close button', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    let closed = false;
    render(
      <MemoryRouter>
        <ImageLightbox open src={SRC} alt="Profile photo" onClose={() => { closed = true; }} />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Close image preview' }));
    expect(closed).toBe(true);
  });
});

describe('ZoomableImage', () => {
  it('does not offer a trigger when there is no image', () => {
    render(
      <MemoryRouter>
        <ZoomableImage src={null} alt="Missing">
          <span>initials</span>
        </ZoomableImage>
      </MemoryRouter>
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('initials')).toBeInTheDocument();
  });

  it('opens the viewer when the thumbnail is clicked', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ZoomableImage src={SRC} alt="Alice Uwase">
          <img src={SRC} alt="Alice Uwase" />
        </ZoomableImage>
      </MemoryRouter>
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Enlarge Alice Uwase' }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
  });
});