import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { submitBugReport } from '../lib/bugReports';
import { uploadBugScreenshot } from '../lib/bugScreenshots';
import { c, radii } from '../theme/tokens';
import type { BugSeverity } from '../types';

const SEVERITIES: { value: BugSeverity; label: string; emoji: string }[] = [
  { value: 'low', label: 'Low', emoji: '🙂' },
  { value: 'annoying', label: 'Annoying', emoji: '😐' },
  { value: 'blocks', label: 'Blocks me', emoji: '😩' },
];

interface Props {
  visible: boolean;
  /** Base64 PNG of the screen captured when the floating button was tapped. */
  screenshotBase64: string | null;
  /** Route the report came from, for triage context. */
  screenName?: string | null;
  onClose: () => void;
}

/**
 * In-app bug report modal pre-loaded with an auto-captured screenshot.
 * Rendered as an overlay so the user never navigates away from their screen.
 */
export function BugReportModal({ visible, screenshotBase64, screenName, onClose }: Props) {
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<BugSeverity>('annoying');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setDescription('');
    setSeverity('annoying');
    setSubmitting(false);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    const trimmed = description.trim();
    if (trimmed.length < 5) {
      Alert.alert('A few more words', 'Please describe what happened — at least a sentence.');
      return;
    }
    setSubmitting(true);

    // Best-effort screenshot upload — a failure must not lose the report.
    let screenshot_url: string | null = null;
    if (screenshotBase64) {
      const { url } = await uploadBugScreenshot(screenshotBase64);
      screenshot_url = url;
    }

    const { ok, error } = await submitBugReport({
      description: trimmed,
      severity,
      source: 'manual',
      screen_name: screenName ?? 'floating-button',
      screenshot_url,
    });
    setSubmitting(false);

    if (!ok) {
      Alert.alert('Could not send', error || 'Something went wrong. Check your connection and try again.');
      return;
    }
    Alert.alert('Thanks!', 'Bug report sent to our team. We will take a look.', [
      { text: 'OK', onPress: handleClose },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>Report a Bug</Text>
            <TouchableOpacity
              onPress={handleClose}
              disabled={submitting}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
            {screenshotBase64 ? (
              <View style={styles.shotWrap}>
                <Image
                  source={{ uri: `data:image/png;base64,${screenshotBase64}` }}
                  style={styles.shot}
                  resizeMode="cover"
                />
                <View style={styles.shotBadge}>
                  <Text style={styles.shotBadgeText}>📎 Screenshot attached</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.noShot}>Screenshot unavailable — your report will still send.</Text>
            )}

            <Text style={styles.label}>What happened?</Text>
            <TextInput
              style={styles.textarea}
              multiline
              placeholder="Tell us what went wrong, what you expected, and what you saw…"
              placeholderTextColor={c.text3}
              value={description}
              onChangeText={setDescription}
              textAlignVertical="top"
              editable={!submitting}
              autoFocus
            />

            <Text style={[styles.label, { marginTop: 20 }]}>How bad is it?</Text>
            <View style={styles.severityRow}>
              {SEVERITIES.map((s) => {
                const active = severity === s.value;
                return (
                  <TouchableOpacity
                    key={s.value}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setSeverity(s.value)}
                    disabled={submitting}
                  >
                    <Text style={styles.chipEmoji}>{s.emoji}</Text>
                    <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{s.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.note}>
              Bug reports go directly to our team (not Apple). We auto-attach the screenshot, your
              device model, OS version, and app version so we can reproduce it.
            </Text>

            <TouchableOpacity
              style={[styles.submit, submitting && styles.submitDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#06302B" />
              ) : (
                <Text style={styles.submitText}>Send Bug Report</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 24,
    maxHeight: '90%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.border,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: { fontSize: 18, fontWeight: '800', color: c.text },
  close: { fontSize: 18, fontWeight: '700', color: c.text2, paddingHorizontal: 4 },
  body: { paddingBottom: 12 },
  shotWrap: {
    borderRadius: radii.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: c.border,
    marginBottom: 16,
  },
  shot: { width: '100%', height: 180, backgroundColor: c.elev },
  shotBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  shotBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  noShot: { color: c.text3, fontSize: 13, marginBottom: 16, fontStyle: 'italic' },
  label: { fontSize: 14, fontWeight: '700', color: c.text, marginBottom: 8 },
  textarea: {
    backgroundColor: c.elev,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.md,
    padding: 12,
    fontSize: 15,
    color: c.text,
    minHeight: 110,
  },
  severityRow: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  chip: {
    flex: 1,
    backgroundColor: c.elev,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: c.border,
    paddingVertical: 12,
    alignItems: 'center',
  },
  chipActive: { borderColor: c.secondary, backgroundColor: c.secondarySoft },
  chipEmoji: { fontSize: 22, marginBottom: 4 },
  chipLabel: { fontSize: 13, fontWeight: '700', color: c.text2 },
  chipLabelActive: { color: c.secondary2 },
  note: { fontSize: 12, color: c.text2, marginTop: 16, lineHeight: 18 },
  submit: {
    backgroundColor: c.secondary,
    borderRadius: radii.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: '#06302B', fontWeight: '800', fontSize: 16 },
});
