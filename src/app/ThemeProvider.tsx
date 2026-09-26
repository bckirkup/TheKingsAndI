import type { ReactNode } from 'react';

import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';

import {
  TACTICAL_BLUEPRINT_PACK_ID,
  tacticalBlueprintTokens,
} from '../ui/theme/tacticalBlueprint';

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
    <div
      className="theme-tactical-blueprint"
      data-pack={TACTICAL_BLUEPRINT_PACK_ID}
      style={style}
    >
      {children}
    </div>
  );
}
