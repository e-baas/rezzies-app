import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Switch,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  Pressable,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import {
  loadNotificationPreferences,
  saveNotificationPreferences,
  detectTimezone,
  type NotificationPreferences,
} from '../src/lib/notifications';
import { c, space, radii, text as type } from '../src/theme/tokens';

const VACATION_DAYS = 7;

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
    const prev = prefs;
    const updated = { ...prefs, ...patch };
    setPrefs(updated);
    try {
      await saveNotificationPreferences(patch);
    } catch {
      Alert.alert('Error', 'Could not save notification settings. Please try again.');
      setPrefs(prev); // rollback
    }
  };

  const handleTimeChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedDate) {
      const hours = String(selectedDate.getHours()).padStart(2, '0');
      const minutes = String(selectedDate.getMinutes()).padStart(2, '0');
      update({ reminder_time: `${hours}:${minutes}:00` });
    }
  };

  const isPaused =
    !!prefs?.notifications_paused_until &&
    new Date(prefs.notifications_paused_until) > new Date();

  const togglePause = (on: boolean) => {
    if (on) {
      const until = new Date();
      until.setDate(until.getDate() + VACATION_DAYS);
      update({ notifications_paused_until: until.toISOString() });
    } else {
      update({ notifications_paused_until: null });
    }
  };

  if (loading || !prefs) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  const timeParts = prefs.reminder_time.split(':');
  const reminderDate = new Date();
  reminderDate.setHours(parseInt(timeParts[0], 10), parseInt(timeParts[1], 10), 0, 0);
  const reminderLabel = formatTime12(timeParts[0], timeParts[1]);

  const masterOff = !prefs.notifications_enabled;
  const detectedTz = detectTimezone();

  const pausedUntilLabel = prefs.notifications_paused_until
    ? new Date(prefs.notifications_paused_until).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
    : '';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Master switch */}
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.labelArea}>
            <Text style={styles.label}>All notifications</Text>
            <Text style={styles.hint}>Master switch for every reminder.</Text>
          </View>
          <Switch
            value={prefs.notifications_enabled}
            onValueChange={(v) => update({ notifications_enabled: v })}
            trackColor={{ false: c.border, true: c.secondarySoft }}
            thumbColor={prefs.notifications_enabled ? c.secondary : c.text3}
            ios_backgroundColor={c.border}
          />
        </View>
      </View>

      {/* Daily reminders */}
      <Text style={styles.groupHeader}>DAILY REMINDERS</Text>

      <View style={[styles.card, masterOff && styles.cardDisabled]}>
        <View style={styles.row}>
          <View style={styles.labelArea}>
            <Text style={styles.label}>Morning reminder</Text>
            <Text style={styles.hint}>Daily at {reminderLabel} · today's habits</Text>
          </View>
          <Switch
            value={prefs.notify_morning && !masterOff}
            disabled={masterOff}
            onValueChange={(v) => update({ notify_morning: v })}
            trackColor={{ false: c.border, true: c.secondarySoft }}
            thumbColor={prefs.notify_morning && !masterOff ? c.secondary : c.text3}
            ios_backgroundColor={c.border}
          />
        </View>

        <Pressable
          style={[styles.subRow, masterOff && { opacity: 0.4 }]}
          disabled={masterOff || !prefs.notify_morning}
          onPress={() => setShowTimePicker(true)}
        >
          <Text style={styles.subLabel}>Send at</Text>
          <Text style={styles.subValue}>{reminderLabel} ›</Text>
        </Pressable>
        {showTimePicker && (
          <DateTimePicker
            value={reminderDate}
            mode="time"
            minuteInterval={30}
            is24Hour={false}
            onChange={handleTimeChange}
            themeVariant="dark"
            style={styles.timePicker}
          />
        )}
      </View>

      <View style={[styles.card, masterOff && styles.cardDisabled]}>
        <View style={styles.row}>
          <View style={styles.labelArea}>
            <Text style={styles.label}>Mid-day check-in</Text>
            <Text style={styles.hint}>Around 12:30pm · only if you haven't logged yet</Text>
          </View>
          <Switch
            value={prefs.notify_midday && !masterOff}
            disabled={masterOff}
            onValueChange={(v) => update({ notify_midday: v })}
            trackColor={{ false: c.border, true: c.secondarySoft }}
            thumbColor={prefs.notify_midday && !masterOff ? c.secondary : c.text3}
            ios_backgroundColor={c.border}
          />
        </View>
      </View>

      <View style={[styles.card, masterOff && styles.cardDisabled]}>
        <View style={styles.row}>
          <View style={styles.labelArea}>
            <Text style={styles.label}>Evening streak warning</Text>
            <Text style={styles.hint}>Around 7pm · only when a 3+ day streak is at risk</Text>
          </View>
          <Switch
            value={prefs.notify_evening && !masterOff}
            disabled={masterOff}
            onValueChange={(v) => update({ notify_evening: v })}
            trackColor={{ false: c.border, true: c.secondarySoft }}
            thumbColor={prefs.notify_evening && !masterOff ? c.secondary : c.text3}
            ios_backgroundColor={c.border}
          />
        </View>
      </View>

      <View style={[styles.card, masterOff && styles.cardDisabled]}>
        <View style={styles.row}>
          <View style={styles.labelArea}>
            <Text style={styles.label}>Milestone celebrations 🎉</Text>
            <Text style={styles.hint}>One-time cheers at 7, 30, 100 & 365 days</Text>
          </View>
          <Switch
            value={prefs.notify_milestone && !masterOff}
            disabled={masterOff}
            onValueChange={(v) => update({ notify_milestone: v })}
            trackColor={{ false: c.border, true: c.secondarySoft }}
            thumbColor={prefs.notify_milestone && !masterOff ? c.secondary : c.text3}
            ios_backgroundColor={c.border}
          />
        </View>
      </View>

      {/* Life stuff */}
      <Text style={styles.groupHeader}>LIFE STUFF</Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.labelArea}>
            <Text style={styles.label}>Quiet hours</Text>
            <Text style={styles.hint}>9 PM – 6 AM · we never send overnight</Text>
          </View>
          <Text style={styles.fixedValue}>9 PM – 6 AM</Text>
        </View>
      </View>

      <View style={[styles.card, masterOff && styles.cardDisabled]}>
        <View style={styles.row}>
          <View style={styles.labelArea}>
            <Text style={styles.label}>Pause for {VACATION_DAYS} days</Text>
            <Text style={styles.hint}>
              {isPaused ? `Paused until ${pausedUntilLabel}` : 'Great for vacations'}
            </Text>
          </View>
          <Switch
            value={isPaused}
            disabled={masterOff}
            onValueChange={togglePause}
            trackColor={{ false: c.border, true: c.primarySoft }}
            thumbColor={isPaused ? c.primary : c.text3}
            ios_backgroundColor={c.border}
          />
        </View>
      </View>

      {/* Promise footer */}
      <View style={styles.promise}>
        <Text style={styles.promiseText}>
          We never send more than 2 notifications per day. When you finish your
          habits, we stop.
        </Text>
      </View>

      <Text style={styles.tzNote}>Timezone: {prefs.timezone || detectedTz} · auto-detected</Text>
    </ScrollView>
  );
}

function formatTime12(hh: string, mm: string): string {
  const h = parseInt(hh, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mm} ${ampm}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  content: { padding: space.lg, paddingBottom: space.huge },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.bg,
  },
  loadingText: { ...type.body, color: c.text2 },
  groupHeader: {
    ...type.micro,
    color: c.text3,
    letterSpacing: 1,
    marginTop: space.xl,
    marginBottom: space.sm,
    marginLeft: space.xs,
  },
  card: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    padding: space.lg,
    marginBottom: space.md,
    borderWidth: 1,
    borderColor: c.border,
  },
  cardDisabled: { opacity: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  labelArea: { flex: 1, marginRight: space.md },
  label: { ...type.bodyLg, color: c.text, marginBottom: 2 },
  hint: { ...type.caption, color: c.text3 },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  subLabel: { ...type.body, color: c.text2 },
  subValue: { ...type.body, color: c.secondary, fontWeight: '700' },
  fixedValue: { ...type.body, color: c.text2 },
  timePicker: { marginTop: space.sm, alignSelf: 'flex-start' },
  promise: {
    backgroundColor: c.secondarySoft,
    borderRadius: radii.md,
    padding: space.lg,
    marginTop: space.lg,
  },
  promiseText: { ...type.caption, color: c.secondary2, lineHeight: 18 },
  tzNote: { ...type.micro, color: c.text3, textAlign: 'center', marginTop: space.xl },
});
