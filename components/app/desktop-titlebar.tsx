'use client';

import React, { useEffect, useState } from 'react';
import { Copy, Minus, Pin, PinOff, Radio, Square, X } from 'lucide-react';
import { cn } from '@/lib/shadcn/utils';

export interface ElectronAPI {
  isElectron?: boolean;
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  setAlwaysOnTop: (flag: boolean) => void;
  onGlobalSummon: (callback: () => void) => void;
  onWindowStateChange: (callback: (state: { isMaximized: boolean }) => void) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export function DesktopTitlebar() {
  const [isElectron, setIsElectron] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI?.isElectron) {
      setIsElectron(true);

      // Check initial maximized state
      window.electronAPI
        .isMaximized()
        .then(setIsMaximized)
        .catch(() => {});

      // Listen for window state changes from main process
      window.electronAPI.onWindowStateChange((state) => {
        setIsMaximized(state.isMaximized);
      });
    }
  }, []);

  if (!isElectron) {
    return null;
  }

  const handleMinimize = () => {
    window.electronAPI?.minimize();
  };

  const handleMaximize = () => {
    window.electronAPI?.maximize();
  };

  const handleClose = () => {
    window.electronAPI?.close();
  };

  const handleToggleAlwaysOnTop = () => {
    const nextState = !isAlwaysOnTop;
    setIsAlwaysOnTop(nextState);
    window.electronAPI?.setAlwaysOnTop(nextState);
  };

  return (
    <header
      className="bg-background/80 border-border/40 fixed top-0 right-0 left-0 z-50 flex h-9 items-center justify-between border-b px-3 text-xs backdrop-blur-md select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Brand & Status */}
      <div className="flex items-center gap-2">
        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-cyan-500/10 text-cyan-500 ring-1 ring-cyan-500/20">
          <Radio className="h-3 w-3 animate-pulse" />
        </div>
        <span className="text-foreground/90 font-medium tracking-wide">AI Voice Assistant</span>
        <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-600 dark:text-cyan-400">
          DESKTOP
        </span>
      </div>

      {/* Center Drag Hint */}
      <div className="text-muted-foreground/40 hidden font-mono text-[11px] sm:block">
        Ctrl+Shift+Space to summon
      </div>

      {/* Action & Window Control Buttons */}
      <div
        className="flex items-center gap-0.5"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {/* Always on Top Pin Toggle */}
        <button
          type="button"
          onClick={handleToggleAlwaysOnTop}
          title={
            isAlwaysOnTop ? 'Unpin window (Always on Top is ON)' : 'Pin window on top of other apps'
          }
          aria-label={isAlwaysOnTop ? 'Unpin window' : 'Pin window'}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded transition-colors',
            isAlwaysOnTop
              ? 'bg-cyan-500/20 text-cyan-600 hover:bg-cyan-500/30 dark:text-cyan-400'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          {isAlwaysOnTop ? (
            <Pin className="h-3.5 w-3.5 rotate-45 fill-current" />
          ) : (
            <PinOff className="h-3.5 w-3.5" />
          )}
        </button>

        {/* Minimize */}
        <button
          type="button"
          onClick={handleMinimize}
          title="Minimize to taskbar"
          aria-label="Minimize"
          className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-7 w-8 items-center justify-center rounded transition-colors"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>

        {/* Maximize / Restore */}
        <button
          type="button"
          onClick={handleMaximize}
          title={isMaximized ? 'Restore window size' : 'Maximize window'}
          aria-label={isMaximized ? 'Restore' : 'Maximize'}
          className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-7 w-8 items-center justify-center rounded transition-colors"
        >
          {isMaximized ? <Copy className="h-3 w-3" /> : <Square className="h-3 w-3" />}
        </button>

        {/* Close (Hide to Tray) */}
        <button
          type="button"
          onClick={handleClose}
          title="Close (Minimizes to System Tray)"
          aria-label="Close"
          className="text-muted-foreground flex h-7 w-8 items-center justify-center rounded transition-colors hover:bg-red-500 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  );
}
