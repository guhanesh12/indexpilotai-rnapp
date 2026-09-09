import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';

interface InfoCardProps {
  profile: any;
}

export default function PersonalInfoCard({ profile }: InfoCardProps) {
  const { theme: colors } = useTheme();
  const styles = getStyles(colors);

  const Card = ({ children, title }: { children: React.ReactNode, title: string }) => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );

  const InfoRow = ({ label, value, icon }: { label: string, value: string, icon: any }) => (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={20} color={colors.text.secondary} style={styles.icon} />
      <View>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
    </View>
  );

  if (!profile) {
    return (
      <Card title="Personal Information">
        <Text style={styles.value}>No personal information available.</Text>
      </Card>
    );
  }

  return (
    <Card title="Personal Information">
      <InfoRow label="Full Name" value={profile.full_name || 'N/A'} icon="person-outline" />
      <View style={styles.separator} />
      <InfoRow label="Email Address" value={profile.email || 'N/A'} icon="mail-outline" />
      <View style={styles.separator} />
      <InfoRow label="Mobile Number" value={profile.mobile || 'N/A'} icon="call-outline" />
    </Card>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.bg.surface,
      borderRadius: 12,
      padding: 16,
      marginVertical: 8,
      borderWidth: 1,
      borderColor: colors.border.default,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text.primary,
      marginBottom: 16,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
    },
    icon: {
      marginRight: 16,
    },
    label: {
      color: colors.text.secondary,
      fontSize: 12,
    },
    value: {
      color: colors.text.primary,
      fontSize: 16,
    },
    separator: {
      height: 1,
      backgroundColor: colors.border.default,
      marginVertical: 8,
    },
  });
