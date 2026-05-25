import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useProgramStore } from '../src/stores/programStore';

interface NewHabit {
  name: string;
  points: number;
  emoji: string;
}

interface NewBonus {
  name: string;
  description: string;
  target: number;
  award: number;
  unit: string;
  periodId: string;
}

const DEFAULT_HABITS: NewHabit[] = [
  { name: 'Sleep 7+ Hours', points: 15, emoji: '😴' },
  { name: 'Exercise 30 Min', points: 15, emoji: '🏃' },
  { name: 'Steps 8,500', points: 10, emoji: '🚶' },
  { name: "Didn't Eat Out", points: 10, emoji: '🥗' },
  { name: 'Veggies 1 Cup', points: 5, emoji: '🥦' },
  { name: 'Stretch 10 Min', points: 5, emoji: '🧘' },
  { name: 'Creativity 10 Min', points: 5, emoji: '🎨' },
  { name: 'Floss', points: 5, emoji: '🦷' },
];

const DEFAULT_BONUSES: NewBonus[] = [
  { name: 'Read Pages', description: 'Read 400 pages this month', target: 400, award: 700, unit: 'pages', periodId: '' },
  { name: 'Plank Challenge', description: 'Plank every day', target: 28, award: 700, unit: 'days', periodId: '' },
  { name: 'No Eat Before Sleep', description: 'No eating 3 hours before bed', target: 20, award: 700, unit: 'days', periodId: '' },
];

export default function CreateProgram() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(
    new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0]
  );
  const [habits, setHabits] = useState<NewHabit[]>(DEFAULT_HABITS.map((h) => ({ ...h })));
  const [bonuses, setBonuses] = useState<NewBonus[]>(DEFAULT_BONUSES.map((b) => ({ ...b })));
  const [loading, setLoading] = useState(false);
  const createProgram = useProgramStore((s) => s.createProgram);

  const updateHabit = (index: number, field: keyof NewHabit, value: string | number) => {
    const updated = [...habits];
    (updated[index] as any)[field] = value;
    setHabits(updated);
  };

  const updateBonus = (index: number, field: keyof NewBonus, value: string | number) => {
    const updated = [...bonuses];
    (updated[index] as any)[field] = value;
    setBonuses(updated);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a program name');
      return;
    }
    setLoading(true);
    const { programId, error } = await createProgram({
      name: name.trim(),
      description: description.trim(),
      startDate,
      endDate,
      habits: habits.filter((h) => h.name.trim()),
      monthlyBonuses: bonuses
        .filter((b) => b.name.trim())
        .map((b, i) => ({ ...b, periodId: `${i}` })),
    });
    setLoading(false);
    if (error) {
      Alert.alert('Error', error);
    } else {
      Alert.alert('Success!', 'Program created! Share the invite code with your group.', [
        { text: 'Go to Check-in', onPress: () => router.replace('/(tabs)/home') },
      ]);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Create Program</Text>
        <Text style={styles.step}>Step {step} of 3</Text>

        {/* Step 1: Basics */}
        {step === 1 && (
          <View>
            <Text style={styles.sectionTitle}>Program Details</Text>
            <Text style={styles.label}>Program Name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g., 2026 Rezzies" placeholderTextColor="#9CA3AF" />
            <Text style={styles.label}>Description (optional)</Text>
            <TextInput style={[styles.input, styles.textarea]} value={description} onChangeText={setDescription} placeholder="What's this program about?" placeholderTextColor="#9CA3AF" multiline numberOfLines={3} />
            <Text style={styles.label}>Start Date</Text>
            <TextInput style={styles.input} value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" placeholderTextColor="#9CA3AF" />
            <Text style={styles.label}>End Date</Text>
            <TextInput style={styles.input} value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" placeholderTextColor="#9CA3AF" />
          </View>
        )}

        {/* Step 2: Daily Habits */}
        {step === 2 && (
          <View>
            <Text style={styles.sectionTitle}>Daily Habits</Text>
            <Text style={styles.sectionDesc}>Configure the daily checklist. Each habit has a point weight.</Text>
            {habits.map((h, i) => (
              <View key={i} style={styles.habitRow}>
                <TextInput style={styles.emojiInput} value={h.emoji} onChangeText={(v) => updateHabit(i, 'emoji', v)} maxLength={2} />
                <TextInput style={styles.habitNameInput} value={h.name} onChangeText={(v) => updateHabit(i, 'name', v)} placeholder="Habit name" placeholderTextColor="#9CA3AF" />
                <TextInput style={styles.pointsInput} value={String(h.points)} onChangeText={(v) => updateHabit(i, 'points', parseInt(v) || 0)} keyboardType="numeric" />
                <Text style={styles.ptsLabel}>pts</Text>
              </View>
            ))}
          </View>
        )}

        {/* Step 3: Monthly Bonuses */}
        {step === 3 && (
          <View>
            <Text style={styles.sectionTitle}>Monthly Bonus Challenges</Text>
            <Text style={styles.sectionDesc}>Set stretch goals for each month (optional).</Text>
            {bonuses.slice(0, 3).map((b, i) => (
              <View key={i} style={styles.bonusCard}>
                <Text style={styles.bonusMonth}>Month {i + 1}</Text>
                <TextInput style={styles.input} value={b.name} onChangeText={(v) => updateBonus(i, 'name', v)} placeholder="Challenge name" placeholderTextColor="#9CA3AF" />
                <TextInput style={styles.input} value={b.description} onChangeText={(v) => updateBonus(i, 'description', v)} placeholder="Description" placeholderTextColor="#9CA3AF" />
                <View style={styles.bonusRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Target</Text>
                    <TextInput style={styles.input} value={String(b.target)} onChangeText={(v) => updateBonus(i, 'target', parseInt(v) || 0)} keyboardType="numeric" />
                  </View>
                  <View style={{ width: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Award (pts)</Text>
                    <TextInput style={styles.input} value={String(b.award)} onChangeText={(v) => updateBonus(i, 'award', parseInt(v) || 0)} keyboardType="numeric" />
                  </View>
                </View>
                <TextInput style={styles.input} value={b.unit} onChangeText={(v) => updateBonus(i, 'unit', v)} placeholder="Unit (pages, days, etc.)" placeholderTextColor="#9CA3AF" />
              </View>
            ))}
          </View>
        )}

        {/* Navigation */}
        <View style={styles.nav}>
          {step > 1 && (
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep(step - 1)}>
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
          )}
          {step < 3 ? (
            <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(step + 1)}>
              <Text style={styles.nextText}>Next</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.createBtn} onPress={handleCreate} disabled={loading}>
              <Text style={styles.createText}>{loading ? 'Creating...' : 'Create Program'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '800', color: '#1F2937', marginBottom: 4 },
  step: { fontSize: 14, color: '#6366F1', fontWeight: '600', marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937', marginBottom: 4 },
  sectionDesc: { fontSize: 13, color: '#6B7280', marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#4B5563', marginBottom: 4, marginTop: 12 },
  input: {
    backgroundColor: 'white', borderRadius: 10, padding: 14, fontSize: 15, color: '#1F2937',
    borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 8,
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  habitRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8,
  },
  emojiInput: {
    backgroundColor: 'white', borderRadius: 8, padding: 10, fontSize: 18, width: 44, textAlign: 'center',
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  habitNameInput: {
    flex: 1, backgroundColor: 'white', borderRadius: 8, padding: 10, fontSize: 14, color: '#1F2937',
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  pointsInput: {
    backgroundColor: 'white', borderRadius: 8, padding: 10, fontSize: 14, width: 56, textAlign: 'center',
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  ptsLabel: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  bonusCard: {
    backgroundColor: 'white', borderRadius: 12, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#F3F4F6',
  },
  bonusMonth: { fontSize: 14, fontWeight: '700', color: '#6366F1', marginBottom: 8 },
  bonusRow: { flexDirection: 'row' },
  nav: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 24,
  },
  backBtn: {
    paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1, borderColor: '#D1D5DB',
  },
  backText: { fontSize: 15, fontWeight: '600', color: '#4B5563' },
  nextBtn: {
    backgroundColor: '#6366F1', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12,
  },
  nextText: { fontSize: 15, fontWeight: '700', color: 'white' },
  createBtn: {
    backgroundColor: '#059669', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12,
  },
  createText: { fontSize: 15, fontWeight: '700', color: 'white' },
});
