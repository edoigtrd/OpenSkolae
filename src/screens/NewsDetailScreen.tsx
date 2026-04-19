import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { Colors, Spacing } from '../theme';
import type { News } from '../api/types';

export function NewsDetailScreen({ route }: any) {
  const { news } = route.params as { news: News };

  const plainText = news.content
    ?.replace(/<br\s*\/?>/gi, '\n')
    ?.replace(/<\/p>/gi, '\n\n')
    ?.replace(/<[^>]+>/g, '')
    ?.replace(/&nbsp;/g, ' ')
    ?.replace(/&amp;/g, '&')
    ?.replace(/&lt;/g, '<')
    ?.replace(/&gt;/g, '>')
    ?.replace(/&quot;/g, '"')
    ?.trim() || '';

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {news.image_url && (
        <Image source={{ uri: news.image_url }} style={styles.image} resizeMode="cover" />
      )}
      <View style={styles.body}>
        <Text style={styles.date}>
          {new Date(news.created_date).toLocaleDateString('fr-FR', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
          })}
        </Text>
        <Text style={styles.title}>{news.title}</Text>
        <Text style={styles.author}>Par {news.author}</Text>
        <View style={styles.divider} />
        <Text style={styles.contentText}>{plainText}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 48 },
  image: { width: '100%', height: 220, backgroundColor: Colors.surfaceVariant },
  body: { padding: Spacing.md },
  date: { fontSize: 13, color: Colors.textMuted, textTransform: 'capitalize', marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, lineHeight: 30, marginBottom: 8 },
  author: { fontSize: 14, color: Colors.textSecondary },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 16 },
  contentText: { fontSize: 16, color: Colors.textPrimary, lineHeight: 26 },
});
