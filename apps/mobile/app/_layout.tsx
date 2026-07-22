import { Stack } from "expo-router";
import { registerGlobals } from "@livekit/react-native";
import { ActivityIndicator, View } from "react-native";
import { OnboardingProvider, useOnboarding } from "../src/onboarding";

registerGlobals();

export default function Layout() {
  return <OnboardingProvider><Navigation /></OnboardingProvider>;
}

function Navigation() {
  const { isLoading, profile } = useOnboarding();
  if (isLoading) return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}><ActivityIndicator /></View>;
  if (!profile) return <Stack screenOptions={{ headerShown: false, animation: "fade" }} initialRouteName="onboarding"><Stack.Screen name="onboarding" /></Stack>;
  return <Stack screenOptions={{ headerShown: false, animation: "fade" }} />;
}
