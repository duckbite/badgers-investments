import { createContext, useContext, useState, ReactNode } from "react";

interface AnonymizeContextType {
  isAnonymized: boolean;
  setIsAnonymized: (value: boolean) => void;
  formatAmount: (amount: number, options?: Intl.NumberFormatOptions) => string;
}

const AnonymizeContext = createContext<AnonymizeContextType | undefined>(undefined);

export function AnonymizeProvider({ children }: { children: ReactNode }) {
  const [isAnonymized, setIsAnonymized] = useState(false);

  const formatAmount = (amount: number, options?: Intl.NumberFormatOptions) => {
    if (isAnonymized) {
      return "••••••";
    }
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      ...options
    });
  };

  return (
    <AnonymizeContext.Provider value={{ isAnonymized, setIsAnonymized, formatAmount }}>
      {children}
    </AnonymizeContext.Provider>
  );
}

export function useAnonymize() {
  const context = useContext(AnonymizeContext);
  if (context === undefined) {
    throw new Error("useAnonymize must be used within an AnonymizeProvider");
  }
  return context;
}
