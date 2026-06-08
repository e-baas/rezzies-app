import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useProgramStore } from '../src/stores/programStore';
import { c, radii, space } from '../src/theme/tokens';

// Visual polish v2 (TYC-137): dark canvas, orange primary CTA, teal
// accent for cancel-text hover affinity; invite code is the only
// monospaced moment so it gets generous letter-spacing.

export default function JoinProgram() {
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const joinProgram = useProgramStore((s) => s.joinProgram);

  const handleJoin = async () => {
    if (!inviteCode.trim()) {
      Alert.alert('Error', 'Please enter an invite code');
      return;
    }
    setLoading(true);
    const { programId, error } = await joinProgram(inviteCode.trim());
    setLoading(false);
    if (error) {
      Alert.alert('Join Failed', error);
    } else {
      Alert.alert('Welcome!', "You've joined the program!", [
        { text: 'Go to Check-in', onPress: () => router.replace('/(tabs)/home') },
      ]);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.inner}>
        <Text style={styles.emoji}>🔗</Text>
        <Text style={styles.title}>Join a Program</Text>
        <Text style={styles.subtitle}>
          Enter the invite code shared by your program sponsor to join their group.
        </Text>

        <TextInput
          style={styles.input}
          value={inviteCode}
          onChangeText={setInviteCode}
          placeholder="A1B2C3"
          placeholderTextColor={c.text3}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={8}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleJoin}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Joining…' : 'Join Program'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancel} onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: space.xxxl },
  emoji: { fontSize: 56, textAlign: 'center', marginBottom: space.lg },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: c.text,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: c.text2,
    textAlign: 'center',
    marginTop: space.sm,
    marginBottom: space.xxxl,
    lineHeight: 20,
    paddingHorizontal: space.md,
  },
  input: {
    backgroundColor: c.surface,
    borderRadius: radii.md,
    padding: space.lg,
    fontSize: 22,
    color: c.text,
    borderWidth: 1,
    borderColor: c.border,
    marginBottom: space.lg,
    textAlign: 'center',
    letterSpacing: 6,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  button: {
    backgroundColor: c.primary,
    borderRadius: radii.md,
    padding: space.lg,
    alignItems: 'center',
    marginBottom: space.md,
  },
  buttonDisabled: { opacity: 0.55 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  cancel: { alignItems: 'center', paddingVertical: space.sm },
  cancelText: { color: c.text2, fontSize: 14, fontWeight: '500' },
});
