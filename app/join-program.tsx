import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useProgramStore } from '../src/stores/programStore';

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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
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
          placeholder="Invite code (e.g., A1B2C3)"
          placeholderTextColor="#9CA3AF"
          autoCapitalize="characters"
          autoCorrect={false}
        />

        <TouchableOpacity style={styles.button} onPress={handleJoin} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Joining...' : 'Join Program'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancel} onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  emoji: { fontSize: 48, textAlign: 'center', marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '800', color: '#1F2937', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 8, marginBottom: 32, lineHeight: 20 },
  input: {
    backgroundColor: 'white', borderRadius: 12, padding: 16, fontSize: 20, color: '#1F2937',
    borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 16, textAlign: 'center',
    letterSpacing: 4, fontWeight: '700',
  },
  button: {
    backgroundColor: '#6366F1', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12,
  },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '700' },
  cancel: { alignItems: 'center', paddingVertical: 8 },
  cancelText: { color: '#6B7280', fontSize: 14 },
});
