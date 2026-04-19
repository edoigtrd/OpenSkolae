import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Image, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { API } from '../api';
import { Card } from '../components/Card';
import { LoadingView } from '../components/LoadingView';
import { ErrorView } from '../components/ErrorView';
import { EmptyView } from '../components/EmptyView';
import { Colors, Spacing } from '../theme';
import type { News, NewsPage } from '../api/types';

export function NewsScreen({ navigation }: any) {
  const { token } = useAuth();
  const [page, setPage] = useState(0);
  const [data, setData] = useState<News[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPage = useCallback(async (pageNum: number, reset = false) => {
    if (!token) return;
    try {
      const result = await API.getNews(token, pageNum);
      setTotalPages(result.totalPages);
      if (reset) {
        setData(result.content);
      } else {
        setData(prev => [...prev, ...result.content]);
      }
      setPage(pageNum);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Erreur lors du chargement');
    }
  }, [token]);

  React.useEffect(() => {
    setIsLoading(true);
    fetchPage(0, true).finally(() => setIsLoading(false));
  }, [fetchPage]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPage(0, true);
    setRefreshing(false);
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || page >= totalPages - 1) return;
    setIsLoadingMore(true);
    await fetchPage(page + 1);
    setIsLoadingMore(false);
  }, [fetchPage, isLoadingMore, page, totalPages]);

  if (isLoading) return <LoadingView />;
  if (error && !data.length) return <ErrorView message={error} onRetry={() => fetchPage(0, true)} />;
  if (!data.length) return <EmptyView icon="newspaper-outline" title="Aucune actualité" />;

  return (
    <FlatList
      style={styles.root}
      data={data}
      keyExtractor={item => String(item.id)}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
      onEndReached={loadMore}
      onEndReachedThreshold={0.3}
      ListFooterComponent={isLoadingMore ? (
        <ActivityIndicator color={Colors.primary} style={{ marginVertical: 16 }} />
      ) : null}
      renderItem={({ item }) => (
        <TouchableOpacity
          onPress={() => navigation.navigate('NewsDetail', { news: item })}
          activeOpacity={0.7}
        >
          <Card style={styles.newsCard}>
            {item.image_url && (
              <Image source={{ uri: item.image_url }} style={styles.newsImage} resizeMode="cover" />
            )}
            <View style={styles.newsBody}>
              <Text style={styles.newsDate}>
                {new Date(item.created_date).toLocaleDateString('fr-FR', {
                  day: 'numeric', month: 'long', year: 'numeric'
                })}
              </Text>
              <Text style={styles.newsTitle} numberOfLines={2}>{item.title}</Text>
              <View style={styles.newsFooter}>
                <Ionicons name="person-outline" size={13} color={Colors.textMuted} />
                <Text style={styles.newsAuthor}>{item.author}</Text>
              </View>
            </View>
          </Card>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: 32 },
  newsCard: { padding: 0, overflow: 'hidden', marginBottom: 14 },
  newsImage: { width: '100%', height: 160, backgroundColor: Colors.surfaceVariant },
  newsBody: { padding: 14 },
  newsDate: { fontSize: 12, color: Colors.textMuted, marginBottom: 4 },
  newsTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, lineHeight: 22 },
  newsFooter: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  newsAuthor: { fontSize: 12, color: Colors.textMuted },
});
