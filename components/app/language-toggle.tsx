'use client';

import React from 'react';
import { Languages } from 'lucide-react';
import { useLanguage, Language } from '@/components/app/language-context';
import { cn } from '@/lib/shadcn/utils';

interface LanguageToggleProps {
  className?: string;
}

export function LanguageToggle({ className }: LanguageToggleProps) {
  const { language, setLanguage } = useLanguage();

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-border/80 bg-background/80 p-1 shadow-md backdrop-blur-md transition-all duration-200 hover:border-primary/50',
        className
      )}
      role="group"
      aria-label="Language selector"
    >
      <div className="flex items-center pl-2 pr-1 text-muted-foreground">
        <Languages className="size-3.5" />
      </div>

      <button
        type="button"
        onClick={() => setLanguage('en')}
        className={cn(
          'relative rounded-full px-2.5 py-1 text-xs font-medium tracking-wide transition-all duration-200',
          language === 'en'
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
        )}
        aria-pressed={language === 'en'}
      >
        English
      </button>

      <button
        type="button"
        onClick={() => setLanguage('hi')}
        className={cn(
          'relative rounded-full px-2.5 py-1 text-xs font-medium tracking-wide transition-all duration-200 font-sans',
          language === 'hi'
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
        )}
        aria-pressed={language === 'hi'}
      >
        हिन्दी
      </button>
    </div>
  );
}

export default LanguageToggle;
