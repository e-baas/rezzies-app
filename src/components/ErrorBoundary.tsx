import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { submitBugReport } from '../lib/bugReports';
import { getCurrentScreen } from '../lib/errorReporter';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }): void {
    // Fire-and-forget — we never want the reporter to break the recovery UI
    void submitBugReport({
      description: `[boundary] ${error.message}`,
      severity: 'blocks',
      source: 'js_error',
      screen_name: getCurrentScreen(),
      stack_trace: `${error.stack ?? ''}\n\nComponent stack:${info.componentStack}`,
    });
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.emoji}>😞</Text>
          <Text style={styles.title}>Something broke</Text>
          <Text style={styles.body}>
            We logged the error to the team. Tap "Try Again" to keep going — if
            it keeps happening, send us a note from Profile → Report a Bug.
          </Text>
          <Text style={styles.errorText}>{this.state.error.message}</Text>
          <TouchableOpacity style={styles.button} onPress={this.reset}>
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emoji: { fontSize: 56, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: 'white', marginBottom: 12 },
  body: { fontSize: 15, color: '#94A3B8', textAlign: 'center', marginBottom: 16, lineHeight: 22 },
  errorText: { fontSize: 12, color: '#FCA5A5', fontFamily: 'monospace', textAlign: 'center', marginBottom: 24 },
  button: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonText: { color: 'white', fontWeight: '700', fontSize: 16 },
});
