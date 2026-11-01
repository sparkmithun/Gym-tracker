import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@/components/ui';
import { ActiveWorkoutBar } from '@/features/workout/components/ActiveWorkoutBar';
import { colors } from '@/theme';

const TAB_HEIGHT = 56;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '800', fontSize: 22 },
          headerShadowVisible: false,
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: TAB_HEIGHT + insets.bottom },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color as string} size={size} /> }}
        />
        <Tabs.Screen
          name="workout"
          options={{ title: 'Workout', tabBarIcon: ({ color, size }) => <Ionicons name="barbell" color={color as string} size={size} /> }}
        />
        <Tabs.Screen
          name="profile"
          options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color as string} size={size} /> }}
        />
      </Tabs>
      <ActiveWorkoutBar bottom={TAB_HEIGHT + insets.bottom + 8} />
    </View>
  );
}
