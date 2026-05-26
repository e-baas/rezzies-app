import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, Switch,
} from 'react-native';
import { router } from 'expo-router';
import { useProgramStore } from '../src/stores/programStore';

interface NewHabit {
  name: string;
  points: number;
  emoji: string;
  enabled: boolean;
}

interface NewBonus {
  name: string;
  description: string;
  target: number;
  award: number;
  unit: string;
  monthIndex: number; // 0-11
}

// === Layer 2: Full habit library (~20 pre-built) ===
const HABIT_LIBRARY: NewHabit[] = [
  { name: 'Sleep 7+ Hours', points: 15, emoji: '😴', enabled: true },
  { name: 'Exercise 30 Min', points: 15, emoji: '🏃', enabled: true },
  { name: 'Steps 8,500', points: 10, emoji: '🚶', enabled: true },
  { name: "Didn't Eat Out", points: 10, emoji: '🥗', enabled: true },
  { name: 'Veggies 1 Cup', points: 5, emoji: '🥦', enabled: true },
  { name: 'Stretch 10 Min', points: 5, emoji: '🧘', enabled: true },
  { name: 'Creativity 10 Min', points: 5, emoji: '🎨', enabled: true },
  { name: 'Floss', points: 5, emoji: '🦷', enabled: true },
  { name: 'Meditate 5 Min', points: 5, emoji: '🧠', enabled: false },
  { name: 'Read 20 Min', points: 10, emoji: '📖', enabled: false },
  { name: 'No Social Media', points: 10, emoji: '📵', enabled: false },
  { name: 'Gratitude Journal', points: 5, emoji: '✍️', enabled: false },
  { name: 'Drink 8 Cups Water', points: 10, emoji: '💧', enabled: false },
  { name: 'Vitamins', points: 5, emoji: '💊', enabled: false },
  { name: 'Walk Dog', points: 5, emoji: '🐕', enabled: false },
  { name: 'Make Bed', points: 5, emoji: '🛏️', enabled: false },
  { name: 'No screens after 10PM', points: 10, emoji: '🌙', enabled: false },
  { name: 'Cold Shower', points: 10, emoji: '🚿', enabled: false },
  { name: 'Practice instrument', points: 10, emoji: '🎸', enabled: false },
  { name: 'Call a friend/family', points: 5, emoji: '📞', enabled: false },
];

// === Layer 3: Monthly bonus templates ===
const BONUS_TEMPLATES = [
  { name: 'Read Pages', description: 'Read pages this month', target: 400, award: 700, unit: 'pages' },
  { name: 'Plank Challenge', description: 'Plank every day', target: 28, award: 700, unit: 'days' },
  { name: 'No Eat Before Sleep', description: 'No eating 3 hours before bed', target: 20, award: 700, unit: 'days' },
  { name: 'Steps Challenge', description: 'Walk steps this month', target: 250000, award: 700, unit: 'steps' },
  { name: 'Meditation Minutes', description: 'Meditate minutes this month', target: 300, award: 700, unit: 'minutes' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function CreateProgram() {
  const [step, setStep] = useState(1); // 1: Shell, 2: Habits, 3: Bonuses, 4: Preview
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [groupName, setGroupName] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(
    new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0]
  );
  const [prizePoolAmount, setPrizePoolAmount] = useState('0');
  const [prizeStructure, setPrizeStructure] = useState('PLACEMENT');
  const [streakGracePeriod, setStreakGracePeriod] = useState(false);

  const [habits, setHabits] = useState<NewHabit[]>(HABIT_LIBRARY.map((h) => ({ ...h })));
  const [customHabitName, setCustomHabitName] = useState('');
  const [customHabitPoints, setCustomHabitPoints] = useState('5');
  const [customHabitEmoji, setCustomHabitEmoji] = useState('');

  const [bonuses, setBonuses] = useState<NewBonus[]>([]);
  const [loading, setLoading] = useState(false);
  const [createdInviteCode, setCreatedInviteCode] = useState('');

  const createProgram = useProgramStore((s) => s.createProgram);

  const toggleHabit = (index: number) => {
    const updated = [...habits];
    updated[index] = { ...updated[index], enabled: !updated[index].enabled };
    setHabits(updated);
  };

  const updateHabitPoints = (index: number, points: number) => {
    const updated = [...habits];
    updated[index] = { ...updated[index], points: Math.max(1, points) };
    setHabits(updated);
  };

  const addCustomHabit = () => {
    if (!customHabitName.trim()) return;
    setHabits([
      ...habits,
      {
        name: customHabitName.trim(),
        points: parseInt(customHabitPoints) || 5,
        emoji: customHabitEmoji || '⭐',
        enabled: true,
      },
    ]);
    setCustomHabitName('');
    setCustomHabitPoints('5');
    setCustomHabitEmoji('');
  };

  const removeHabit = (index: number) => {
    // Only remove custom habits (index >= HABIT_LIBRARY.length)
    if (index < HABIT_LIBRARY.length) return;
    setHabits(habits.filter((_, i) => i !== index));
  };

  const updateBonus = (index: number, field: keyof NewBonus, value: string | number) => {
    const updated = [...bonuses];
    (updated[index] as any)[field] = value;
    setBonuses(updated);
  };

  const addBonusFromTemplate = (template: typeof BONUS_TEMPLATES[0], monthIndex: number) => {
    setBonuses([
      ...bonuses,
      { ...template, monthIndex },
    ]);
  };

  const addEmptyBonus = () => {
    setBonuses([
      ...bonuses,
      { name: '', description: '', target: 28, award: 700, unit: 'days', monthIndex: bonuses.length % 12 },
    ]);
  };

  const removeBonus = (index: number) => {
    setBonuses(bonuses.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a program name');
      return;
    }
    const enabledHabits = habits.filter((h) => h.enabled && h.name.trim());
    if (enabledHabits.length === 0) {
      Alert.alert('Error', 'Please enable at least one daily habit');
      return;
    }
    setLoading(true);
    const result = await createProgram({
      name: name.trim(),
      description: description.trim(),
      groupName: groupName.trim(),
      startDate,
      endDate,
      prizePoolAmount: parseInt(prizePoolAmount) || 0,
      prizeStructure,
      streakGracePeriod,
      habits: enabledHabits.map((h) => ({ name: h.name, points: h.points, emoji: h.emoji })),
      monthlyBonuses: bonuses
        .filter((b) => b.name.trim())
        .map((b) => ({
          name: b.name,
          description: b.description,
          target: b.target,
          award: b.award,
          unit: b.unit,
          periodId: `${b.monthIndex}`,
        })),
    });
    setLoading(false);
    if (result.error) {
      Alert.alert('Error', result.error);
    } else if (result.inviteCode) {
      setCreatedInviteCode(result.inviteCode);
      setStep(5); // Show invite code screen
    }
  };

  const enabledHabitCount = habits.filter((h) => h.enabled).length;
  const activeBonuses = bonuses.filter((b) => b.name.trim());

  // === Step 5: Invite code success screen ===
  if (step === 5) {
    return (
      <View style={styles.successContainer}>
        <Text style={styles.successEmoji}>🎉</Text>
        <Text style={styles.successTitle}>Program Created!</Text>
        <Text style={styles.successSubtitle}>Share this invite code with your group:</Text>
        <View style={styles.inviteCodeBox}>
          <Text style={styles.inviteCodeText}>{createdInviteCode}</Text>
        </View>
        <Text style={styles.inviteHint}>Your group enters this code on the Join screen</Text>
        <TouchableOpacity style={styles.ctaButton} onPress={() => router.replace('/(tabs)/home')}>
          <Text style={styles.ctaText}>Go to Daily Check-in</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Create Program</Text>
        <View style={styles.stepIndicator}>
          {[1, 2, 3, 4].map((s) => (
            <View key={s} style={[styles.stepDot, step === s && styles.stepDotActive, step > s && styles.stepDotDone]}>
              <Text style={[styles.stepDotText, step >= s && styles.stepDotTextActive]}>{s}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.stepLabel}>
          {step === 1 ? 'Program Details' : step === 2 ? 'Daily Habits' : step === 3 ? 'Monthly Bonuses' : 'Review & Launch'}
        </Text>

        {/* ============ LAYER 1: Program Shell ============ */}
        {step === 1 && (
          <View>
            <Text style={styles.sectionTitle}>Program Shell</Text>

            <Text style={styles.label}>Program Name *</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g., 2026 Rezzies" placeholderTextColor="#9CA3AF" />

            <Text style={styles.label}>Group Name</Text>
            <TextInput style={styles.input} value={groupName} onChangeText={setGroupName} placeholder="e.g., The Rezzies 2026" placeholderTextColor="#9CA3AF" />

            <Text style={styles.label}>Description</Text>
            <TextInput style={[styles.input, styles.textarea]} value={description} onChangeText={setDescription} placeholder="What's this program about?" placeholderTextColor="#9CA3AF" multiline numberOfLines={3} />

            <View style={styles.dateRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Start Date</Text>
                <TextInput style={styles.input} value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" placeholderTextColor="#9CA3AF" />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>End Date</Text>
                <TextInput style={styles.input} value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" placeholderTextColor="#9CA3AF" />
              </View>
            </View>

            <Text style={styles.sectionTitle}>Prize Pool (v1 — display only)</Text>
            <Text style={styles.label}>Total Prize Pool ($)</Text>
            <TextInput style={styles.input} value={prizePoolAmount} onChangeText={setPrizePoolAmount} keyboardType="numeric" placeholder="0" placeholderTextColor="#9CA3AF" />

            <Text style={styles.label}>Prize Distribution</Text>
            <View style={styles.prizeOptions}>
              {['PLACEMENT', 'TIERED', 'POOL_PERCENTAGE', 'FIXED_PER_WINNER'].map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.prizeOption, prizeStructure === p && styles.prizeOptionActive]}
                  onPress={() => setPrizeStructure(p)}
                >
                  <Text style={[styles.prizeOptionText, prizeStructure === p && styles.prizeOptionTextActive]}>
                    {p.replace(/_/g, ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.toggleRow}>
              <View>
                <Text style={styles.label}>Streak Grace Period</Text>
                <Text style={styles.toggleHint}>1 missed day doesn't break the streak</Text>
              </View>
              <Switch
                value={streakGracePeriod}
                onValueChange={setStreakGracePeriod}
                trackColor={{ false: '#D1D5DB', true: '#818CF8' }}
                thumbColor={streakGracePeriod ? '#6366F1' : '#9CA3AF'}
              />
            </View>
          </View>
        )}

        {/* ============ LAYER 2: Daily Habits ============ */}
        {step === 2 && (
          <View>
            <Text style={styles.sectionTitle}>Daily Habits</Text>
            <Text style={styles.sectionDesc}>
              Toggle habits on/off to include in your program. Adjust point weights to set importance.{'\n'}
              {enabledHabitCount} habits enabled
            </Text>

            {/* Habit library — toggles */}
            {habits.map((h, i) => (
              <View key={i} style={styles.habitCard}>
                <View style={styles.habitCardLeft}>
                  <TouchableOpacity onPress={() => toggleHabit(i)} style={styles.habitToggle}>
                    <View style={[styles.checkbox, h.enabled && styles.checkboxChecked]}>
                      {h.enabled && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                  <Text style={styles.habitEmoji}>{h.emoji}</Text>
                  <Text style={[styles.habitName, !h.enabled && styles.habitNameDisabled]}>{h.name}</Text>
                </View>
                <View style={styles.habitCardRight}>
                  <TouchableOpacity
                    style={styles.ptBtn}
                    onPress={() => updateHabitPoints(i, h.points - 1)}
                    disabled={!h.enabled || h.points <= 1}
                  >
                    <Text style={styles.ptBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={[styles.ptValue, !h.enabled && styles.ptValueDisabled]}>+{h.points}</Text>
                  <TouchableOpacity
                    style={styles.ptBtn}
                    onPress={() => updateHabitPoints(i, h.points + 1)}
                    disabled={!h.enabled}
                  >
                    <Text style={styles.ptBtnText}>+</Text>
                  </TouchableOpacity>
                  {/* Remove button for custom habits */}
                  {i >= HABIT_LIBRARY.length && (
                    <TouchableOpacity onPress={() => removeHabit(i)} style={styles.removeBtn}>
                      <Text style={styles.removeBtnText}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}

            {/* Add custom habit */}
            <View style={styles.customHabit}>
              <Text style={styles.label}>Add Custom Habit</Text>
              <View style={styles.customRow}>
                <TextInput
                  style={styles.customEmojiInput}
                  value={customHabitEmoji}
                  onChangeText={setCustomHabitEmoji}
                  placeholder="⭐"
                  placeholderTextColor="#9CA3AF"
                  maxLength={2}
                />
                <TextInput
                  style={styles.customNameInput}
                  value={customHabitName}
                  onChangeText={setCustomHabitName}
                  placeholder="Habit name"
                  placeholderTextColor="#9CA3AF"
                />
                <TextInput
                  style={styles.customPtsInput}
                  value={customHabitPoints}
                  onChangeText={setCustomHabitPoints}
                  keyboardType="numeric"
                  placeholder="5"
                  placeholderTextColor="#9CA3AF"
                />
                <TouchableOpacity style={styles.customAddBtn} onPress={addCustomHabit}>
                  <Text style={styles.customAddBtnText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* ============ LAYER 3: Monthly Bonus Challenges ============ */}
        {step === 3 && (
          <View>
            <Text style={styles.sectionTitle}>Monthly Bonus Challenges</Text>
            <Text style={styles.sectionDesc}>
              Set stretch goals for specific months. Each challenge has a target and a fixed point award.
            </Text>

            {/* Template quick-add */}
            <Text style={styles.label}>Quick-add from templates:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.templateScroll}>
              {BONUS_TEMPLATES.map((t, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.templatePill}
                  onPress={() => {
                    const nextMonth = bonuses.length % 12;
                    addBonusFromTemplate(t, nextMonth);
                  }}
                >
                  <Text style={styles.templatePillText}>{t.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Existing bonuses */}
            {activeBonuses.map((b, i) => (
              <View key={i} style={styles.bonusCard}>
                <View style={styles.bonusCardHeader}>
                  <Text style={styles.bonusMonth}>{MONTHS[b.monthIndex]}</Text>
                  <TouchableOpacity onPress={() => removeBonus(i)}>
                    <Text style={styles.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
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

            <TouchableOpacity style={styles.addBonusBtn} onPress={addEmptyBonus}>
              <Text style={styles.addBonusBtnText}>+ Add Bonus Challenge</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ============ LAYER 4: Preview ============ */}
        {step === 4 && (
          <View>
            <Text style={styles.sectionTitle}>Program Preview</Text>
            <Text style={styles.sectionDesc}>This is what your participants will see.</Text>

            <View style={styles.previewCard}>
              <Text style={styles.previewName}>{name || 'Untitled Program'}</Text>
              <Text style={styles.previewDates}>{startDate} → {endDate}</Text>
              {groupName ? <Text style={styles.previewGroup}>Group: {groupName}</Text> : null}

              <View style={styles.previewDivider} />

              <Text style={styles.previewSectionTitle}>Daily Habits ({enabledHabitCount})</Text>
              {habits.filter((h) => h.enabled).map((h, i) => (
                <View key={i} style={styles.previewHabit}>
                  <Text style={styles.previewHabitEmoji}>{h.emoji}</Text>
                  <Text style={styles.previewHabitName}>{h.name}</Text>
                  <Text style={styles.previewHabitPts}>+{h.points}</Text>
                </View>
              ))}

              {activeBonuses.length > 0 && (
                <>
                  <View style={styles.previewDivider} />
                  <Text style={styles.previewSectionTitle}>Monthly Bonuses ({activeBonuses.length})</Text>
                  {activeBonuses.map((b, i) => (
                    <View key={i} style={styles.previewBonus}>
                      <Text style={styles.previewBonusMonth}>{MONTHS[b.monthIndex]}:</Text>
                      <Text style={styles.previewBonusName}>{b.name} — {b.target} {b.unit} → +{b.award} pts</Text>
                    </View>
                  ))}
                </>
              )}

              <View style={styles.previewDivider} />
              <View style={styles.previewStats}>
                <Text style={styles.previewStat}>🏆 {prizeStructure.replace(/_/g, ' ')}</Text>
                {prizePoolAmount !== '0' && (
                  <Text style={styles.previewStat}>💰 ${parseInt(prizePoolAmount).toLocaleString()} pool</Text>
                )}
                {streakGracePeriod && (
                  <Text style={styles.previewStat}>🛡️ Streak grace period enabled</Text>
                )}
              </View>
            </View>

            <Text style={styles.previewCta}>Ready to invite your group?</Text>
          </View>
        )}

        {/* ============ Navigation Buttons ============ */}
        <View style={styles.nav}>
          {step > 1 ? (
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep(step - 1)}>
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}
          {step < 4 ? (
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
  title: { fontSize: 24, fontWeight: '800', color: '#1F2937', marginBottom: 12 },
  stepIndicator: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  stepDot: {
    width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#E5E7EB',
  },
  stepDotActive: { backgroundColor: '#6366F1' },
  stepDotDone: { backgroundColor: '#818CF8' },
  stepDotText: { fontSize: 13, fontWeight: '700', color: '#9CA3AF' },
  stepDotTextActive: { color: 'white' },
  stepLabel: { fontSize: 14, color: '#6366F1', fontWeight: '600', marginBottom: 16, marginTop: 4 },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937', marginBottom: 4, marginTop: 8 },
  sectionDesc: { fontSize: 13, color: '#6B7280', marginBottom: 16, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: '600', color: '#4B5563', marginBottom: 4, marginTop: 12 },
  input: {
    backgroundColor: 'white', borderRadius: 10, padding: 14, fontSize: 15, color: '#1F2937',
    borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 8,
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  dateRow: { flexDirection: 'row' },

  // Prize
  prizeOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  prizeOption: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: 'white',
  },
  prizeOptionActive: { borderColor: '#6366F1', backgroundColor: '#EEF2FF' },
  prizeOptionText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  prizeOptionTextActive: { color: '#4338CA' },

  // Toggle
  toggleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'white', padding: 16, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB',
    marginTop: 8, marginBottom: 8,
  },
  toggleHint: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },

  // Habits Layer 2
  habitCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'white', borderRadius: 10, padding: 12, paddingRight: 8,
    marginBottom: 6, borderWidth: 1, borderColor: '#E5E7EB',
  },
  habitCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  habitToggle: { marginRight: 8 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#D1D5DB',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
  checkmark: { color: 'white', fontSize: 12, fontWeight: '700' },
  habitEmoji: { fontSize: 18, marginRight: 8 },
  habitName: { fontSize: 14, fontWeight: '500', color: '#1F2937', flex: 1 },
  habitNameDisabled: { color: '#D1D5DB' },
  habitCardRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ptBtn: {
    width: 28, height: 28, borderRadius: 6, backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },
  ptBtnText: { fontSize: 16, fontWeight: '600', color: '#4B5563' },
  ptValue: { fontSize: 14, fontWeight: '700', color: '#6366F1', width: 32, textAlign: 'center' },
  ptValueDisabled: { color: '#D1D5DB' },
  removeBtn: { marginLeft: 4, padding: 4 },
  removeBtnText: { fontSize: 16, color: '#EF4444', fontWeight: '600' },

  // Custom habit
  customHabit: { marginTop: 16, backgroundColor: '#F0FDF4', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#BBF7D0' },
  customRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  customEmojiInput: {
    width: 40, backgroundColor: 'white', borderRadius: 8, paddingVertical: 8,
    fontSize: 16, textAlign: 'center', borderWidth: 1, borderColor: '#E5E7EB',
  },
  customNameInput: {
    flex: 1, backgroundColor: 'white', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10,
    fontSize: 14, borderWidth: 1, borderColor: '#E5E7EB',
  },
  customPtsInput: {
    width: 48, backgroundColor: 'white', borderRadius: 8, paddingVertical: 8,
    fontSize: 14, textAlign: 'center', borderWidth: 1, borderColor: '#E5E7EB',
  },
  customAddBtn: {
    backgroundColor: '#059669', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
  },
  customAddBtnText: { color: 'white', fontSize: 13, fontWeight: '700' },

  // Bonuses Layer 3
  templateScroll: { marginBottom: 16 },
  templatePill: {
    backgroundColor: '#EEF2FF', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#C7D2FE',
  },
  templatePillText: { fontSize: 13, fontWeight: '600', color: '#4338CA' },
  bonusCard: {
    backgroundColor: 'white', borderRadius: 12, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#F3F4F6',
  },
  bonusCardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 8,
  },
  bonusMonth: { fontSize: 14, fontWeight: '700', color: '#6366F1' },
  bonusRow: { flexDirection: 'row' },
  addBonusBtn: {
    borderWidth: 2, borderColor: '#6366F1', borderStyle: 'dashed',
    borderRadius: 12, padding: 16, alignItems: 'center',
  },
  addBonusBtnText: { fontSize: 15, fontWeight: '600', color: '#6366F1' },

  // Preview Layer 4
  previewCard: {
    backgroundColor: 'white', borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 16,
  },
  previewName: { fontSize: 20, fontWeight: '800', color: '#1F2937', marginBottom: 4 },
  previewDates: { fontSize: 13, color: '#6B7280' },
  previewGroup: { fontSize: 13, color: '#6366F1', fontWeight: '600', marginTop: 2 },
  previewDivider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 12 },
  previewSectionTitle: { fontSize: 14, fontWeight: '700', color: '#4B5563', marginBottom: 8 },
  previewHabit: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  previewHabitEmoji: { fontSize: 14, marginRight: 6 },
  previewHabitName: { fontSize: 14, color: '#1F2937', flex: 1 },
  previewHabitPts: { fontSize: 13, fontWeight: '600', color: '#6366F1' },
  previewBonus: { flexDirection: 'row', marginBottom: 4 },
  previewBonusMonth: { fontSize: 13, fontWeight: '700', color: '#6366F1', marginRight: 6, width: 36 },
  previewBonusName: { fontSize: 13, color: '#1F2937' },
  previewStats: { gap: 4 },
  previewStat: { fontSize: 13, fontWeight: '600', color: '#4B5563' },
  previewCta: { fontSize: 15, fontWeight: '700', color: '#059669', textAlign: 'center', marginBottom: 8 },

  // Navigation
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

  // Success screen
  successContainer: {
    flex: 1, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  successEmoji: { fontSize: 64, marginBottom: 16 },
  successTitle: { fontSize: 24, fontWeight: '800', color: '#1F2937', marginBottom: 8 },
  successSubtitle: { fontSize: 15, color: '#6B7280', textAlign: 'center', marginBottom: 20 },
  inviteCodeBox: {
    backgroundColor: '#EEF2FF', borderRadius: 16, paddingHorizontal: 32, paddingVertical: 20,
    borderWidth: 2, borderColor: '#C7D2FE', marginBottom: 8,
  },
  inviteCodeText: { fontSize: 32, fontWeight: '800', color: '#4338CA', letterSpacing: 6, textAlign: 'center' },
  inviteHint: { fontSize: 13, color: '#9CA3AF', marginBottom: 24, textAlign: 'center' },
  ctaButton: {
    backgroundColor: '#6366F1', borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14,
  },
  ctaText: { color: 'white', fontSize: 16, fontWeight: '700' },
});
