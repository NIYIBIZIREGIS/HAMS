import { createContext, useContext } from 'react';

/**
 * How tightly fields are packed.
 *
 * `default` is the app-wide field size. `compact` is for form modals: it drops the label and
 * control spacing by a step so a label-plus-control field is roughly 60px tall instead of 78px,
 * and a long form then fits the viewport instead of running past it with its actions below the
 * fold.
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
