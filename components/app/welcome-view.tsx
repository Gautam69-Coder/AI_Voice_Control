'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Scanner } from '@/components/ui/scanner';
import { useLanguage } from '@/components/app/language-context';
import { LanguageToggle } from '@/components/app/language-toggle';
import { Sparkles, Terminal, Mic } from 'lucide-react';
import { cn } from '@/lib/shadcn/utils';

function WelcomeImage() {
  return (
    <div className="relative mb-3 flex items-center justify-center">
      <div className="absolute -inset-2 rounded-full bg-primary/20 blur-lg" />
      <svg
        width="56"
        height="56"
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative text-foreground transition-transform duration-300 hover:scale-105"
      >
        <path
          d="M15 24V40C15 40.7957 14.6839 41.5587 14.1213 42.1213C13.5587 42.6839 12.7956 43 12 43C11.2044 43 10.4413 42.6839 9.87868 42.1213C9.31607 41.5587 9 40.7957 9 40V24C9 23.2044 9.31607 22.4413 9.87868 21.8787C10.4413 21.3161 11.2044 21 12 21C12.7956 21 13.5587 21.3161 14.1213 21.8787C14.6839 22.4413 15 23.2044 15 24ZM22 5C21.2044 5 20.4413 5.31607 19.8787 5.87868C19.3161 6.44129 19 7.20435 19 8V56C19 56.7957 19.3161 57.5587 19.8787 58.1213C20.4413 58.6839 21.2044 59 22 59C22.7956 59 23.5587 58.6839 24.1213 58.1213C24.6839 57.5587 25 56.7957 25 56V8C25 7.20435 24.6839 6.44129 24.1213 5.87868C23.5587 5.31607 22.7956 5 22 5ZM32 13C31.2044 13 30.4413 13.3161 29.8787 13.8787C29.3161 14.4413 29 15.2044 29 16V48C29 48.7957 29.3161 49.5587 29.8787 50.1213C30.4413 50.6839 31.2044 51 32 51C32.7956 51 33.5587 50.6839 34.1213 50.1213C34.6839 49.5587 35 48.7957 35 48V16C35 15.2044 34.6839 14.4413 34.1213 13.8787C33.5587 13.3161 32.7956 13 32 13ZM42 21C41.2043 21 40.4413 21.3161 39.8787 21.8787C39.3161 22.4413 39 23.2044 39 24V40C39 40.7957 39.3161 41.5587 39.8787 42.1213C40.4413 42.6839 41.2043 43 42 43C42.7957 43 43.5587 42.6839 44.1213 42.1213C44.6839 41.5587 45 40.7957 45 40V24C45 23.2044 44.6839 22.4413 44.1213 21.8787C43.5587 21.3161 42.7957 21 42 21ZM52 17C51.2043 17 50.4413 17.3161 49.8787 17.8787C49.3161 18.4413 49 19.2044 49 20V44C49 44.7957 49.3161 45.5587 49.8787 46.1213C50.4413 46.6839 51.2043 47 52 47C52.7957 47 53.5587 46.6839 54.1213 46.1213C54.6839 45.5587 55 44.7957 55 44V20C55 19.2044 54.6839 18.4413 54.1213 17.8787C53.5587 17.3161 52.7957 17 52 17Z"
          fill="currentColor"
        />
      </svg>
    </div>
  );
}

interface WelcomeViewProps {
  startButtonText?: string;
  onStartCall: () => void;
}

export const WelcomeView = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'> & WelcomeViewProps>(
  ({ startButtonText, onStartCall, className, ...props }, ref) => {
    const { t, language } = useLanguage();

    const effectiveButtonText = startButtonText || t.startCall;

    return (
      <div
        ref={ref}
        className={cn('relative min-h-svh w-full overflow-hidden flex flex-col justify-between py-6 px-4', className)}
        {...props}
      >
        {/* React Bits Scanner Background */}
        <div className="absolute inset-0 z-0 pointer-events-auto">
          <Scanner
            color1="#5227FF"
            color2="#FF9FFC"
            color3="#FFFFFF"
            speed={0.4}
            sweepSpeed={0.22}
            sweepWidth={1.6}
            sweepFalloff={5.5}
            scale={1.5}
            frequency={2.0}
            ripple={0.22}
            bandDensity={11}
            lineSharpness={5.5}
            glow={0.24}
            scanDirection="vertical"
            colorSpread={0.7}
            brightness={1.05}
            contrast={1.18}
            softness={1.4}
            vignette={0.45}
            scanline={true}
            grain={true}
            grainIntensity={0.05}
            opacity={0.88}
            mouseInteraction={true}
            mouseRadius={0.55}
            mouseStrength={0.55}
            className="w-full h-full"
          />
        </div>

        {/* Ambient Top Navigation Bar */}
        <header className="relative z-10 flex w-full items-center justify-between max-w-5xl mx-auto pointer-events-auto">
          <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3.5 py-1.5 text-xs font-medium text-foreground backdrop-blur-md shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="hidden sm:inline text-muted-foreground font-mono">{t.liveStatus}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              <Sparkles className="size-2.5" />
              {t.scannerBadge}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <LanguageToggle />
          </div>
        </header>

        {/* Center Main Hero Card with Glassmorphism */}
        <main className="relative z-10 my-auto flex flex-col items-center justify-center pointer-events-auto py-8">
          <section className="w-full max-w-2xl rounded-3xl border border-border/50 bg-background/75 dark:bg-background/70 p-6 sm:p-10 backdrop-blur-xl shadow-2xl flex flex-col items-center text-center transition-all duration-300">
            <WelcomeImage />

            <h1 className="text-foreground max-w-lg pt-1 text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">
              {t.title}
            </h1>

            <p className="text-muted-foreground mt-2 max-w-md text-xs sm:text-sm leading-relaxed">
              {t.subtitle}
            </p>

            <Button
              size="lg"
              onClick={onStartCall}
              className="mt-6 sm:mt-8 w-64 h-12 rounded-full font-mono text-xs sm:text-sm font-bold tracking-wider uppercase shadow-lg shadow-primary/25 transition-all duration-300 hover:scale-105 hover:shadow-primary/40 cursor-pointer"
            >
              <Mic className="mr-2 size-4" />
              {effectiveButtonText}
            </Button>

            {/* Voice Command Suggestions */}
            <div className="mt-8 w-full">
              <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground font-medium mb-3">
                <Terminal className="size-3.5 text-primary" />
                <span>{t.voiceCommandsTitle}</span>
              </div>
              <div className="flex max-w-xl flex-wrap items-center justify-center gap-2 mx-auto">
                {t.commands.map((cmd, idx) => (
                  <span
                    key={`${language}-${idx}`}
                    className="rounded-full border border-border/70 bg-muted/40 hover:bg-muted/70 hover:border-primary/50 transition-all duration-150 px-3 py-1 text-[11px] sm:text-xs text-foreground/90 font-mono shadow-xs backdrop-blur-xs select-none"
                  >
                    &quot;{cmd}&quot;
                  </span>
                ))}
              </div>
            </div>
          </section>
        </main>

        {/* Footer Quickstart Help */}
        <footer className="relative z-10 flex w-full items-center justify-center pointer-events-auto pt-2">
          <p className="text-muted-foreground max-w-prose text-xs leading-5 font-normal text-pretty md:text-sm rounded-full bg-background/50 px-4 py-1 backdrop-blur-md border border-border/40">
            {t.needHelp}{' '}
            <a
              target="_blank"
              rel="noopener noreferrer"
              href="https://docs.livekit.io/agents/start/voice-ai/"
              className="underline hover:text-foreground transition-colors font-medium ml-1"
            >
              {t.quickstartLink}
            </a>
            .
          </p>
        </footer>
      </div>
    );
  }
);

WelcomeView.displayName = 'WelcomeView';

export default WelcomeView;
