import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Modal, Pressable, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApi } from '../hooks/useApi';
import { API } from '../api';
import { Card } from '../components/Card';
import { LoadingView } from '../components/LoadingView';
import { ErrorView } from '../components/ErrorView';
import { Badge } from '../components/Badge';
import { Colors, Spacing } from '../theme';
import type { AgendaEntry } from '../api/types';

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(startMs: number, endMs: number) {
  const mins = Math.round((endMs - startMs) / 60000);
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`;
}

const DAYS_SHORT = ['L', 'M', 'M', 'J', 'V', 'S'];
const DAYS_FULL = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTHS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function getTypeColor(type: string) {
  if (type === 'Examen' || type?.toLowerCase().includes('exam')) return Colors.danger;
  if (type?.toLowerCase().includes('tp') || type?.toLowerCase().includes('pratique')) return Colors.success;
  return Colors.primary;
}

// ── Calendar header (collapsible on scroll) ──────────────────────────────────

const CALENDAR_HEIGHT = 96;

interface CalendarHeaderProps {
  weekStart: Date;
  today: Date;
  grouped: Record<string, AgendaEntry[]>;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  animValue: Animated.Value;
}

function CalendarHeader({ weekStart, today, grouped, onPrev, onNext, onToday, animValue }: CalendarHeaderProps) {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const headerLabel = `${MONTHS_FR[weekStart.getMonth()]} ${weekStart.getFullYear()}`;
  const todayMs = today.getTime();

  const height = animValue.interpolate({ inputRange: [0, CALENDAR_HEIGHT], outputRange: [CALENDAR_HEIGHT, 0], extrapolate: 'clamp' });
  const opacity = animValue.interpolate({ inputRange: [0, CALENDAR_HEIGHT * 0.6], outputRange: [1, 0], extrapolate: 'clamp' });

  const weekDays = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <View style={styles.calendarContainer}>
      {/* Nav bar always visible */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={onPrev} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={20} color={Colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onToday} style={styles.navCenter}>
          <Text style={styles.navMonth}>{headerLabel}</Text>
          <Text style={styles.navRange}>
            {weekStart.getDate()} – {weekEnd.getDate()} {MONTHS_FR[weekEnd.getMonth()]}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onNext} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Day tiles — fade + collapse on scroll */}
      <Animated.View style={[styles.dayTiles, { height, opacity, overflow: 'hidden' }]}>
        {weekDays.map((day, i) => {
          const dayMs = day.getTime();
          const isToday = dayMs === todayMs;
          const dayKey = new Date(day).toISOString();
          const hasEvents = !!(grouped[dayKey]?.length);

          return (
            <View key={i} style={styles.dayTile}>
              <Text style={[styles.dayLetter, isToday && { color: Colors.primary }]}>
                {DAYS_SHORT[i]}
              </Text>
              <View style={[styles.dayNumCircle, isToday && styles.dayNumCircleToday]}>
                <Text style={[styles.dayNumber, isToday && styles.dayNumberToday]}>
                  {day.getDate()}
                </Text>
              </View>
              <View style={[styles.eventDot, { opacity: hasEvents ? 1 : 0 }]} />
            </View>
          );
        })}
      </Animated.View>
    </View>
  );
}

// ── Entry detail modal ────────────────────────────────────────────────────────

function EntryDetail({ entry, visible, onClose }: { entry: AgendaEntry | null; visible: boolean; onClose: () => void }) {
  if (!entry) return null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <View style={[styles.sheetStripe, { backgroundColor: getTypeColor(entry.type) }]} />

          <Text style={styles.sheetTitle}>{entry.name}</Text>
          <Badge label={entry.type} variant={entry.type === 'Examen' ? 'danger' : 'primary'} style={{ marginBottom: 16 }} />

          {[
            { icon: 'time-outline' as const, value: `${formatTime(entry.start_date)} – ${formatTime(entry.end_date)} (${formatDuration(entry.start_date, entry.end_date)})` },
            entry.teacher ? { icon: 'person-outline' as const, value: entry.teacher } : null,
            entry.rooms?.length ? { icon: 'location-outline' as const, value: entry.rooms.map(r => r.name).join(', ') } : null,
            entry.modality ? { icon: 'laptop-outline' as const, value: entry.modality } : null,
            entry.promotion ? { icon: 'people-outline' as const, value: entry.promotion } : null,
            entry.state ? { icon: 'checkmark-circle-outline' as const, value: entry.state } : null,
            entry.comment ? { icon: 'chatbubble-outline' as const, value: entry.comment } : null,
          ].filter(Boolean).map((row, i) => (
            <View key={i} style={styles.sheetRow}>
              <Ionicons name={row!.icon} size={18} color={Colors.textSecondary} />
              <Text style={styles.sheetValue}>{row!.value}</Text>
            </View>
          ))}

          <TouchableOpacity style={styles.sheetClose} onPress={onClose}>
            <Text style={styles.sheetCloseText}>Fermer</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export function AgendaScreen() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [selectedEntry, setSelectedEntry] = useState<AgendaEntry | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const { data: entries, isLoading, error, refresh } = useApi(
    t => API.getAgenda(t, weekStart.getTime(), weekEnd.getTime()),
    [weekStart.getTime()]
  );

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  function prevWeek() {
    setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; });
    scrollY.setValue(0);
  }
  function nextWeek() {
    setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });
    scrollY.setValue(0);
  }
  function goToday() {
    setWeekStart(startOfWeek(new Date()));
    scrollY.setValue(0);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  const grouped: Record<string, AgendaEntry[]> = {};
  (entries || []).forEach(entry => {
    const d = new Date(entry.start_date);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString();
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(entry);
  });

  // Mon–Sat (skip Sunday)
  const days = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  if (isLoading && !entries) return <LoadingView />;
  if (error) return <ErrorView message={error} onRetry={refresh} />;

  return (
    <View style={styles.root}>
      <CalendarHeader
        weekStart={weekStart}
        today={today}
        grouped={grouped}
        onPrev={prevWeek}
        onNext={nextWeek}
        onToday={goToday}
        animValue={scrollY}
      />

      <Animated.ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
      >
        {days.map((day, idx) => {
          const keyMs = new Date(day).setHours(0, 0, 0, 0);
          const dayKey = new Date(keyMs).toISOString();
          const dayEntries = (grouped[dayKey] || []).sort((a, b) => a.start_date - b.start_date);
          const isToday = keyMs === todayMs;

          return (
            <View key={idx} style={styles.daySection}>
              <View style={styles.dayHeader}>
                <View style={[styles.dayBadge, isToday && styles.dayBadgeToday]}>
                  <Text style={[styles.dayName, isToday && styles.dayNameToday]}>
                    {DAYS_FULL[idx]}
                  </Text>
                  <Text style={[styles.dayNum, isToday && styles.dayNumToday]}>
                    {day.getDate()} {MONTHS_FR[day.getMonth()]}
                  </Text>
                </View>
              </View>

              {dayEntries.length === 0 ? (
                <View style={styles.emptyDay}>
                  <Text style={styles.emptyDayText}>Pas de cours</Text>
                </View>
              ) : (
                dayEntries.map(entry => {
                  const color = getTypeColor(entry.type);
                  return (
                    <TouchableOpacity
                      key={entry.reservation_id}
                      onPress={() => { setSelectedEntry(entry); setShowDetail(true); }}
                      activeOpacity={0.7}
                    >
                      <Card style={[styles.entryCard, { borderLeftColor: color, borderLeftWidth: 4 }] as any}>
                        <View style={styles.entryHeader}>
                          <Text style={styles.entryTime}>
                            {formatTime(entry.start_date)} – {formatTime(entry.end_date)}
                          </Text>
                          <Text style={[styles.entryDuration, { color }]}>
                            {formatDuration(entry.start_date, entry.end_date)}
                          </Text>
                        </View>
                        <Text style={styles.entryName} numberOfLines={1}>{entry.name}</Text>
                        <View style={styles.entryMeta}>
                          {entry.rooms?.[0] && (
                            <View style={styles.metaItem}>
                              <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
                              <Text style={styles.metaText}>{entry.rooms[0].name}</Text>
                            </View>
                          )}
                          {entry.teacher && (
                            <View style={styles.metaItem}>
                              <Ionicons name="person-outline" size={13} color={Colors.textMuted} />
                              <Text style={styles.metaText} numberOfLines={1}>{entry.teacher}</Text>
                            </View>
                          )}
                        </View>
                      </Card>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          );
        })}
      </Animated.ScrollView>

      <EntryDetail entry={selectedEntry} visible={showDetail} onClose={() => setShowDetail(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  // Calendar header
  calendarContainer: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  navBtn: { padding: 8 },
  navCenter: { alignItems: 'center' },
  navMonth: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  navRange: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  dayTiles: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingBottom: 12,
    justifyContent: 'space-between',
  },
  dayTile: { flex: 1, alignItems: 'center', gap: 4 },
  dayLetter: { fontSize: 11, fontWeight: '600', color: Colors.textMuted, textTransform: 'uppercase' },
  dayNumCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayNumCircleToday: { backgroundColor: Colors.primary },
  dayNumber: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  dayNumberToday: { color: Colors.white, fontWeight: '700' },
  eventDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.primary },

  // Content
  content: { padding: Spacing.md, paddingBottom: 32 },
  daySection: { marginBottom: 20 },
  dayHeader: { marginBottom: 10 },
  dayBadge: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, alignSelf: 'flex-start' },
  dayBadgeToday: { backgroundColor: Colors.primaryLight },
  dayName: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  dayNameToday: { color: Colors.primary },
  dayNum: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  dayNumToday: { color: Colors.primary },
  emptyDay: { paddingVertical: 10, paddingLeft: 4 },
  emptyDayText: { color: Colors.textMuted, fontSize: 14, fontStyle: 'italic' },
  entryCard: { marginBottom: 8, borderRadius: 12, padding: 14, paddingLeft: 16 },
  entryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  entryTime: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  entryDuration: { fontSize: 12, fontWeight: '600' },
  entryName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginTop: 4 },
  entryMeta: { flexDirection: 'row', gap: 12, marginTop: 6, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 12, color: Colors.textMuted },

  // Detail modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingTop: 12,
  },
  sheetHandle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetStripe: { height: 4, borderRadius: 2, marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  sheetRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  sheetValue: { fontSize: 15, color: Colors.textPrimary, flex: 1 },
  sheetClose: {
    backgroundColor: Colors.surfaceVariant,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  sheetCloseText: { fontWeight: '600', color: Colors.textPrimary, fontSize: 16 },
});
