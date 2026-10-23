import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Puts the viewport back at the top whenever the route changes.
 *
 * React Router keeps the previous scroll offset when the path changes, so landing on a new page
 * shows it half-way down — which is how a long form ended up with its first field off-screen and
 * its actions off-screen as well.
 *
 * Two details matter here:
 *
 *  - `behavior: 'instant'`. `index.css` sets `scroll-behavior: smooth` on `html`, and a plain
 *    `window.scrollTo({ top: 0 })` inherits that, which turns the reset into a slow animation the
 *    user watches scroll away instead of a jump.
 *  - `data-scroll-root`. Layouts that scroll their own `<main>` element (rather than the document)
 *    are marked with that attribute so their offset is reset too; without it the reset would look
 *    like it did nothing.
 */
export function ScrollToTop() {
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const target = document.getElementById(hash.slice(1));
      if (target) {
        target.scrollIntoView({ block: 'start' });
        return;
      }
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    document.querySelectorAll<HTMLElement>('[data-scroll-root]').forEach((el) => {
      el.scrollTop = 0;
    });
  }, [pathname, search, hash]);

  return null;
}
