import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { API } from '../api';
import { Card } from '../components/Card';
import { LoadingView } from '../components/LoadingView';
import { ErrorView } from '../components/ErrorView';
import { EmptyView } from '../components/EmptyView';
import { Colors, Spacing } from '../theme';
import type { AnnualDocument } from '../api/types';
import { useState } from 'react';

export function DocumentsScreen() {
  const { currentYear, availableYears, setCurrentYear } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const { data: documents, isLoading, error, refresh } = useApi(
    t => API.getAnnualDocuments(t, currentYear!),
    [currentYear]
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  if (isLoading && !documents) return <LoadingView />;
  if (error) return <ErrorView message={error} onRetry={refresh} />;

  return (
    <View style={styles.root}>
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

      <FlatList
        data={documents || []}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
        ListEmptyComponent={<EmptyView icon="document-outline" title="Aucun document" subtitle="Aucun document disponible pour cette année" />}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => Alert.alert('Téléchargement', `Le téléchargement de "${item.name}" démarrerait ici.`)}
          >
            <Card style={styles.docCard}>
              <View style={styles.docIcon}>
                <Ionicons name="document-text-outline" size={24} color={Colors.primary} />
              </View>
              <View style={styles.docInfo}>
                <Text style={styles.docName}>{item.name}</Text>
                {item.description && <Text style={styles.docDesc} numberOfLines={1}>{item.description}</Text>}
                {item.created_date && (
                  <Text style={styles.docDate}>
                    {new Date(item.created_date).toLocaleDateString('fr-FR')}
                  </Text>
                )}
              </View>
              <Ionicons name="download-outline" size={20} color={Colors.primary} />
            </Card>
          </TouchableOpacity>
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
  list: { padding: Spacing.md, paddingBottom: 32 },
  docCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  docIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  docInfo: { flex: 1 },
  docName: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  docDesc: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  docDate: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
});
