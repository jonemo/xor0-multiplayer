/** Top-level view router + auth provider. */
import { useState } from 'react';
import { AuthProvider } from './auth/AuthProvider';
import { Home } from './screens/Home';
import { SoloGame } from './screens/SoloGame';
import { MultiplayerGame } from './screens/MultiplayerGame';
import type { Difficulty } from './lib/xor';

type View =
  | { name: 'home' }
  | { name: 'solo'; difficulty: Difficulty }
  | { name: 'game'; gameId: string };

export function App() {
  const [view, setView] = useState<View>({ name: 'home' });
  const home = () => setView({ name: 'home' });

  return (
    <AuthProvider>
      {view.name === 'solo' ? (
        <SoloGame key={view.difficulty} difficulty={view.difficulty} onExit={home} />
      ) : view.name === 'game' ? (
        <MultiplayerGame key={view.gameId} gameId={view.gameId} onExit={home} />
      ) : (
        <Home
          onStartSolo={(difficulty) => setView({ name: 'solo', difficulty })}
          onEnterGame={(gameId) => setView({ name: 'game', gameId })}
        />
      )}
    </AuthProvider>
  );
}
