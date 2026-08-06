import { MatchScreen } from './MatchScreen';
import { ThemeProvider } from './ThemeProvider';

export function App(): JSX.Element {
  return (
    <ThemeProvider>
      <MatchScreen seed={42} />
    </ThemeProvider>
  );
}
