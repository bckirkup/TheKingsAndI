import type { ReactNode } from 'react';

import { tacticalBlueprintTokens } from '../ui/theme/tacticalBlueprint';

import './tacticalBlueprint.css';

export function ThemeProvider({
  children,
}: {
  readonly children: ReactNode;
}): JSX.Element {
  const style = Object.fromEntries(
    Object.entries(tacticalBlueprintTokens),
  ) as React.CSSProperties;

  return (
    <div className="theme-tactical-blueprint" style={style}>
      {children}
    </div>
  );
}
