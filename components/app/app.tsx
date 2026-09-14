'use client';

import { useEffect, useMemo } from 'react';
import { TokenSource } from 'livekit-client';
import { useSession } from '@livekit/components-react';
import { WarningIcon } from '@phosphor-icons/react/dist/ssr';
import { AgentSessionProvider } from '@/components/agents-ui/agent-session-provider';
import { StartAudioButton } from '@/components/agents-ui/start-audio-button';
import { DesktopTitlebar } from '@/components/app/desktop-titlebar';
import { LanguageProvider, useLanguage } from '@/components/app/language-context';
import { ViewController } from '@/components/app/view-controller';
import { Toaster } from '@/components/ui/sonner';
import { useAgentErrors } from '@/hooks/useAgentErrors';
import { useDebugMode } from '@/hooks/useDebug';

const IN_DEVELOPMENT = process.env.NODE_ENV !== 'production';

function AppSetup() {
  useDebugMode({ enabled: IN_DEVELOPMENT });
  useAgentErrors();

  return null;
}

interface AppProps {
  agentName?: string;
}

function AppContent({ agentName }: AppProps) {
  const { t, language } = useLanguage();
  const tokenSource = useMemo(() => TokenSource.endpoint('/api/token'), []);

  const normalizedAgentName = useMemo(() => {
    return agentName && agentName.trim() ? agentName.trim() : undefined;
  }, [agentName]);

  const sessionOptions = useMemo(
    () => ({
      agentName: normalizedAgentName,
      participantMetadata: JSON.stringify({ language }),
      participantAttributes: { language },
      agentMetadata: JSON.stringify({ language }),
      agentConnectTimeoutMilliseconds: 30_000,
    }),
    [normalizedAgentName, language]
  );

  const session = useSession(tokenSource, sessionOptions);

  // Apply hardware DSP audio capture defaults to the session room
  useEffect(() => {
    if (session.room?.options) {
      session.room.options.audioCaptureDefaults = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        voiceIsolation: true,
      };
    }
  }, [session.room]);

  return (
    <AgentSessionProvider session={session}>
      <DesktopTitlebar />
      <AppSetup />
      <main className="relative flex min-h-svh w-full flex-col justify-center">
        <ViewController />
      </main>
      <StartAudioButton label={t.startAudio} />
      <Toaster
        icons={{
          warning: <WarningIcon weight="bold" />,
        }}
        position="top-center"
        className="toaster group"
        style={
          {
            '--normal-bg': 'var(--popover)',
            '--normal-text': 'var(--popover-foreground)',
            '--normal-border': 'var(--border)',
          } as React.CSSProperties
        }
      />
    </AgentSessionProvider>
  );
}

export function App({ agentName }: AppProps) {
  return (
    <LanguageProvider>
      <AppContent agentName={agentName} />
    </LanguageProvider>
  );
}
