import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
  Switch, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { API } from '../api';
import { Card } from '../components/Card';
import { LoadingView } from '../components/LoadingView';
import { ErrorView } from '../components/ErrorView';
import { Colors, Spacing } from '../theme';

const DELAY_OPTIONS = [
  { label: '5 min avant', value: 5 * 60 },
  { label: '10 min avant', value: 10 * 60 },
  { label: '15 min avant', value: 15 * 60 },
  { label: '30 min avant', value: 30 * 60 },
  { label: '1h avant', value: 60 * 60 },
];

export function NotificationsScreen() {
  const { token } = useAuth();
  const { data: delays, isLoading, error, refresh } = useApi(t => API.getNotificationDelays(t), []);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  async function setDelay(typeId: number, seconds: number) {
    if (!token) return;
    setUpdatingId(typeId);
    try {
      await API.upsertNotificationDelay(token, typeId, seconds);
      await refresh();
    } catch (e: any) {
      Alert.alert('Erreur', 'Impossible de mettre à jour la notification.');
    } finally {
      setUpdatingId(null);
    }
  }

  async function removeDelay(typeId: number) {
    if (!token) return;
    setUpdatingId(typeId);
    try {
      await API.deleteNotificationDelay(token, typeId);
      await refresh();
    } catch (e: any) {
      Alert.alert('Erreur', 'Impossible de supprimer la notification.');
    } finally {
      setUpdatingId(null);
    }
  }

  if (isLoading) return <LoadingView />;
  if (error) return <ErrorView message={error} onRetry={refresh} />;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        Configurez les rappels de notification pour chaque type d'événement.
      </Text>

      {(delays || []).length === 0 ? (
        <Card style={styles.emptyCard}>
          <Ionicons name="notifications-off-outline" size={32} color={Colors.textMuted} />
          <Text style={styles.emptyText}>Aucun rappel configuré</Text>
        </Card>
      ) : (
        (delays || []).map(delay => (
          <Card key={delay.notification_type_id} style={styles.delayCard}>
            <View style={styles.delayHeader}>
              <View style={styles.delayIcon}>
                <Ionicons name="notifications-outline" size={20} color={Colors.primary} />
              </View>
              <View style={styles.delayInfo}>
                <Text style={styles.delayType}>{delay.notification_type_name}</Text>
                <Text style={styles.delayValue}>
                  {DELAY_OPTIONS.find(d => d.value === delay.delay_in_seconds)?.label ||
                    `${delay.delay_in_seconds / 60} min avant`}
                </Text>
              </View>
              {updatingId === delay.notification_type_id ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <TouchableOpacity
                  onPress={() => removeDelay(delay.notification_type_id)}
                  style={styles.removeBtn}
                >
                  <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.optionsRow}>
              {DELAY_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.optionChip,
                    delay.delay_in_seconds === opt.value && styles.optionChipActive,
                  ]}
                  onPress={() => setDelay(delay.notification_type_id, opt.value)}
                >
                  <Text style={[
                    styles.optionText,
                    delay.delay_in_seconds === opt.value && styles.optionTextActive,
                  ]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>
        ))
      )}

      <Text style={styles.note}>
        Les rappels s'appliquent aux événements de votre agenda.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: 48 },
  intro: { fontSize: 14, color: Colors.textSecondary, marginBottom: 20, lineHeight: 20 },
  emptyCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 15, color: Colors.textMuted },
  delayCard: { marginBottom: 14 },
  delayHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  delayIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  delayInfo: { flex: 1 },
  delayType: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  delayValue: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  removeBtn: { padding: 8 },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.surfaceVariant,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  optionChipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  optionText: { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
  optionTextActive: { color: Colors.primary, fontWeight: '600' },
  note: { fontSize: 13, color: Colors.textMuted, marginTop: 16, textAlign: 'center', fontStyle: 'italic' },
});
