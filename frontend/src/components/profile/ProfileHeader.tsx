import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';

import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { API_BASE, SUPABASE_ANON_KEY } from '../../lib/api';

const FN_BASE = API_BASE;

async function patchProfileMe(token: string, body: Record<string, any>) {
  const res = await fetch(`${FN_BASE}/profile/me`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j?.error || j?.message || msg;
    } catch {}
    throw new Error(msg);
  }

  return res.json();
}

const getInitials = (name: string) => {
  if (!name) return '...';
  const names = name.split(' ').filter(Boolean);
  const initials = names.map((n) => n[0]).join('');
  return initials.slice(0, 2).toUpperCase();
};

interface ProfileHeaderProps {
  profile: {
    photo_url?: string | null;
    full_name?: string;
    client_id?: string;
    kyc_status?: string | null;
  } | null;

  loading: boolean;
  refresh: () => void;
  error?: any;
}

export default function ProfileHeader({
  profile,
  loading,
  refresh,
  error,
}: ProfileHeaderProps) {
  const { user } = useAuth();
  const { theme: colors } = useTheme();
  const spacing = { base: 16, sm: 8, xs: 4 };
  const radius = { full: 9999, lg: 12, xl: 16 };

  const handleAvatarChange = async () => {
    if (!user) return;

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert(
        'Permission required',
        'You need to allow access to your photos to change your avatar.'
      );
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (pickerResult.canceled) return;

    const { assets } = pickerResult;
    if (!assets || assets.length === 0) {
      Alert.alert('Error', 'Could not get the selected image.');
      return;
    }

    const image = assets[0];
    const file = {
      uri: image.uri,
      name: image.uri.split('/').pop(),
      type: `image/${image.uri.split('.').pop()}`,
    } as any;

    const path = `${user.id}/${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      console.error('Error uploading avatar:', uploadError);
      Alert.alert('Upload Failed', uploadError.message);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(path);

    const publicUrl = urlData.publicUrl;

    const {
      data: { session },
    } = await supabase.auth.getSession().catch((e: any) => {
      console.log('[ProfileHeader] Invalid session during avatar upload:', e?.message || e);
      return { data: { session: null } };
    });
    const token = session?.access_token;

    if (!token) {
      Alert.alert('Session expired', 'Please login again.');
      return;
    }

    try {
      await patchProfileMe(token, { photo_url: publicUrl });
      refresh();
    } catch (e: any) {
      Alert.alert('Update Failed', e?.message || 'Could not update avatar');
    }
  };

  const styles = getStyles(colors, spacing, radius);

  if (loading) {
    return (
      <View style={[styles.card, styles.loadingContainer]}>
        <ActivityIndicator color={colors.brand.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.card}>
        <Text style={{ color: 'red' }}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerContent}>
        <TouchableOpacity onPress={handleAvatarChange}>
          {profile?.photo_url ? (
            <Image source={{ uri: `${profile.photo_url}?t=${Date.now()}` }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitials}>
                {getInitials(profile?.full_name || '')}
              </Text>
            </View>
          )}
          <View style={styles.cameraIcon}>
            <Ionicons name="camera" size={16} color={colors.text.primary} />
          </View>
        </TouchableOpacity>

        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>
            {profile?.full_name || 'New User'}
          </Text>
          <View style={styles.pillsContainer}>
            {profile?.client_id ? (
              <View style={styles.clientIdPill}>
                <Ionicons name="person-circle-outline" size={12} color="#FFD700" />
                <Text style={[styles.pillText, { color: '#FFD700' }]}>{profile.client_id}</Text>
              </View>
            ) : null}
            {profile?.kyc_status === 'verified' ? (
              <View style={styles.verifiedPill}>
                <Ionicons name="shield-checkmark" size={12} color={colors.status.verified} />
                <Text style={[styles.pillText, { color: colors.status.verified }]}>Verified</Text>
              </View>
            ) : null}
          </View>
        </View>

        <TouchableOpacity style={styles.editButton}>
          <Ionicons name="create-outline" size={24} color={colors.text.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const getStyles = (colors: any, spacing: any, radius: any) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.bg.surface,
      borderRadius: radius.xl,
      padding: spacing.base,
      marginBottom: spacing.base,
      borderWidth: 1,
      borderColor: colors.border.default,
    },
    loadingContainer: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: radius.full,
      borderWidth: 2,
      borderColor: colors.brand.primary,
    },
    avatarPlaceholder: {
      width: 64,
      height: 64,
      borderRadius: radius.full,
      backgroundColor: colors.border.default,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.brand.primary,
    },
    avatarInitials: {
      color: colors.text.primary,
      fontSize: 24,
      fontWeight: 'bold',
    },
    cameraIcon: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      backgroundColor: colors.bg.surface,
      borderRadius: radius.full,
      padding: spacing.xs,
      borderWidth: 1,
      borderColor: colors.border.default,
    },
    userInfo: {
      flex: 1,
      marginLeft: spacing.base,
    },
    userName: {
      color: colors.text.primary,
      fontSize: 20,
      fontWeight: '700',
    },
    pillsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.sm,
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    pillText: {
      fontSize: 12,
      fontWeight: '600',
    },
    clientIdPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: `rgba(255, 215, 0, 0.15)`,
      borderColor: '#FFD700',
      borderWidth: 1,
      borderRadius: radius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    verifiedPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: `rgba(52, 211, 153, 0.1)`,
      borderColor: colors.status.verified,
      borderWidth: 1,
      borderRadius: radius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    editButton: {
      marginLeft: 'auto',
      padding: spacing.sm,
    },
  });
