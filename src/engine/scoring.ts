// === Abstracted Scoring Engine ===
// Each scoringType is processed through a dedicated handler.
// Adding WEARABLE_AUTO in v2: register a new handler, nothing else changes.
//
// The engine operates on ScoringInput → ScoringResult.
// All business logic lives here; UI only calls `score(input)` and displays the result.

import type { ScoringInput, ScoringResult } from '../types';

type ScoringHandler = (input: ScoringInput) => ScoringResult;

const handlers: Record<string, ScoringHandler> = {};

export function registerHandler(type: string, handler: ScoringHandler): void {
  handlers[type] = handler;
}

// === DAILY_HABIT handler ===
// Payload: { habitIds: string[], habitPoints: Record<string, number> }
registerHandler('DAILY_HABIT', (input) => {
  const { habitIds, habitPoints } = input.payload as {
    habitIds: string[];
    habitPoints: Record<string, number>;
  };
  const points = habitIds.reduce((sum, id) => sum + (habitPoints[id] || 0), 0);
  return {
    points,
    habit_count: habitIds.length,
    details: { habits_completed: habitIds },
  };
});

// === MONTHLY_BONUS handler ===
// Payload: { current: number, target: number, award: number }
registerHandler('MONTHLY_BONUS', (input) => {
  const { current, target, award } = input.payload as {
    current: number;
    target: number;
    award: number;
  };
  const completed = current >= target;
  return {
    points: completed ? award : 0,
    habit_count: 0, // bonuses don't count as habits
    details: { current, target, completed },
  };
});

// === COMPETITIVE handler ===
// Payload: { rank: number, placementScoring: Record<string, number> }
registerHandler('COMPETITIVE', (input) => {
  const { rank, placementScoring } = input.payload as {
    rank: number;
    placementScoring: Record<string, number>;
  };
  const points = placementScoring[String(rank)] || 0;
  return { points, habit_count: 0, details: { rank, points } };
});

// === HURDLE handler ===
// Payload: { completed: boolean, basePoints: number }
registerHandler('HURDLE', (input) => {
  const { completed, basePoints } = input.payload as {
    completed: boolean;
    basePoints: number;
  };
  return {
    points: completed ? basePoints : 0,
    habit_count: 0,
    details: { completed },
  };
});

// === HURDLE_PLUS_BONUS handler ===
// Payload: { completed: boolean, basePoints: number, bonusRank: number, bonusTiers: {rank: number, points: number}[] }
registerHandler('HURDLE_PLUS_BONUS', (input) => {
  const { completed, basePoints, bonusRank, bonusTiers } = input.payload as {
    completed: boolean;
    basePoints: number;
    bonusRank: number;
    bonusTiers: { rank: number; points: number }[];
  };
  const base = completed ? basePoints : 0;
  const bonus = bonusTiers.find((t) => t.rank === bonusRank)?.points || 0;
  return {
    points: base + bonus,
    habit_count: 0,
    details: { completed, bonusRank, base, bonus },
  };
});

// === TOURNAMENT handler (same as COMPETITIVE with optional bonus) ===
registerHandler('TOURNAMENT', (input) => {
  const { rank, placementScoring, tournamentBonus } = input.payload as {
    rank: number;
    placementScoring: Record<string, number>;
    tournamentBonus?: number;
  };
  const points = (placementScoring[String(rank)] || 0) + (tournamentBonus || 0);
  return { points, habit_count: 0, details: { rank, points } };
});

// === PERSONAL_GOAL handler ===
// Payload: { achieved: boolean, basePoints: number }
registerHandler('PERSONAL_GOAL', (input) => {
  const { achieved, basePoints } = input.payload as {
    achieved: boolean;
    basePoints: number;
  };
  return {
    points: achieved ? basePoints : 0,
    habit_count: 0,
    details: { achieved },
  };
});

// === WEARABLE_AUTO stub (v2) ===
// Schema slot reserved. Payload mirrors DailyCheck but with auto-detected values.
// In v2: Terra/Vital webhook writes to the same DailyCheck table; this handler
// processes auto-detected habits identically to manual check-ins.
registerHandler('WEARABLE_AUTO', (input) => {
  const { habitIds, habitPoints } = input.payload as {
    habitIds: string[];
    habitPoints: Record<string, number>;
  };
  const points = habitIds.reduce((sum, id) => sum + (habitPoints[id] || 0), 0);
  return {
    points,
    habit_count: habitIds.length,
    details: { habits_completed: habitIds, source: 'wearable_auto' },
  };
});

// === Main entry point ===
export function score(input: ScoringInput): ScoringResult {
  const handler = handlers[input.type];
  if (!handler) {
    console.warn(`No handler registered for scoring type: ${input.type}`);
    return { points: 0, habit_count: 0, details: { error: 'unknown_type' } };
  }
  return handler(input);
}

// === Helper: calculate daily points from habit checklist ===
export function calculateDailyPoints(
  checkedHabitIds: string[],
  habits: { id: string; points: number }[]
): { points: number; habitCount: number } {
  const habitPoints: Record<string, number> = {};
  habits.forEach((h) => (habitPoints[h.id] = h.points));

  const result = score({
    type: 'DAILY_HABIT',
    participant_id: '',
    program_id: '',
    payload: { habitIds: checkedHabitIds, habitPoints },
  });

  return { points: result.points, habitCount: result.habit_count };
}

// === Helper: calculate monthly bonus ===
export function calculateMonthlyBonus(
  current: number,
  target: number,
  award: number
): { points: number; completed: boolean } {
  const result = score({
    type: 'MONTHLY_BONUS',
    participant_id: '',
    program_id: '',
    payload: { current, target, award },
  });
  return { points: result.points, completed: result.details.completed as boolean };
}
