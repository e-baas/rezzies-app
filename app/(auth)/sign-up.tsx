import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { c, radii, space } from '../../src/theme/tokens';

// Visual polish v2 (TYC-137): dark + token-driven, mirrors sign-in.tsx.

export default function SignUp() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const signUp = useAuthStore((s) => s.signUp);

  const handleSignUp = async () => {
    if (!displayName || !email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    const { error } = await signUp(email, password, displayName);
    setLoading(false);
    if (error) {
      Alert.alert('Sign Up Failed', error);
    } else {
      Alert.alert('Success', 'Account created! You can now sign in.', [
        { text: 'OK', onPress: () => router.replace('/(auth)/sign-in') },
      ]);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.inner}>
        <Text style={styles.logo}>🏆</Text>
        <Text style={styles.title}>Join The Rezzies</Text>
        <Text style={styles.subtitle}>
          Create your account to get started
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Display name"
          placeholderTextColor={c.text3}
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={c.text3}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          placeholder="Password (min 6 characters)"
          placeholderTextColor={c.text3}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSignUp}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Creating…' : 'Create Account'}
          </Text>
        </TouchableOpacity>

        <Link href="/(auth)/sign-in" style={styles.link}>
          <Text style={styles.linkText}>
            Already have an account?{' '}
            <Text style={styles.linkAccent}>Sign In</Text>
          </Text>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: space.xxxl },
  logo: { fontSize: 48, textAlign: 'center', marginBottom: space.sm },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: c.text,
    textAlign: 'center',
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 14,
    color: c.text2,
    textAlign: 'center',
    marginTop: space.sm,
    marginBottom: space.xxxl,
  },
  input: {
    backgroundColor: c.surface,
    borderRadius: radii.md,
    padding: space.lg,
    fontSize: 16,
    color: c.text,
    marginBottom: space.md,
    borderWidth: 1,
    borderColor: c.border,
  },
  button: {
    backgroundColor: c.primary,
    borderRadius: radii.md,
    padding: space.lg,
    alignItems: 'center',
    marginTop: space.sm,
    marginBottom: space.lg,
  },
  buttonDisabled: { opacity: 0.55 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  link: { alignItems: 'center' },
  linkText: { color: c.text2, fontSize: 14 },
  linkAccent: { color: c.secondary, fontWeight: '700' },
});
