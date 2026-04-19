import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, TextInput, LayoutAnimation, Platform, UIManager,
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
import type { Course } from '../api/types';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

function CollapsibleSection({
  title,
  count,
  children,
  defaultOpen = true,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  function toggle() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(v => !v);
  }

  return (
    <View style={colStyles.wrapper}>
      <TouchableOpacity style={colStyles.header} onPress={toggle} activeOpacity={0.7}>
        <View style={colStyles.headerLeft}>
          <Text style={colStyles.title}>{title}</Text>
          <View style={colStyles.countBadge}>
            <Text style={colStyles.countText}>{count}</Text>
          </View>
        </View>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={Colors.textMuted}
        />
      </TouchableOpacity>
      {open && <View style={colStyles.content}>{children}</View>}
    </View>
  );
}

const colStyles = StyleSheet.create({
  wrapper: { marginBottom: 8 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 },
  countBadge: { backgroundColor: Colors.surfaceVariant, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  countText: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  content: {},
});

export function CoursesScreen({ navigation }: any) {
  const { currentYear, availableYears, setCurrentYear } = useAuth();
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const { data: courses, isLoading, error, refresh } = useApi(
    t => API.getCourses(t, currentYear!),
    [currentYear]
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    if (!courses) return [];
    const q = search.toLowerCase();
    return courses
      .filter(c => !q || c.name.toLowerCase().includes(q) || c.teacher?.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [courses, search]);

  // Group by trimester, sorted ascending (oldest first)
  const groupedEntries = useMemo(() => {
    const groups: Record<number, Course[]> = {};
    filtered.forEach(c => {
      if (!groups[c.trimester]) groups[c.trimester] = [];
      groups[c.trimester].push(c);
    });
    return Object.entries(groups)
      .map(([t, list]) => ({ trimester: Number(t), courses: list }))
      .sort((a, b) => a.trimester - b.trimester);
  }, [filtered]);

  if (isLoading && !courses) return <LoadingView />;
  if (error) return <ErrorView message={error} onRetry={refresh} />;

  return (
    <View style={styles.root}>
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

      {/* Search */}
      <View style={styles.searchWrapper}>
        <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher une matière..."
          placeholderTextColor={Colors.textMuted}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={groupedEntries}
        keyExtractor={item => String(item.trimester)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
        ListEmptyComponent={<EmptyView icon="book-outline" title="Aucune matière trouvée" />}
        renderItem={({ item: { trimester, courses: trimCourses } }) => (
          <CollapsibleSection
            title={`Semestre ${trimester}`}
            count={trimCourses.length}
            defaultOpen={true}
          >
            {trimCourses.map(course => (
              <TouchableOpacity
                key={course.id}
                onPress={() => navigation.navigate('CourseDetail', { course })}
                activeOpacity={0.7}
              >
                <Card style={styles.courseCard}>
                  <View style={styles.courseIcon}>
                    <Ionicons name="book-outline" size={22} color={Colors.primary} />
                  </View>
                  <View style={styles.courseInfo}>
                    <Text style={styles.courseName}>{course.name}</Text>
                    <Text style={styles.courseTeacher} numberOfLines={1}>
                      {course.teacher || 'Enseignant non renseigné'}
                    </Text>
                    <Text style={styles.courseMeta}>
                      {course.student_group_name} · {course.nb_students} étudiant{course.nb_students > 1 ? 's' : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                </Card>
              </TouchableOpacity>
            ))}
          </CollapsibleSection>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  yearRow: { flexDirection: 'row', paddingHorizontal: Spacing.md, paddingVertical: 10, gap: 8, flexWrap: 'wrap' },
  yearChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: Colors.surfaceVariant, borderWidth: 1, borderColor: Colors.border },
  yearChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  yearChipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  yearChipTextActive: { color: Colors.white },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    marginHorizontal: Spacing.md,
    marginBottom: 8,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, color: Colors.textPrimary },
  list: { paddingHorizontal: Spacing.md, paddingBottom: 32 },
  courseCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  courseIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center',
  },
  courseInfo: { flex: 1 },
  courseName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  courseTeacher: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  courseMeta: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
});
