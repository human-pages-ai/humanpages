import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

type FeedbackType = 'FEEDBACK' | 'BUG' | 'FEATURE';

interface FeedbackContextType {
  isOpen: boolean;
  defaultType: FeedbackType;
  openFeedback: (type?: FeedbackType) => void;
  closeFeedback: () => void;
}

const FeedbackContext = createContext<FeedbackContextType | undefined>(undefined);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [defaultType, setDefaultType] = useState<FeedbackType>('FEEDBACK');

  const openFeedback = useCallback((type: FeedbackType = 'FEEDBACK') => {
    setDefaultType(type);
    setIsOpen(true);
  }, []);

  const closeFeedback = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <FeedbackContext.Provider value={{ isOpen, defaultType, openFeedback, closeFeedback }}>
      {children}
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error('useFeedback must be used within FeedbackProvider');
  }
  return context;
}
