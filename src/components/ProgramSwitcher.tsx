// ProgramSwitcher — bottom-sheet modal to switch between the programs a user
// has joined (bug #17 — "No mechanism to switch between joined programs").
//
// Reads the membership list + active selection from the program store and
// persists the choice via setActiveProgram. Reusable: hosted on both the Home
// header (tap the program name) and the Profile screen.

import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useProgramStore } from '../stores/programStore';
import { c, radii, space } from '../theme/tokens';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function ProgramSwitcher({ visible, onClose }: Props) {
  const memberships = useProgramStore((s) => s.memberships);
  const activeProgramId = useProgramStore((s) => s.activeProgramId);
  const setActiveProgram = useProgramStore((s) => s.setActiveProgram);

  const pick = async (programId: string) => {
    if (programId !== activeProgramId) {
      await setActiveProgram(programId);
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        {/* Stop propagation so taps inside the sheet don't dismiss it */}
        <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>Switch Program</Text>
          <Text style={styles.subtitle}>Pick which program you're checking in to.</Text>

          {memberships.map((m) => {
            const active = m.programId === activeProgramId;
            return (
              <TouchableOpacity
                key={m.programId}
                style={[styles.row, active && styles.rowActive]}
                onPress={() => pick(m.programId)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowText, active && styles.rowTextActive]} numberOfLines={1}>
                    {m.programName}
                  </Text>
                  {m.role === 'SPONSOR' && <Text style={styles.rowMeta}>You sponsor this program</Text>}
                </View>
                {active && <Text style={styles.check}>✓</Text>}
              </TouchableOpacity>
            );
          })}

          {memberships.length === 0 && (
            <Text style={styles.empty}>You haven't joined any programs yet.</Text>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: space.lg,
    paddingBottom: space.xxl,
    borderTopWidth: 1,
    borderColor: c.border,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.border,
    marginBottom: space.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: c.text,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 13,
    color: c.text2,
    marginTop: 2,
    marginBottom: space.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: space.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.bg,
    marginBottom: space.sm,
  },
  rowActive: {
    borderColor: c.secondary,
    backgroundColor: c.secondarySoft,
  },
  rowText: { fontSize: 16, fontWeight: '600', color: c.text },
  rowTextActive: { color: c.secondary },
  rowMeta: { fontSize: 12, color: c.text3, marginTop: 2 },
  check: { fontSize: 18, fontWeight: '800', color: c.secondary, marginLeft: space.sm },
  empty: { fontSize: 14, color: c.text2, textAlign: 'center', paddingVertical: space.lg },
});
