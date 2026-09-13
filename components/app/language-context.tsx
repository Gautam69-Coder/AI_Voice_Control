'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type Language = 'en' | 'hi';

export interface Translations {
  title: string;
  subtitle: string;
  startCall: string;
  startAudio: string;
  voiceCommandsTitle: string;
  commands: string[];
  needHelp: string;
  quickstartLink: string;
  scannerBadge: string;
  liveStatus: string;
  noiseFilterActive: string;
  noiseFilterInactive: string;
  noiseFilterPending: string;
}

export const translations: Record<Language, Translations> = {
  en: {
    title: 'AI Voice Assistant with Laptop Control',
    subtitle:
      'Speak naturally to launch apps, browse websites, dictate notes, adjust volume, and control your laptop hands-free.',
    startCall: 'Start call',
    startAudio: 'Start Audio',
    voiceCommandsTitle: 'Try saying:',
    commands: [
      'Open setup',
      'Create a folder on my desktop called Projects',
      'Check free space on C drive',
      'Show my IP address',
      'Open Notepad and write my ideas',
      'Open YouTube',
      'Take a screenshot',
      'Turn volume up',
      'What is my battery level?',
    ],
    needHelp: 'Need help getting set up? Check out the',
    quickstartLink: 'Voice AI quickstart',
    scannerBadge: 'Cyber Scanner BG',
    liveStatus: 'Voice Control Active',
    noiseFilterActive: 'AI Noise Cancellation: Active (Krisp)',
    noiseFilterInactive: 'AI Noise Cancellation: Disabled',
    noiseFilterPending: 'Activating noise filter...',
  },
  hi: {
    title: 'लैपटॉप नियंत्रण के साथ AI वॉयस असिस्टेंट',
    subtitle:
      'ऐप्स खोलने, वेबसाइट ब्राउज़ करने, नोट्स डिक्टेट करने, वॉल्यूम नियंत्रित करने और अपने लैपटॉप को हैंड्स-फ्री कंट्रोल करने के लिए स्वाभाविक रूप से बोलें।',
    startCall: 'कॉल शुरू करें',
    startAudio: 'ऑडियो चालू करें',
    voiceCommandsTitle: 'बोल कर देखें:',
    commands: [
      'सेटअप खोलो',
      'डेस्कटॉप पर Projects नाम का फोल्डर बनाएं',
      'C ड्राइव में खाली स्पेस चेक करें',
      'मेरा IP एड्रेस दिखाएं',
      'Notepad खोलें और मेरे विचार लिखें',
      'YouTube खोलें',
      'स्क्रीनशॉट लें',
      'वॉल्यूम बढ़ाएं',
      'मेरी बैटरी का स्तर क्या है?',
    ],
    needHelp: 'सेटअप में सहायता चाहिए? देखें',
    quickstartLink: 'Voice AI क्विकस्टार्ट',
    scannerBadge: 'साइबर स्कैनर बैकग्राउंड',
    liveStatus: 'वॉयस कंट्रोल सक्रिय',
    noiseFilterActive: 'AI शोर रद्दीकरण: सक्रिय (क्रिसप)',
    noiseFilterInactive: 'AI शोर रद्दीकरण: बंद',
    noiseFilterPending: 'शोर फ़िल्टर चालू हो रहा है...',
  },
};

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    try {
      const savedLang = localStorage.getItem('app_language') as Language | null;
      if (savedLang === 'en' || savedLang === 'hi') {
        setLanguageState(savedLang);
      }
    } catch {
      // localStorage may be disabled
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('app_language', lang);
    } catch {
      // ignore
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'hi' : 'en');
  };

  const t = translations[language];

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
