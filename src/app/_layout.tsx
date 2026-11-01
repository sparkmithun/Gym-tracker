import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Loading } from '@/components/ui';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { SyncManager } from '@/sync/SyncManager';
import { colors } from '@/theme';

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.bg, primary: colors.primary, text: colors.text, border: colors.border },
};

function RootStack() {
  const { ready, userId, needsOnboarding } = useAuth();
  if (!ready) return <Loading />;
  const signedIn = !!userId;

  return (
    <>
      <SyncManager />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: colors.bg },
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && needsOnboarding}>
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && !needsOnboarding}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          {/* A card (not a modal) so screens pushed from it — the exercise picker — stack on top on iOS. */}
          <Stack.Screen name="workout/active" options={{ title: 'Log Workout', animation: 'slide_from_bottom', gestureEnabled: false }} />
          <Stack.Screen name="workout/finish" options={{ title: 'Save Workout' }} />
          <Stack.Screen name="workout/[id]" options={{ title: 'Workout' }} />
          <Stack.Screen name="workout/edit/[id]" options={{ title: 'Edit Workout' }} />
          <Stack.Screen name="routine/[id]" options={{ title: 'Routine' }} />
          <Stack.Screen name="programs" options={{ title: 'Starter Programs' }} />
          <Stack.Screen name="exercise/library" options={{ title: 'Exercises' }} />
          <Stack.Screen name="exercise/new" options={{ title: 'Custom Exercise', presentation: 'modal' }} />
          <Stack.Screen name="exercise/[id]" options={{ title: 'Exercise' }} />
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          <Stack.Screen name="measurements" options={{ title: 'Measurements' }} />
          <Stack.Screen name="calendar" options={{ title: 'Calendar' }} />
          <Stack.Screen name="plates" options={{ title: 'Plate Calculator', presentation: 'modal' }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <ThemeProvider value={theme}>
          <StatusBar style="light" />
          <AuthProvider>
            <RootStack />
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
