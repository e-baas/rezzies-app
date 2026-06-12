import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { submitBugReport } from '../src/lib/bugReports';
import type { BugSeverity } from '../src/types';

const SEVERITIES: { value: BugSeverity; label: string; emoji: string; desc: string }[] = [
  { value: 'low', label: 'Low', emoji: '🙂', desc: 'Cosmetic / nice-to-fix' },
  { value: 'annoying', label: 'Annoying', emoji: '😐', desc: 'I worked around it' },
  { value: 'blocks', label: 'Blocks me', emoji: '😩', desc: 'I cannot continue' },
];

export default function ReportBugScreen() {
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<BugSeverity>('annoying');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const trimmed = description.trim();
    if (trimmed.length < 5) {
      Alert.alert('A few more words', 'Please describe what happened — at least a sentence.');
      return;
    }
    setSubmitting(true);
    const { ok, error } = await submitBugReport({
      description: trimmed,
      severity,
      source: 'manual',
      screen_name: 'report-bug',
    });
    setSubmitting(false);
    if (!ok) {
      Alert.alert(
        'Could not send',
        error || 'Something went wrong. Check your connection and try again.'
      );
      return;
    }
    Alert.alert('Thanks!', 'Bug report sent. We will take a look.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            disabled={submitting}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.cancelLink}>‹ Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Report a Bug</Text>
          <View style={{ width: 56 }} />
        </View>

        <Text style={styles.label}>What happened?</Text>
        <TextInput
          style={styles.textarea}
          multiline
          numberOfLines={6}
          placeholder="Tell us what went wrong, what you expected, and what you saw…"
          placeholderTextColor="#94A3B8"
          value={description}
          onChangeText={setDescription}
          textAlignVertical="top"
          editable={!submitting}
        />

        <Text style={[styles.label, { marginTop: 24 }]}>How bad is it?</Text>
        <View style={styles.severityRow}>
          {SEVERITIES.map((s) => {
            const active = severity === s.value;
            return (
              <TouchableOpacity
                key={s.value}
                style={[styles.severityChip, active && styles.severityChipActive]}
                onPress={() => setSeverity(s.value)}
                disabled={submitting}
              >
                <Text style={styles.severityEmoji}>{s.emoji}</Text>
                <Text style={[styles.severityLabel, active && styles.severityLabelActive]}>
                  {s.label}
                </Text>
                <Text style={[styles.severityDesc, active && styles.severityDescActive]}>
                  {s.desc}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.fineprint}>
          We auto-attach your device model, OS version, and app version so the team can reproduce it.
        </Text>

        <TouchableOpacity
          style={[styles.submit, submitting && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={styles.submitText}>
            {submitting ? 'Sending…' : 'Send Bug Report'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={() => router.back()}
          disabled={submitting}
        >
          <Text style={styles.cancelBtnText}>Cancel — back to app</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, paddingBottom: 40 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#1F2937' },
  cancelLink: { fontSize: 16, fontWeight: '700', color: '#6366F1', width: 56 },
  cancelBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  cancelBtnText: { color: '#6B7280', fontWeight: '700', fontSize: 15 },
  label: { fontSize: 14, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  textarea: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: '#1F2937',
    minHeight: 140,
  },
  severityRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  severityChip: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    padding: 12,
    alignItems: 'center',
  },
  severityChipActive: {
    borderColor: '#6366F1',
    backgroundColor: '#EEF2FF',
  },
  severityEmoji: { fontSize: 24, marginBottom: 4 },
  severityLabel: { fontSize: 14, fontWeight: '700', color: '#374151' },
  severityLabelActive: { color: '#4338CA' },
  severityDesc: { fontSize: 10, color: '#9CA3AF', textAlign: 'center', marginTop: 2 },
  severityDescActive: { color: '#6366F1' },
  fineprint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 16,
    lineHeight: 18,
  },
  submit: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: 'white', fontWeight: '700', fontSize: 16 },
});
