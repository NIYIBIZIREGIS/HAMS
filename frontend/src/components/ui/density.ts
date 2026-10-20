import { createContext, useContext } from 'react';

/**
 * How tightly fields are packed.
 *
 * `default` is the app-wide field size. `compact` is for form modals: this theme redefines the
 * type scale so `text-sm` renders at 16px, which makes a label-plus-control field roughly 78px
 * tall, and a long form then runs past the viewport with its actions below the fold.
 *
 * `Modal` publishes this and `Input`/`Select` consume it, so a modal opts its whole subtree into
 * the dense treatment in one place instead of every field carrying a prop. An explicit `density`
 * prop on a field still wins.
 */
export type Density = 'default' | 'compact';

export const DensityContext = createContext<Density>('default');

export function useDensity(): Density {
  return useContext(DensityContext);
}
