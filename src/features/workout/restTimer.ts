import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// The rest timer is stored as an absolute end time, so it survives the app being
// backgrounded or killed. A local notification fires at that time.

const CHANNEL = 'rest-timer';
let configured = false;

export async function setupNotifications(): Promise<boolean> {
  if (!configured) {
    configured = true;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: false,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: 'Rest timer',
        // eslint-disable-next-line import/namespace -- re-exported `declare enum`, the plugin can't see it
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 300, 150, 300],
        sound: 'default',
      });
    }
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

export async function scheduleRestDone(seconds: number): Promise<string | null> {
  if (seconds < 1) return null;
  try {
    return await Notifications.scheduleNotificationAsync({
      content: { title: 'Rest is over', body: 'Time for your next set 💪', sound: 'default' },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.round(seconds),
        channelId: CHANNEL,
      },
    });
  } catch {
    return null; // notifications unavailable (e.g. permission denied) — the in-app timer still works
  }
}

export async function cancelRestDone(id: string | null | undefined) {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // already fired
  }
}
