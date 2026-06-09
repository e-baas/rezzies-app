import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { c, radii, space } from '../../src/theme/tokens';
import Logo from '../../src/components/brand/Logo';

// Visual polish v2 (TYC-137):
// - Dark canvas (c.bg) — matches the rest of the first-7-day surfaces
// - Primary CTA = orange (c.primary) — aggregate-progress accent
// - Secondary link = teal (c.secondary) — consistent with active-tab teal
// - Inputs: surface tile + 1pt border on c.border, 14pt radius (radii.md)
// - Spacing on the 8pt grid via `space.*`
// - Style spec doc cmpze514302chs6013gkajwqr

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const signIn = useAuthStore((s) => s.signIn);

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      Alert.alert('Sign In Failed', error);
    } else {
      router.replace('/(tabs)/home');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.inner}>
        <Logo variant="full" theme="dark" width={232} style={styles.logo} />
        <Text style={styles.subtitle}>Sign in to your account</Text>

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
          placeholder="Password"
          placeholderTextColor={c.text3}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSignIn}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Signing in…' : 'Sign In'}
          </Text>
        </TouchableOpacity>

        <Link href="/(auth)/sign-up" style={styles.link}>
          <Text style={styles.linkText}>
            Don't have an account?{' '}
            <Text style={styles.linkAccent}>Sign Up</Text>
          </Text>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: space.xxxl },
  logo: {
    alignSelf: 'center',
    marginBottom: space.lg,
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
