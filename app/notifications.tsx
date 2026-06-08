import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Switch,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import {
  loadNotificationPreferences,
  saveNotificationPreferences,
  detectTimezone,
  type NotificationPreferences,
} from '../../src/lib/notifications';

export default function NotificationsScreen() {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    loadNotificationPreferences().then((p) => {
      setPrefs(p);
      setLoading(false);
    });
  }, []);

  const update = async (patch: Partial<NotificationPreferences>) => {
    if (!prefs) return;
    const updated = { ...prefs, ...patch };
    setPrefs(updated);
    try {
      await saveNotificationPreferences(patch);
    } catch {
      Alert.alert('Error', 'Could not save notification preferences. Please try again.');
      setPrefs(prefs); // rollback
    }
  };

  const handleTimeChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowTimePicker(Platform.OS === 'ios'); // iOS keeps picker open
    if (selectedDate) {
      const hours = String(selectedDate.getHours()).padStart(2, '0');
      const minutes = String(selectedDate.getMinutes()).padStart(2, '0');
      update({ reminder_time: `${hours}:${minutes}:00` });
    }
  };

  if (loading || !prefs) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const timeParts = prefs.reminder_time.split(':');
  const reminderDate = new Date();
  reminderDate.setHours(parseInt(timeParts[0], 10), parseInt(timeParts[1], 10), 0, 0);

  const detectedTz = detectTimezone();
  const tzMismatch = prefs.timezone !== detectedTz && prefs.timezone !== 'America/New_York';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <Text style={styles.sectionTitle}>Notification Schedule</Text>
      <Text style={styles.sectionSubtitle}>
        We'll send at most 3 reminders per day. Once you check in, the rest
        are silenced automatically.
      </Text>

      {/* Morning Reminder */}
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.labelArea}>
            <Text style={styles.label}>🌅 Morning Reminder</Text>
            <Text style={styles.hint}>
              Daily at {prefs.reminder_time.slice(0, 5)} · reviews today's habits
            </Text>
          </View>
          <Switch
            value={prefs.notify_morning}
            onValueChange={(v) => update({ notify_morning: v })}
            trackColor={{ false: '#D1D5DB', true: '#A5B4FC' }}
            thumbColor={prefs.notify_morning ? '#6366F1' : '#9CA3AF'}
          />
        </View>
      </View>

      {/* Mid-day Nudge */}
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.labelArea}>
            <Text style={styles.label}>☀️ Mid-day Nudge</Text>
            <Text style={styles.hint}>
              Around 1pm · only if you haven't checked in yet
            </Text>
          </View>
          <Switch
            value={prefs.notify_midday}
            onValueChange={(v) => update({ notify_midday: v })}
            trackColor={{ false: '#D1D5DB', true: '#A5B4FC' }}
            thumbColor={prefs.notify_midday ? '#6366F1' : '#9CA3AF'}
          />
        </View>
      </View>

      {/* Evening Streak Nudge */}
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.labelArea}>
            <Text style={styles.label}>🌙 Evening Streak Nudge</Text>
            <Text style={styles.hint}>
              Around 8:30pm · don't break your streak
            </Text>
          </View>
          <Switch
            value={prefs.notify_evening}
            onValueChange={(v) => update({ notify_evening: v })}
            trackColor={{ false: '#D1D5DB', true: '#A5B4FC' }}
            thumbColor={prefs.notify_evening ? '#6366F1' : '#9CA3AF'}
          />
        </View>
      </View>

      {/* Reminder Time Picker */}
      <View style={styles.card}>
        <Text style={styles.label}>⏰ Reminder Time</Text>
        <Text style={styles.timeDisplay} onPress={() => setShowTimePicker(true)}>
          {prefs.reminder_time.slice(0, 5)}
        </Text>
        {showTimePicker && (
          <DateTimePicker
            value={reminderDate}
            mode="time"
            is24Hour={false}
            onChange={handleTimeChange}
            style={styles.timePicker}
          />
        )}
        <Text style={styles.hint}>
          Tap the time to change when your morning reminder fires (local time).
        </Text>
      </View>

      {/* Timezone */}
      <View style={styles.card}>
        <Text style={styles.label}>🌍 Timezone</Text>
        <Text style={styles.tzValue}>{detectedTz}</Text>
        <Text style={styles.hint}>
          Detected from your device. Notifications respect your local time.
        </Text>
        {tzMismatch && (
          <Text style={styles.tzMismatch}>
            Stored timezone ({prefs.timezone}) differs from device ({detectedTz}).
            {'\n'}It will update on next app launch.
          </Text>
        )}
      </View>

      {/* Footer */}
      <Text style={styles.footer}>
        Notifications require an internet connection. You can disable all
        notifications by toggling all three switches off.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, paddingBottom: 48 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' },
  loadingText: { fontSize: 16, color: '#6B7280' },
  sectionTitle: { fontSize: 22, fontWeight: '700', color: '#1F2937', marginBottom: 4 },
  sectionSubtitle: { fontSize: 14, color: '#6B7280', marginBottom: 24, lineHeight: 20 },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  labelArea: { flex: 1, marginRight: 12 },
  label: { fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 4 },
  hint: { fontSize: 12, color: '#9CA3AF', lineHeight: 16 },
  timeDisplay: {
    fontSize: 32,
    fontWeight: '800',
    color: '#6366F1',
    marginVertical: 8,
    paddingVertical: 4,
  },
  timePicker: { marginTop: 4 },
  tzValue: { fontSize: 16, fontWeight: '600', color: '#1F2937', marginTop: 8, marginBottom: 4 },
  tzMismatch: { fontSize: 12, color: '#EF4444', marginTop: 8, lineHeight: 18 },
  footer: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginTop: 24, lineHeight: 18 },
});
