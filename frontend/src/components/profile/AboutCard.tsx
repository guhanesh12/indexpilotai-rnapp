import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';

const pages = [
  { title: 'About Us', url: 'https://www.indexpilotai.com/page/about' },
  { title: 'Contact Us', url: 'https://www.indexpilotai.com/page/contact' },
  { title: 'Privacy Policy', url: 'https://www.indexpilotai.com/page/privacy' },
  { title: 'Terms of Service', url: 'https://www.indexpilotai.com/page/terms' },
  { title: 'Refund Policy', url: 'https://www.indexpilotai.com/page/refund' },
  { title: 'Disclaimer', url: 'https://www.indexpilotai.com/page/disclaimer' },
];

export default function AboutCard() {
  const { theme: colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>About IndexPilot AI</Text>
      {pages.map((page, index) => (
        <React.Fragment key={page.url}>
          <Link href={{
            pathname: `/webview/${encodeURIComponent(page.title)}` as any,
            params: { url: page.url },
          }} asChild>
            <TouchableOpacity style={styles.listItem}>
              <Text style={styles.listItemText}>{page.title}</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          </Link>
          {index < pages.length - 1 && <View style={styles.separator} />}
        </React.Fragment>
      ))}
    </View>
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
    listItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
    },
    listItemText: {
      color: colors.text.primary,
      fontSize: 16,
    },
    separator: {
      height: 1,
      backgroundColor: colors.border.default,
    },
  });
