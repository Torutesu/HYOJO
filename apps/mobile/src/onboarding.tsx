import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";

export type OnboardingProfile = {
  name: string;
  spaceId: "product" | "people" | "finance";
  recordingAcknowledged: boolean;
  notifications: "enabled" | "skipped";
};

type OnboardingContextValue = {
  isLoading: boolean;
  profile: OnboardingProfile | null;
  complete: (profile: OnboardingProfile) => Promise<void>;
};

const STORAGE_KEY = "hyojo.onboarding.v1";
const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<OnboardingProfile | null>(null);

  useEffect(() => {
    void SecureStore.getItemAsync(STORAGE_KEY)
      .then((value) => value ? setProfile(JSON.parse(value) as OnboardingProfile) : undefined)
      .catch(() => undefined)
      .finally(() => setIsLoading(false));
  }, []);

  const value = useMemo(() => ({
    isLoading,
    profile,
    async complete(nextProfile: OnboardingProfile) {
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(nextProfile));
      setProfile(nextProfile);
    }
  }), [isLoading, profile]);

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const value = useContext(OnboardingContext);
  if (!value) throw new Error("useOnboarding must be used inside OnboardingProvider");
  return value;
}
