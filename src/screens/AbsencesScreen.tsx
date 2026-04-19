import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { API } from '../api';
import { Card } from '../components/Card';
import { LoadingView } from '../components/LoadingView';
import { ErrorView } from '../components/ErrorView';
import { EmptyView } from '../components/EmptyView';
import { Badge } from '../components/Badge';
import { Colors, Spacing } from '../theme';
import type { Absence } from '../api/types';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

function TrimesterSection({ trimester, absences }: { trimester: number; absences: Absence[] }) {
  const [open, setOpen] = useState(true);
  const justified = absences.filter(a => a.justified).length;
  const unjustified = absences.length - justified;

  function toggle() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(v => !v);
  }

  return (
    <View style={styles.trimSection}>
      <TouchableOpacity style={styles.trimHeader} onPress={toggle} activeOpacity={0.7}>
        <View style={styles.trimHeaderLeft}>
          <Text style={styles.trimTitle}>Semestre {trimester}</Text>
          <View style={styles.trimCount}>
            <Text style={styles.trimCountText}>{absences.length} absence{absences.length > 1 ? 's' : ''}</Text>
          </View>
        </View>
        <View style={styles.trimHeaderRight}>
          {unjustified > 0 && (
            <View style={styles.unjustifiedBadge}>
              <Text style={styles.unjustifiedText}>{unjustified} NJ</Text>
            </View>
          )}
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textMuted} />
        </View>
      </TouchableOpacity>

      {open && (
        <View>
          {absences.map(item => (
            <Card key={item.id} style={styles.absenceCard}>
              <View style={styles.absenceLeft}>
                <View style={[styles.absenceIcon, { backgroundColor: item.justified ? '#D1FAE5' : '#FEE2E2' }]}>
                  <Ionicons
                    name={item.justified ? 'checkmark-circle' : 'close-circle'}
                    size={22}
                    color={item.justified ? Colors.success : Colors.danger}
                  />
                </View>
                <View style={styles.absenceInfo}>
                  <Text style={styles.absenceCourse} numberOfLines={1}>{item.course_name}</Text>
                  <Text style={styles.absenceDate}>
                    {new Date(item.date).toLocaleDateString('fr-FR', {
                      weekday: 'long', day: 'numeric', month: 'long',
                    })}
                  </Text>
                </View>
              </View>
              <Badge
                label={item.justified ? 'Justifiée' : 'Non justifiée'}
                variant={item.justified ? 'success' : 'danger'}
              />
            </Card>
          ))}
        </View>
      )}
    </View>
  );
}

export function AbsencesScreen() {
  const { currentYear, availableYears, setCurrentYear } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const { data: absences, isLoading, error, refresh } = useApi(
    t => API.getAbsences(t, currentYear!),
    [currentYear]
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  // Group by trimester, sorted ascending (oldest first)
  const trimesterGroups = useMemo(() => {
    if (!absences) return [];
    const groups: Record<number, Absence[]> = {};
    absences.forEach(a => {
      if (!groups[a.trimester]) groups[a.trimester] = [];
      groups[a.trimester].push(a);
    });
    return Object.entries(groups)
      .map(([t, list]) => ({
        trimester: Number(t),
        absences: list.sort((a, b) => b.date - a.date),
      }))
      .sort((a, b) => a.trimester - b.trimester);
  }, [absences]);

  const stats = useMemo(() => {
    const total = absences?.length ?? 0;
    const justified = absences?.filter(a => a.justified).length ?? 0;
    return { total, justified, unjustified: total - justified };
  }, [absences]);

  if (isLoading && !absences) return <LoadingView />;
  if (error) return <ErrorView message={error} onRetry={refresh} />;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
    >
      {/* Year selector */}
      <View style={styles.yearRow}>
        {availableYears.map(y => (
          <TouchableOpacity
            key={y}
            style={[styles.yearChip, currentYear === y && styles.yearChipActive]}
            onPress={() => setCurrentYear(y)}
          >
            <Text style={[styles.yearChipText, currentYear === y && styles.yearChipTextActive]}>
              {y}–{y + 1}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: '#FEE2E2' }]}>
          <Text style={[styles.statValue, { color: Colors.danger }]}>{stats.unjustified}</Text>
          <Text style={[styles.statLabel, { color: '#991B1B' }]}>Non justifiée{stats.unjustified > 1 ? 's' : ''}</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#D1FAE5' }]}>
          <Text style={[styles.statValue, { color: Colors.success }]}>{stats.justified}</Text>
          <Text style={[styles.statLabel, { color: '#065F46' }]}>Justifiée{stats.justified > 1 ? 's' : ''}</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: Colors.surfaceVariant }]}>
          <Text style={[styles.statValue, { color: Colors.textPrimary }]}>{stats.total}</Text>
          <Text style={[styles.statLabel, { color: Colors.textSecondary }]}>Total</Text>
        </View>
      </View>

      {/* Trimester sections — oldest first */}
      {trimesterGroups.length === 0 ? (
        <EmptyView
          icon="checkmark-circle-outline"
          title="Aucune absence enregistrée"
          subtitle="Félicitations !"
        />
      ) : (
        <View style={styles.sections}>
          {trimesterGroups.map(({ trimester, absences: tAbsences }) => (
            <TrimesterSection key={trimester} trimester={trimester} absences={tAbsences} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 32 },
  yearRow: { flexDirection: 'row', paddingHorizontal: Spacing.md, paddingVertical: 10, gap: 8, flexWrap: 'wrap' },
  yearChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: Colors.surfaceVariant, borderWidth: 1, borderColor: Colors.border },
  yearChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  yearChipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  yearChipTextActive: { color: Colors.white },
  statsRow: { flexDirection: 'row', paddingHorizontal: Spacing.md, gap: 10, marginBottom: 16 },
  statCard: { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center' },
  statValue: { fontSize: 28, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '600', marginTop: 2, textAlign: 'center' },
  sections: { paddingHorizontal: Spacing.md },
  trimSection: { marginBottom: 8 },
  trimHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  trimHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trimTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  trimCount: { backgroundColor: Colors.surfaceVariant, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  trimCountText: { fontSize: 12, color: Colors.textMuted, fontWeight: '500' },
  trimHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  unjustifiedBadge: { backgroundColor: '#FEE2E2', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  unjustifiedText: { fontSize: 12, fontWeight: '700', color: Colors.danger },
  absenceCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  absenceLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  absenceIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  absenceInfo: { flex: 1 },
  absenceCourse: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  absenceDate: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
});
