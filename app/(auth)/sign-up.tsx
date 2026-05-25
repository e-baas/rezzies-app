import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Link, router } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';

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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.logo}>🏆</Text>
        <Text style={styles.title}>Join The Rezzies</Text>
        <Text style={styles.subtitle}>Create your account to get started</Text>

        <TextInput
          style={styles.input}
          placeholder="Display Name"
          placeholderTextColor="#6B7280"
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#6B7280"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          placeholder="Password (min 6 characters)"
          placeholderTextColor="#6B7280"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.button} onPress={handleSignUp} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Creating...' : 'Create Account'}</Text>
        </TouchableOpacity>

        <Link href="/(auth)/sign-in" style={styles.link}>
          <Text style={styles.linkText}>Already have an account? Sign In</Text>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  logo: { fontSize: 48, textAlign: 'center', marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '800', color: 'white', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginTop: 8, marginBottom: 32 },
  input: {
    backgroundColor: '#1E293B', borderRadius: 12, padding: 16, fontSize: 16, color: 'white',
    marginBottom: 12, borderWidth: 1, borderColor: '#334155',
  },
  button: {
    backgroundColor: '#6366F1', borderRadius: 12, padding: 16, alignItems: 'center',
    marginTop: 8, marginBottom: 16,
  },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '700' },
  link: { alignItems: 'center' },
  linkText: { color: '#818CF8', fontSize: 14 },
});
