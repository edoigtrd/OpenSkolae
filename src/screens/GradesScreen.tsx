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
import { Colors, Spacing } from '../theme';
import type { Grade } from '../api/types';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

function gradeColor(value: number | null | undefined) {
  if (value === null || value === undefined) return Colors.textMuted;
  if (value >= 16) return '#059669';
  if (value >= 12) return Colors.primary;
  if (value >= 10) return Colors.accent;
  return Colors.danger;
}

function trimesterAverage(grades: Grade[]) {
  const withScores = grades.filter(g => g.exam !== null && g.exam !== undefined);
  if (!withScores.length) return null;
  const total = withScores.reduce((s, g) => s + g.exam! * (parseFloat(g.coef) || 1), 0);
  const coef = withScores.reduce((s, g) => s + (parseFloat(g.coef) || 1), 0);
  return total / coef;
}

function GradeRow({ grade }: { grade: Grade }) {
  const [expanded, setExpanded] = useState(false);
  const color = gradeColor(grade.exam);

  return (
    <TouchableOpacity onPress={() => setExpanded(v => !v)} activeOpacity={0.7}>
      <Card style={styles.gradeCard}>
        <View style={styles.gradeHeader}>
          <View style={styles.gradeInfo}>
            <Text style={styles.subject} numberOfLines={1}>{grade.subject}</Text>
            <Text style={styles.course} numberOfLines={1}>{grade.course}</Text>
            <Text style={styles.teacher}>
              {grade.teacher_civility} {grade.teacher_first_name} {grade.teacher_last_name}
            </Text>
          </View>
          <View style={styles.gradeRight}>
            <Text style={[styles.examScore, { color }]}>
              {grade.exam !== null && grade.exam !== undefined ? grade.exam.toFixed(1) : '–'}
            </Text>
            <Text style={styles.gradeSubScore}>/20</Text>
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={Colors.textMuted}
              style={{ marginTop: 4 }}
            />
          </View>
        </View>

        {expanded && (
          <View style={styles.gradeDetails}>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Moy. classe</Text>
                <Text style={[styles.detailValue, { color: gradeColor(grade.average) }]}>
                  {grade.average !== null ? grade.average?.toFixed(1) : '–'}
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>ECTS</Text>
                <Text style={styles.detailValue}>{grade.ects || '–'}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Coef.</Text>
                <Text style={styles.detailValue}>{grade.coef || '–'}</Text>
              </View>
            </View>
            {grade.grades && grade.grades.length > 1 && (
              <View style={styles.gradesHistory}>
                <Text style={styles.historyLabel}>Notes :</Text>
                <View style={styles.gradesPills}>
                  {grade.grades.map((g, i) => (
                    <View key={i} style={[styles.gradePill, { borderColor: gradeColor(g) }]}>
                      <Text style={[styles.gradePillText, { color: gradeColor(g) }]}>{g.toFixed(1)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}
      </Card>
    </TouchableOpacity>
  );
}

function TrimesterSection({ trimester, grades }: { trimester: number; grades: Grade[] }) {
  const [open, setOpen] = useState(true);
  const avg = trimesterAverage(grades);

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
            <Text style={styles.trimCountText}>{grades.length} matière{grades.length > 1 ? 's' : ''}</Text>
          </View>
        </View>
        <View style={styles.trimHeaderRight}>
          {avg !== null && (
            <Text style={[styles.trimAvg, { color: gradeColor(avg) }]}>{avg.toFixed(2)}</Text>
          )}
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textMuted} />
        </View>
      </TouchableOpacity>
      {open && (
        <View>
          {grades.map(grade => <GradeRow key={grade.id} grade={grade} />)}
        </View>
      )}
    </View>
  );
}

export function GradesScreen() {
  const { currentYear, availableYears, setCurrentYear } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const { data: grades, isLoading, error, refresh } = useApi(
    t => API.getGrades(t, currentYear!),
    [currentYear]
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  // Group by trimester, sorted ascending (oldest first)
  const trimesterGroups = useMemo(() => {
    if (!grades) return [];
    const groups: Record<number, Grade[]> = {};
    grades.forEach(g => {
      if (!groups[g.trimester]) groups[g.trimester] = [];
      groups[g.trimester].push(g);
    });
    return Object.entries(groups)
      .map(([t, list]) => ({ trimester: Number(t), grades: list }))
      .sort((a, b) => a.trimester - b.trimester);
  }, [grades]);

  const overallAverage = useMemo(() => {
    if (!grades?.length) return null;
    return trimesterAverage(grades);
  }, [grades]);

  if (isLoading && !grades) return <LoadingView />;
  if (error) return <ErrorView message={error} onRetry={refresh} />;
  if (!grades?.length) return <EmptyView icon="school-outline" title="Aucune note disponible" subtitle={`Année ${currentYear}`} />;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
    >
      {/* Year selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.yearList}>
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
      </ScrollView>

      {/* Overall average */}
      {overallAverage !== null && (
        <View style={styles.averageBanner}>
          <Text style={styles.averageLabel}>Moyenne générale</Text>
          <Text style={[styles.averageValue, { color: gradeColor(overallAverage) }]}>
            {overallAverage.toFixed(2)}<Text style={styles.averageUnit}>/20</Text>
          </Text>
        </View>
      )}

      {/* Trimester sections — oldest (S1) first */}
      <View style={styles.sections}>
        {trimesterGroups.map(({ trimester, grades: tGrades }) => (
          <TrimesterSection key={trimester} trimester={trimester} grades={tGrades} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 32 },
  yearList: { paddingHorizontal: Spacing.md, paddingVertical: 10, gap: 8 },
  yearChip: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 999, backgroundColor: Colors.surfaceVariant, borderWidth: 1, borderColor: Colors.border },
  yearChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  yearChipText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  yearChipTextActive: { color: Colors.white },
  averageBanner: {
    marginHorizontal: Spacing.md,
    marginBottom: 16,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  averageLabel: { fontSize: 13, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '600' },
  averageValue: { fontSize: 42, fontWeight: '800', marginTop: 4 },
  averageUnit: { fontSize: 20, fontWeight: '500', color: Colors.textMuted },
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
  trimAvg: { fontSize: 18, fontWeight: '800' },
  gradeCard: { marginBottom: 8, padding: 16 },
  gradeHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  gradeInfo: { flex: 1, marginRight: 16 },
  subject: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  course: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  teacher: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  gradeRight: { alignItems: 'flex-end' },
  examScore: { fontSize: 28, fontWeight: '800' },
  gradeSubScore: { fontSize: 14, color: Colors.textMuted, marginTop: -4 },
  gradeDetails: { marginTop: 12 },
  detailDivider: { height: 1, backgroundColor: Colors.border, marginBottom: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-around' },
  detailItem: { alignItems: 'center' },
  detailLabel: { fontSize: 11, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600' },
  detailValue: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginTop: 2 },
  gradesHistory: { marginTop: 12 },
  historyLabel: { fontSize: 12, color: Colors.textMuted, marginBottom: 6 },
  gradesPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  gradePill: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  gradePillText: { fontSize: 13, fontWeight: '600' },
});
