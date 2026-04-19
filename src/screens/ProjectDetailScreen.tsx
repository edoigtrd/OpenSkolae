import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  FlatList, Alert, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { API } from '../api';
import { Card } from '../components/Card';
import { LoadingView } from '../components/LoadingView';
import { Colors, Spacing } from '../theme';
import type { Project, Course, ProjectGroup } from '../api/types';

export function ProjectDetailScreen({ route }: any) {
  const { project, course } = route.params as { project: Project; course: Course };
  const { token, user } = useAuth();
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [userGroupId, setUserGroupId] = useState<number | null>(null);

  const { data: projectDetail, isLoading, refresh } = useApi(
    t => API.getProject(t, project.id),
    [project.id]
  );

  const { data: messages, refresh: refreshMessages } = useApi(
    t => userGroupId ? API.getGroupMessages(t, userGroupId) : Promise.resolve([]),
    [userGroupId]
  );

  const detail = projectDetail || project;
  const groups: ProjectGroup[] = (detail as any).groups || [];

  async function handleJoinGroup(groupId: number) {
    if (!token) return;
    try {
      await API.joinProjectGroup(token, course.rc_id, project.id, groupId);
      setUserGroupId(groupId);
      await refresh();
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Impossible de rejoindre ce groupe.');
    }
  }

  async function handleQuitGroup(groupId: number) {
    Alert.alert('Quitter le groupe', 'Êtes-vous sûr de vouloir quitter ce groupe ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Quitter', style: 'destructive',
        onPress: async () => {
          if (!token) return;
          try {
            await API.quitProjectGroup(token, course.rc_id, project.id, groupId);
            setUserGroupId(null);
            await refresh();
          } catch (e: any) {
            Alert.alert('Erreur', e.message || 'Impossible de quitter ce groupe.');
          }
        },
      },
    ]);
  }

  async function sendMessage() {
    if (!token || !userGroupId || !messageText.trim()) return;
    setSendingMessage(true);
    try {
      await API.sendGroupMessage(token, userGroupId, messageText.trim());
      setMessageText('');
      await refreshMessages();
    } catch (e: any) {
      Alert.alert('Erreur', 'Impossible d\'envoyer le message.');
    } finally {
      setSendingMessage(false);
    }
  }

  if (isLoading) return <LoadingView />;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {/* Project info */}
        <Card style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <View style={styles.projectIcon}>
              <Ionicons name="folder-open-outline" size={26} color={Colors.accent} />
            </View>
            <View style={styles.infoText}>
              <Text style={styles.projectName}>{detail.name}</Text>
              <Text style={styles.projectCourse}>{course.name}</Text>
            </View>
          </View>
          {detail.description && (
            <Text style={styles.projectDesc}>{detail.description}</Text>
          )}
          {(detail as any).deadline && (
            <View style={styles.deadlineRow}>
              <Ionicons name="calendar-outline" size={16} color={Colors.danger} />
              <Text style={styles.deadline}>
                Échéance : {new Date((detail as any).deadline).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>
            </View>
          )}
        </Card>

        {/* Groups */}
        {groups.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Groupes</Text>
            {groups.map(group => {
              const isMyGroup = userGroupId === group.id || (group.members || []).some((m: any) => m.uid === user?.uid);
              return (
                <Card key={group.id} style={styles.groupCard}>
                  <View style={styles.groupHeader}>
                    <Text style={styles.groupName}>{group.name}</Text>
                    {isMyGroup ? (
                      <TouchableOpacity
                        style={styles.quitBtn}
                        onPress={() => handleQuitGroup(group.id)}
                      >
                        <Text style={styles.quitBtnText}>Quitter</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.joinBtn}
                        onPress={() => handleJoinGroup(group.id)}
                      >
                        <Text style={styles.joinBtnText}>Rejoindre</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {group.members && group.members.length > 0 && (
                    <View style={styles.members}>
                      {group.members.map((m: any) => (
                        <View key={m.uid} style={styles.memberChip}>
                          <View style={styles.memberAvatar}>
                            <Text style={styles.memberAvatarText}>
                              {(m.firstname?.[0] || '') + (m.name?.[0] || '')}
                            </Text>
                          </View>
                          <Text style={styles.memberName}>{m.firstname} {m.name}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </Card>
              );
            })}
          </View>
        )}

        {/* Group messages */}
        {userGroupId && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Messagerie du groupe</Text>
            {(messages || []).length === 0 ? (
              <Card style={styles.emptyMessages}>
                <Ionicons name="chatbubble-outline" size={28} color={Colors.textMuted} />
                <Text style={styles.emptyMessagesText}>Aucun message</Text>
              </Card>
            ) : (
              (messages || []).map((msg: any) => {
                const isMe = msg.author_uid === user?.uid;
                return (
                  <View key={msg.id} style={[styles.messageBubble, isMe && styles.messageBubbleMe]}>
                    {!isMe && <Text style={styles.messageAuthor}>{msg.author}</Text>}
                    <View style={[styles.messageBg, isMe && styles.messageBgMe]}>
                      <Text style={[styles.messageText, isMe && styles.messageTextMe]}>{msg.message}</Text>
                    </View>
                    <Text style={styles.messageTime}>
                      {new Date(msg.created_date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                );
              })
            )}

            {/* Message input */}
            <View style={styles.inputRow}>
              <TextInput
                style={styles.messageInput}
                value={messageText}
                onChangeText={setMessageText}
                placeholder="Écrire un message..."
                placeholderTextColor={Colors.textMuted}
                multiline
              />
              <TouchableOpacity
                style={[styles.sendBtn, !messageText.trim() && styles.sendBtnDisabled]}
                onPress={sendMessage}
                disabled={!messageText.trim() || sendingMessage}
              >
                {sendingMessage ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Ionicons name="send" size={18} color={Colors.white} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: 48 },
  infoCard: { marginBottom: 20 },
  infoHeader: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  projectIcon: { width: 50, height: 50, borderRadius: 14, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center' },
  infoText: { flex: 1 },
  projectName: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  projectCourse: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  projectDesc: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 12 },
  deadlineRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  deadline: { fontSize: 14, color: Colors.danger, fontWeight: '600' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  groupCard: { marginBottom: 10 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  groupName: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  joinBtn: { backgroundColor: Colors.primary, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  joinBtnText: { color: Colors.white, fontWeight: '600', fontSize: 13 },
  quitBtn: { backgroundColor: Colors.danger + '20', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  quitBtnText: { color: Colors.danger, fontWeight: '600', fontSize: 13 },
  members: { gap: 8 },
  memberChip: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  memberAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  memberAvatarText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  memberName: { fontSize: 14, color: Colors.textPrimary },
  emptyMessages: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  emptyMessagesText: { color: Colors.textMuted, fontSize: 15 },
  messageBubble: { marginBottom: 12, alignItems: 'flex-start' },
  messageBubbleMe: { alignItems: 'flex-end' },
  messageAuthor: { fontSize: 12, fontWeight: '600', color: Colors.textMuted, marginBottom: 4 },
  messageBg: { backgroundColor: Colors.surfaceVariant, borderRadius: 16, borderBottomLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 10, maxWidth: '80%' },
  messageBgMe: { backgroundColor: Colors.primary, borderBottomLeftRadius: 16, borderBottomRightRadius: 4 },
  messageText: { fontSize: 15, color: Colors.textPrimary },
  messageTextMe: { color: Colors.white },
  messageTime: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 12 },
  messageInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.textPrimary,
    maxHeight: 100,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: Colors.textMuted },
});
