import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Linking, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApi } from '../hooks/useApi';
import { API } from '../api';
import { Card } from '../components/Card';
import { LoadingView } from '../components/LoadingView';
import { ErrorView } from '../components/ErrorView';
import { EmptyView } from '../components/EmptyView';
import { Colors, Spacing } from '../theme';
import type { Partner } from '../api/types';

export function PartnersScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const { data: partners, isLoading, error, refresh } = useApi(t => API.getPartners(t), []);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  if (isLoading && !partners) return <LoadingView />;
  if (error) return <ErrorView message={error} onRetry={refresh} />;
  if (!partners?.length) return <EmptyView icon="business-outline" title="Aucun partenaire" />;

  return (
    <FlatList
      style={styles.root}
      data={partners}
      keyExtractor={item => String(item.id)}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
      renderItem={({ item }) => (
        <TouchableOpacity
          activeOpacity={item.website ? 0.7 : 1}
          onPress={() => item.website && Linking.openURL(item.website)}
        >
          <Card style={styles.partnerCard}>
            {item.logo_url ? (
              <Image source={{ uri: item.logo_url }} style={styles.logo} resizeMode="contain" />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Ionicons name="business-outline" size={28} color={Colors.textMuted} />
              </View>
            )}
            <View style={styles.partnerInfo}>
              <Text style={styles.partnerName}>{item.name}</Text>
              {item.description && (
                <Text style={styles.partnerDesc} numberOfLines={2}>{item.description}</Text>
              )}
            </View>
            {item.website && <Ionicons name="open-outline" size={18} color={Colors.primary} />}
          </Card>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: 32 },
  partnerCard: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10 },
  logo: { width: 56, height: 56, borderRadius: 10 },
  logoPlaceholder: { width: 56, height: 56, borderRadius: 10, backgroundColor: Colors.surfaceVariant, justifyContent: 'center', alignItems: 'center' },
  partnerInfo: { flex: 1 },
  partnerName: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  partnerDesc: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
});
