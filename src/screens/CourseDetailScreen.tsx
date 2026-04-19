import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { API } from '../api';
import { Card } from '../components/Card';
import { LoadingView } from '../components/LoadingView';
import { ErrorView } from '../components/ErrorView';
import { EmptyView } from '../components/EmptyView';
import { Colors, Spacing } from '../theme';
import type { Course, CourseFile } from '../api/types';

type Tab = 'files' | 'projects' | 'practicals' | 'syllabus';

// Derive a human-readable name from whatever field the API provides
function getFileName(file: any): string {
  return file.name || file.file_name || file.title || file.filename || `Fichier ${file.id ?? ''}`;
}

function getFileExtension(file: any): string {
  const name = getFileName(file);
  const dot = name.lastIndexOf('.');
  return dot > -1 ? name.slice(dot + 1).toLowerCase() : '';
}

function fileIconName(ext: string): keyof typeof Ionicons.glyphMap {
  if (['pdf'].includes(ext)) return 'document-text-outline';
  if (['doc', 'docx'].includes(ext)) return 'document-outline';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'grid-outline';
  if (['ppt', 'pptx'].includes(ext)) return 'easel-outline';
  if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return 'image-outline';
  if (['zip', 'tar', 'gz'].includes(ext)) return 'archive-outline';
  return 'document-outline';
}

function FileCard({ file, rcId, token }: { file: any; rcId: number; token: string }) {
  const [downloading, setDownloading] = useState(false);
  const name = getFileName(file);
  const ext = getFileExtension(file);
  const icon = fileIconName(ext);
  const ocId: number | undefined = file.oc_id ?? file.id;

  async function download() {
    if (!ocId) {
      Alert.alert('Indisponible', 'Identifiant du fichier manquant.');
      return;
    }
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      Alert.alert('Non supporté', 'Le partage de fichiers n\'est pas disponible sur cet appareil.');
      return;
    }

    setDownloading(true);
    try {
      const fileUri = `${FileSystem.cacheDirectory}${name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const dlResult = await FileSystem.downloadAsync(
        `https://api.kordis.fr/me/${rcId}/files/${ocId}`,
        fileUri,
        { headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': 'okhttp/3.13.1' } }
      );
      if (dlResult.status === 200) {
        await Sharing.shareAsync(dlResult.uri, { dialogTitle: name });
      } else {
        Alert.alert('Erreur', `Impossible de télécharger le fichier (code ${dlResult.status}).`);
      }
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Échec du téléchargement.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Card style={styles.fileCard}>
      <View style={styles.fileIconWrap}>
        <Ionicons name={icon} size={22} color={Colors.primary} />
      </View>
      <View style={styles.fileInfo}>
        <Text style={styles.fileName}>{name}</Text>
        {file.description ? (
          <Text style={styles.fileDesc} numberOfLines={2}>{file.description}</Text>
        ) : null}
        {file.upload_date ? (
          <Text style={styles.fileDate}>
            {new Date(file.upload_date).toLocaleDateString('fr-FR')}
          </Text>
        ) : null}
        {ext ? <Text style={styles.fileExt}>{ext.toUpperCase()}</Text> : null}
      </View>
      <TouchableOpacity
        style={[styles.dlBtn, downloading && styles.dlBtnDisabled]}
        onPress={download}
        disabled={downloading}
      >
        {downloading ? (
          <ActivityIndicator size="small" color={Colors.white} />
        ) : (
          <Ionicons name="download-outline" size={18} color={Colors.white} />
        )}
      </TouchableOpacity>
    </Card>
  );
}

export function CourseDetailScreen({ route, navigation }: any) {
  const { course } = route.params as { course: Course };
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('files');

  const { data: files, isLoading: filesLoading, error: filesError } = useApi(
    t => API.getCourseFiles(t, course.rc_id),
    [course.rc_id]
  );

  const { data: projects, isLoading: projectsLoading } = useApi(
    t => API.getProjectsByCourse(t, course.rc_id),
    [course.rc_id]
  );

  const { data: practicals, isLoading: practicalsLoading } = useApi(
    t => API.getPracticals(t, course.year),
    [course.year]
  );

  const { data: syllabus, isLoading: syllabusLoading } = useApi(
    t => API.getSyllabus(t, course.rc_id),
    [course.rc_id]
  );

  const TABS: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'files', label: 'Fichiers', icon: 'document-outline' },
    { key: 'projects', label: 'Projets', icon: 'folder-outline' },
    { key: 'practicals', label: 'TP', icon: 'construct-outline' },
    { key: 'syllabus', label: 'Syllabus', icon: 'list-outline' },
  ];

  function renderContent() {
    switch (activeTab) {
      case 'files':
        if (filesLoading) return <LoadingView />;
        if (filesError) return (
          <EmptyView icon="alert-circle-outline" title="Erreur de chargement" subtitle={filesError} />
        );
        if (!files?.length) return (
          <EmptyView icon="document-outline" title="Aucun fichier" subtitle="Pas de document partagé pour cette matière" />
        );
        return (
          <ScrollView contentContainerStyle={styles.tabContent}>
            <Text style={styles.fileCount}>{files.length} fichier{files.length > 1 ? 's' : ''}</Text>
            {files.map((file: any, i: number) => (
              <FileCard key={file.id ?? i} file={file} rcId={course.rc_id} token={token!} />
            ))}
          </ScrollView>
        );

      case 'projects':
        if (projectsLoading) return <LoadingView />;
        if (!projects?.length) return (
          <EmptyView icon="folder-outline" title="Aucun projet" subtitle="Pas de projet pour cette matière" />
        );
        return (
          <ScrollView contentContainerStyle={styles.tabContent}>
            {projects.map((project, i) => (
              <TouchableOpacity
                key={project.id || i}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('ProjectDetail', { project, course })}
              >
                <Card style={styles.projectCard}>
                  <View style={styles.projectIcon}>
                    <Ionicons name="folder-open-outline" size={22} color={Colors.accent} />
                  </View>
                  <View style={styles.projectInfo}>
                    <Text style={styles.projectName}>{project.name}</Text>
                    {project.description && (
                      <Text style={styles.projectDesc} numberOfLines={2}>{project.description}</Text>
                    )}
                    {project.deadline && (
                      <Text style={styles.projectDeadline}>
                        Échéance : {new Date(project.deadline).toLocaleDateString('fr-FR')}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                </Card>
              </TouchableOpacity>
            ))}
          </ScrollView>
        );

      case 'practicals':
        if (practicalsLoading) return <LoadingView />;
        const coursePracticals = (practicals || []).filter(
          (p: any) => p.rc_id === course.rc_id || p.course_name === course.name
        );
        if (!coursePracticals.length) return (
          <EmptyView icon="construct-outline" title="Aucun TP" subtitle="Pas de travaux pratiques pour cette matière" />
        );
        return (
          <ScrollView contentContainerStyle={styles.tabContent}>
            {coursePracticals.map((tp: any, i: number) => (
              <Card key={i} style={styles.fileCard}>
                <View style={[styles.fileIconWrap, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="construct-outline" size={22} color={Colors.accent} />
                </View>
                <View style={styles.fileInfo}>
                  <Text style={styles.fileName}>{tp.name || `TP ${i + 1}`}</Text>
                  {tp.description && <Text style={styles.fileDesc}>{tp.description}</Text>}
                </View>
              </Card>
            ))}
          </ScrollView>
        );

      case 'syllabus':
        if (syllabusLoading) return <LoadingView />;
        if (!syllabus?.length) return <EmptyView icon="list-outline" title="Syllabus non disponible" />;
        return (
          <ScrollView contentContainerStyle={styles.tabContent}>
            {syllabus.map((item: any, i: number) => (
              <Card key={i} style={styles.syllabusCard}>
                <Text style={styles.syllabusTitle}>{item.title || item.name || `Chapitre ${i + 1}`}</Text>
                {item.description && <Text style={styles.syllabusDesc}>{item.description}</Text>}
              </Card>
            ))}
          </ScrollView>
        );
    }
  }

  return (
    <View style={styles.root}>
      {/* Course header */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="book-outline" size={28} color={Colors.primary} />
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.courseName}>{course.name}</Text>
          <Text style={styles.courseTeacher}>{course.teacher}</Text>
          <Text style={styles.courseMeta}>{course.student_group_name} · S{course.trimester}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons
              name={tab.icon}
              size={16}
              color={activeTab === tab.key ? Colors.primary : Colors.textMuted}
            />
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.content}>{renderContent()}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerIcon: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center',
  },
  headerInfo: { flex: 1 },
  courseName: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  courseTeacher: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  courseMeta: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 12 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Colors.primary },
  tabLabel: { fontSize: 12, fontWeight: '500', color: Colors.textMuted },
  tabLabelActive: { color: Colors.primary, fontWeight: '600' },
  content: { flex: 1 },
  tabContent: { padding: Spacing.md, paddingBottom: 32 },

  fileCount: { fontSize: 12, color: Colors.textMuted, marginBottom: 10, fontWeight: '500' },
  fileCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  fileIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  fileInfo: { flex: 1, minWidth: 0 },
  fileName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  fileDesc: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  fileDate: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  fileExt: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, marginTop: 2, letterSpacing: 0.5 },
  dlBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  dlBtnDisabled: { backgroundColor: Colors.textMuted },

  projectCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  projectIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center',
  },
  projectInfo: { flex: 1 },
  projectName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  projectDesc: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  projectDeadline: { fontSize: 12, color: Colors.danger, marginTop: 4, fontWeight: '600' },

  syllabusCard: { marginBottom: 10 },
  syllabusTitle: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  syllabusDesc: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
});
