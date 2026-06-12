import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/stores/authStore';

// Entry route. Send authenticated users into the program (tabs), and
// everyone else to sign-in. The redirect re-evaluates reactively when the
// auth state changes (e.g. right after sign-in), so families always pass
// through authentication before reaching any program content (Bug #1).
export default function Index() {
  const user = useAuthStore((s) => s.user);
  return <Redirect href={user ? '/(tabs)/home' : '/(auth)/sign-in'} />;
}
