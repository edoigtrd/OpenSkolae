import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApi } from '../hooks/useApi';
import { API } from '../api';
import { Card } from '../components/Card';
import { LoadingView } from '../components/LoadingView';
import { ErrorView } from '../components/ErrorView';
import { EmptyView } from '../components/EmptyView';
import { Badge } from '../components/Badge';
import { Colors, Spacing } from '../theme';
import type { SpeedMeeting } from '../api/types';

function formatDateTime(ms: number) {
  return new Date(ms).toLocaleString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit',
  });
}

export function SpeedMeetingsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const { data: meetings, isLoading, error, refresh } = useApi(t => API.getSpeedMeetings(t), []);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  if (isLoading && !meetings) return <LoadingView />;
  if (error) return <ErrorView message={error} onRetry={refresh} />;
  if (!meetings?.length) return (
    <EmptyView
      icon="calendar-outline"
      title="Aucun speed meeting"
      subtitle="Aucun rendez-vous programmé"
    />
  );

  const now = Date.now();
  const upcoming = meetings.filter(m => m.end_date > now);
  const past = meetings.filter(m => m.end_date <= now);

  return (
    <FlatList
      style={styles.root}
      data={[
        ...(upcoming.length ? [{ type: 'header', title: 'À venir' }] : []),
        ...upcoming.map(m => ({ type: 'item', data: m })),
        ...(past.length ? [{ type: 'header', title: 'Passés' }] : []),
        ...past.map(m => ({ type: 'item', data: m })),
      ] as any[]}
      keyExtractor={(item, i) => item.type === 'header' ? `h-${i}` : String(item.data.id)}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
      renderItem={({ item }) => {
        if (item.type === 'header') {
          return <Text style={styles.sectionHeader}>{item.title}</Text>;
        }
        const meeting: SpeedMeeting = item.data;
        const isPast = meeting.end_date <= now;
        return (
          <Card style={[styles.meetingCard, isPast && styles.meetingCardPast] as any}>
            <View style={styles.meetingHeader}>
              <View style={styles.meetingIcon}>
                <Ionicons name="people-outline" size={22} color={isPast ? Colors.textMuted : Colors.primary} />
              </View>
              <View style={styles.meetingInfo}>
                {meeting.teacher && <Text style={styles.meetingTeacher}>{meeting.teacher}</Text>}
                <Text style={styles.meetingTime}>{formatDateTime(meeting.start_date)}</Text>
                {meeting.location && (
                  <Text style={styles.meetingLocation}>📍 {meeting.location}</Text>
                )}
              </View>
              {meeting.status && (
                <Badge
                  label={meeting.status}
                  variant={isPast ? 'neutral' : 'primary'}
                />
              )}
            </View>
          </Card>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: 32 },
  sectionHeader: { fontSize: 13, fontWeight: '600', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, marginTop: 8 },
  meetingCard: { marginBottom: 10 },
  meetingCardPast: { opacity: 0.6 },
  meetingHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  meetingIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  meetingInfo: { flex: 1 },
  meetingTeacher: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  meetingTime: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
  meetingLocation: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
});
