import React, { useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { API } from '../api';
import { Card } from '../components/Card';
import { LoadingView } from '../components/LoadingView';
import { Colors, Spacing } from '../theme';
import type { AgendaEntry, News } from '../api/types';

function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function AgendaCard({ entry, onPress }: { entry: AgendaEntry; onPress: () => void }) {
  const typeColor = entry.type === 'Cours' ? Colors.primary : entry.type === 'Examen' ? Colors.danger : Colors.accent;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card style={styles.agendaCard}>
        <View style={[styles.agendaStripe, { backgroundColor: typeColor }]} />
        <View style={styles.agendaContent}>
          <Text style={styles.agendaTime}>
            {formatTime(entry.start_date)} – {formatTime(entry.end_date)}
          </Text>
          <Text style={styles.agendaName} numberOfLines={1}>{entry.name}</Text>
          <Text style={styles.agendaMeta} numberOfLines={1}>
            {entry.teacher} {entry.rooms?.[0] ? `· ${entry.rooms[0].name}` : ''}
          </Text>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

export function HomeScreen({ navigation }: any) {
  const { profile, currentYear, token } = useAuth();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const { data: agenda, isLoading: agendaLoading, refresh: refreshAgenda } = useApi(
    t => API.getAgenda(t, todayStart.getTime(), todayEnd.getTime()),
    []
  );

  const { data: newsPage, isLoading: newsLoading, refresh: refreshNews } = useApi(
    t => API.getNews(t, 0),
    []
  );

  const { data: nextSteps } = useApi(t => API.getNextProjectSteps(t), []);

  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshAgenda(), refreshNews()]);
    setRefreshing(false);
  }, [refreshAgenda, refreshNews]);

  const todayEntries = (agenda || []).sort((a, b) => a.start_date - b.start_date);
  const latestNews = newsPage?.content?.slice(0, 3) || [];
  const now = Date.now();
  const nextClass = todayEntries.find(e => e.end_date > now);

  if (agendaLoading && !agenda) return <LoadingView />;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Bonjour,</Text>
          <Text style={styles.name}>{profile?.firstname} {profile?.name}</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(profile?.firstname?.[0] || '') + (profile?.name?.[0] || '')}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Next class banner */}
      {nextClass && (
        <TouchableOpacity
          style={styles.nextClassBanner}
          onPress={() => navigation.navigate('Agenda')}
          activeOpacity={0.9}
        >
          <View style={styles.nextClassLeft}>
            <Text style={styles.nextClassLabel}>Prochain cours</Text>
            <Text style={styles.nextClassName}>{nextClass.name}</Text>
            <Text style={styles.nextClassTime}>
              {formatTime(nextClass.start_date)} · {nextClass.rooms?.[0]?.name || nextClass.modality}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      )}

      {/* Today's agenda */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Aujourd'hui · {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Agenda')}>
            <Text style={styles.seeAll}>Voir tout</Text>
          </TouchableOpacity>
        </View>
        {todayEntries.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="sunny-outline" size={28} color={Colors.textMuted} />
            <Text style={styles.emptyText}>Aucun cours aujourd'hui</Text>
          </Card>
        ) : (
          todayEntries.slice(0, 4).map(entry => (
            <AgendaCard
              key={entry.reservation_id}
              entry={entry}
              onPress={() => navigation.navigate('Agenda')}
            />
          ))
        )}
      </View>

      {/* Project steps — always shown */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Échéances projets</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Courses')}>
            <Text style={styles.seeAll}>Voir tout</Text>
          </TouchableOpacity>
        </View>
        {!nextSteps || nextSteps.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="flag-outline" size={24} color={Colors.textMuted} />
            <Text style={styles.emptyText}>Pas d'échéance de projet en cours</Text>
          </Card>
        ) : (
          nextSteps.slice(0, 2).map((step, i) => (
            <Card key={i} style={styles.stepCard}>
              <View style={styles.stepIcon}>
                <Ionicons name="flag-outline" size={18} color={Colors.accent} />
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepName} numberOfLines={1}>{step.name}</Text>
                {step.project_name && (
                  <Text style={styles.stepProject}>{step.project_name}</Text>
                )}
                {step.deadline && (
                  <Text style={styles.stepDeadline}>
                    Échéance : {formatDate(step.deadline)}
                  </Text>
                )}
              </View>
            </Card>
          ))
        )}
      </View>

      {/* Latest news */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Actualités</Text>
          <TouchableOpacity onPress={() => navigation.navigate('News')}>
            <Text style={styles.seeAll}>Voir tout</Text>
          </TouchableOpacity>
        </View>
        {latestNews.map(news => (
          <TouchableOpacity
            key={news.id}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('NewsDetail', { news })}
          >
            <Card style={styles.newsCard}>
              <Text style={styles.newsTitle} numberOfLines={2}>{news.title}</Text>
              <Text style={styles.newsMeta}>
                {news.author} · {new Date(news.created_date).toLocaleDateString('fr-FR')}
              </Text>
            </Card>
          </TouchableOpacity>
        ))}
        {latestNews.length === 0 && !newsLoading && (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>Aucune actualité</Text>
          </Card>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 32 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: 20,
    paddingBottom: 16,
  },
  greeting: { fontSize: 16, color: Colors.textSecondary },
  name: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: Colors.white, fontWeight: '700', fontSize: 16 },
  nextClassBanner: {
    marginHorizontal: Spacing.md,
    marginBottom: 20,
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nextClassLeft: { flex: 1 },
  nextClassLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  nextClassName: { color: Colors.white, fontSize: 19, fontWeight: '700', marginTop: 4 },
  nextClassTime: { color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 4 },
  section: { paddingHorizontal: Spacing.md, marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  seeAll: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  agendaCard: { flexDirection: 'row', padding: 0, overflow: 'hidden', marginBottom: 10 },
  agendaStripe: { width: 4, borderRadius: 4 },
  agendaContent: { flex: 1, padding: 14 },
  agendaTime: { fontSize: 12, fontWeight: '600', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  agendaName: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary, marginTop: 4 },
  agendaMeta: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  emptyCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emptyText: { color: Colors.textMuted, fontSize: 15 },
  stepCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  stepIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center' },
  stepContent: { flex: 1 },
  stepName: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  stepProject: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  stepDeadline: { fontSize: 12, color: Colors.danger, marginTop: 2 },
  newsCard: { marginBottom: 10 },
  newsTitle: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary, marginBottom: 6 },
  newsMeta: { fontSize: 12, color: Colors.textMuted },
});
