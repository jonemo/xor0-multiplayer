/** Top-level view router + auth provider. */
import { useState } from 'react';
import { AuthProvider } from './auth/AuthProvider';
import { Home } from './screens/Home';
import { SoloGame } from './screens/SoloGame';
import { MultiplayerGame } from './screens/MultiplayerGame';
import { AiGame, type BotSkill } from './screens/AiGame';
import type { Difficulty } from './lib/xor';

type View =
  | { name: 'home' }
  | { name: 'solo'; difficulty: Difficulty }
  | { name: 'ai'; difficulty: Difficulty; botCount: number; skill: BotSkill }
  | { name: 'game'; gameId: string };

export function App() {
  const [view, setView] = useState<View>({ name: 'home' });
  const home = () => setView({ name: 'home' });

  return (
    <AuthProvider>
      {view.name === 'solo' ? (
        <SoloGame key={view.difficulty} difficulty={view.difficulty} onExit={home} />
      ) : view.name === 'ai' ? (
        <AiGame
          key={`${view.difficulty}-${view.botCount}-${view.skill}`}
          difficulty={view.difficulty}
          botCount={view.botCount}
          skill={view.skill}
          onExit={home}
        />
      ) : view.name === 'game' ? (
        <MultiplayerGame key={view.gameId} gameId={view.gameId} onExit={home} />
      ) : (
        <Home
          onStartSolo={(difficulty) => setView({ name: 'solo', difficulty })}
          onStartAi={(difficulty, botCount, skill) =>
            setView({ name: 'ai', difficulty, botCount, skill })
          }
          onEnterGame={(gameId) => setView({ name: 'game', gameId })}
        />
      )}
    </AuthProvider>
  );
}
