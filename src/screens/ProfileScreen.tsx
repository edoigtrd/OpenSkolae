import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { API } from '../api';
import { Card } from '../components/Card';
import { Colors, Spacing } from '../theme';

function InfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={18} color={Colors.primary} />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

export function ProfileScreen({ navigation }: any) {
  const { profile, user, signOut, token, refreshProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setEditedProfile({
      telephone: profile?.telephone || '',
      mobile: profile?.mobile || '',
      address1: profile?.address1 || '',
      address2: profile?.address2 || '',
      city: profile?.city || '',
      zipcode: profile?.zipcode || '',
    });
    setIsEditing(true);
  }

  async function saveProfile() {
    if (!token) return;
    setSaving(true);
    try {
      await API.updateProfile(token, editedProfile);
      await refreshProfile();
      setIsEditing(false);
      Alert.alert('Succès', 'Profil mis à jour.');
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Impossible de sauvegarder.');
    } finally {
      setSaving(false);
    }
  }

  function confirmSignOut() {
    Alert.alert(
      'Déconnexion',
      'Voulez-vous vraiment vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Déconnecter', style: 'destructive', onPress: signOut },
      ]
    );
  }

  const birthday = profile?.birthday
    ? new Date(profile.birthday).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {/* Profile header */}
      <View style={styles.headerCard}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarText}>
            {(profile?.firstname?.[0] || '') + (profile?.name?.[0] || '')}
          </Text>
        </View>
        <Text style={styles.fullName}>
          {profile?.civility} {profile?.firstname} {profile?.name}
        </Text>
        <Text style={styles.studentId}>{profile?.student_id}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{user?.normalized_role || 'student'}</Text>
        </View>
      </View>

      {/* Edit profile button */}
      <View style={styles.actionRow}>
        {!isEditing ? (
          <TouchableOpacity style={styles.editBtn} onPress={startEdit}>
            <Ionicons name="create-outline" size={18} color={Colors.primary} />
            <Text style={styles.editBtnText}>Modifier le profil</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.editActions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setIsEditing(false)}
            >
              <Text style={styles.cancelBtnText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={saveProfile}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>{saving ? 'Sauvegarde...' : 'Enregistrer'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Personal info */}
      <Text style={styles.sectionTitle}>Informations personnelles</Text>
      <Card style={styles.infoCard}>
        <InfoRow icon="mail-outline" label="Email" value={profile?.email} />
        <InfoRow icon="call-outline" label="Téléphone" value={profile?.telephone} />
        <InfoRow icon="phone-portrait-outline" label="Mobile" value={profile?.mobile} />
        <InfoRow icon="calendar-outline" label="Date de naissance" value={birthday} />
        <InfoRow icon="flag-outline" label="Nationalité" value={profile?.nationality} />
        <InfoRow icon="location-outline" label="Lieu de naissance" value={profile?.birthplace} />
        <InfoRow icon="card-outline" label="INE" value={profile?.ine} />
      </Card>

      {/* Editable fields */}
      {isEditing && (
        <>
          <Text style={styles.sectionTitle}>Coordonnées</Text>
          <Card style={styles.editCard}>
            {[
              { key: 'address1', label: 'Adresse', placeholder: '1 rue de la Paix' },
              { key: 'address2', label: 'Complément', placeholder: 'Appartement, bâtiment...' },
              { key: 'city', label: 'Ville', placeholder: 'Paris' },
              { key: 'zipcode', label: 'Code postal', placeholder: '75001' },
              { key: 'telephone', label: 'Téléphone', placeholder: '0600000000' },
              { key: 'mobile', label: 'Mobile', placeholder: '0600000001' },
            ].map(field => (
              <View key={field.key} style={styles.editField}>
                <Text style={styles.editFieldLabel}>{field.label}</Text>
                <TextInput
                  style={styles.editInput}
                  value={editedProfile?.[field.key] || ''}
                  onChangeText={val => setEditedProfile((p: any) => ({ ...p, [field.key]: val }))}
                  placeholder={field.placeholder}
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            ))}
          </Card>
        </>
      )}

      {/* Address (non-edit) */}
      {!isEditing && (
        <>
          <Text style={styles.sectionTitle}>Adresse</Text>
          <Card style={styles.infoCard}>
            <InfoRow icon="home-outline" label="Adresse" value={profile?.address1} />
            {profile?.address2 && <InfoRow icon="home-outline" label="Complément" value={profile.address2} />}
            <InfoRow icon="location-outline" label="Ville" value={profile?.city ? `${profile.zipcode} ${profile.city}` : null} />
            <InfoRow icon="earth-outline" label="Pays" value={profile?.country} />
          </Card>
        </>
      )}

      {/* Emergency contact */}
      {profile?.emergency_contact && (
        <>
          <Text style={styles.sectionTitle}>Contact d'urgence</Text>
          <Card style={styles.infoCard}>
            <InfoRow icon="person-outline" label="Nom" value={profile.emergency_contact.name} />
            <InfoRow icon="call-outline" label="Téléphone" value={profile.emergency_contact.phone} />
          </Card>
        </>
      )}

      {/* Settings shortcuts */}
      <Text style={styles.sectionTitle}>Paramètres</Text>
      <Card style={styles.menuCard}>
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Notifications')}>
          <Ionicons name="notifications-outline" size={20} color={Colors.primary} />
          <Text style={styles.menuLabel}>Notifications</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
        </TouchableOpacity>
        <View style={styles.menuDivider} />
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Documents')}>
          <Ionicons name="document-text-outline" size={20} color={Colors.primary} />
          <Text style={styles.menuLabel}>Mes documents</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
        </TouchableOpacity>
        <View style={styles.menuDivider} />
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('SpeedMeetings')}>
          <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
          <Text style={styles.menuLabel}>Speed meetings</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
        </TouchableOpacity>
        <View style={styles.menuDivider} />
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Partners')}>
          <Ionicons name="business-outline" size={20} color={Colors.primary} />
          <Text style={styles.menuLabel}>Partenaires</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
        </TouchableOpacity>
        <View style={styles.menuDivider} />
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Suggestion')}>
          <Ionicons name="chatbox-outline" size={20} color={Colors.primary} />
          <Text style={styles.menuLabel}>Envoyer une suggestion</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
        </TouchableOpacity>
      </Card>

      {/* Sign out */}
      <TouchableOpacity style={styles.signOutBtn} onPress={confirmSignOut}>
        <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
        <Text style={styles.signOutText}>Se déconnecter</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 48 },
  headerCard: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 30, fontWeight: '700', color: Colors.white },
  fullName: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  studentId: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  roleBadge: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginTop: 10,
  },
  roleText: { fontSize: 13, fontWeight: '600', color: Colors.primary, textTransform: 'capitalize' },
  actionRow: { paddingHorizontal: Spacing.md, paddingVertical: 12 },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    padding: 12,
    alignSelf: 'flex-start',
  },
  editBtnText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  editActions: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, backgroundColor: Colors.surfaceVariant, borderRadius: 12, padding: 12, alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  saveBtn: { flex: 1, backgroundColor: Colors.primary, borderRadius: 12, padding: 12, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: Colors.white },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: Spacing.md,
    marginBottom: 8,
    marginTop: 20,
  },
  infoCard: { marginHorizontal: Spacing.md, gap: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 12, color: Colors.textMuted, fontWeight: '500' },
  infoValue: { fontSize: 15, color: Colors.textPrimary, fontWeight: '500', marginTop: 2 },
  editCard: { marginHorizontal: Spacing.md, gap: 14 },
  editField: {},
  editFieldLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  editInput: {
    backgroundColor: Colors.surfaceVariant,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  menuCard: { marginHorizontal: Spacing.md, padding: 0, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  menuLabel: { flex: 1, fontSize: 15, color: Colors.textPrimary },
  menuDivider: { height: 1, backgroundColor: Colors.border, marginLeft: 48 },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: Spacing.md,
    marginTop: 24,
    padding: 16,
    backgroundColor: '#FEE2E2',
    borderRadius: 14,
  },
  signOutText: { fontSize: 15, fontWeight: '600', color: Colors.danger },
});
