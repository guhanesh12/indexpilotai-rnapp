import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../lib/theme';

interface PnlScreenshotCardProps {
  displayName: string;
  userId: string;
  userInitials: string;
  todayPnl: number;
  positions: any[];
  runningTime: string;
  currentTime: Date;
  positionSymbols: string;
  totalPnl?: number;
  engineRunning?: boolean;
  engineInterval?: string;
  referralLink?: string;
}

const PnlScreenshotCard: React.FC<PnlScreenshotCardProps> = ({
  displayName,
  userId,
  userInitials,
  todayPnl,
  positions,
  runningTime,
  currentTime,
  positionSymbols,
  totalPnl = 0,
  engineRunning = false,
  engineInterval = '15',
  referralLink,
}) => {
  const pnlPositive = todayPnl >= 0;
  const currentDate = currentTime.toLocaleDateString('en-IN', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric' 
  });
  const currentTimeStr = currentTime.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: true 
  });
  
// Format runtime for buy/sell display
  const formatTradeTime = (ms: number) => {
    if (ms <= 0) return 'N/A';
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };
  
  // Show actual runtime when engine is running, not "N/A"
  // If runtime is available, use it; otherwise show "Running" if engine is active
  const tradeDuration = engineRunning 
    ? (runningTime && runningTime !== 'N/A' ? runningTime : 'Starting...')
    : 'N/A';

  return (
    <LinearGradient
      colors={['#00B4FF', '#7C5CFF', '#FF4DD2']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.screenshotCard}
    >
      {/* Header: Logo and Verification Badge */}
      <View style={styles.screenshotHeaderRow}>
        <View style={styles.screenshotLogo}>
          <Ionicons name="trending-up" size={28} color="#fff" />
        </View>
        <View style={styles.screenshotBrand}>
          <Text style={styles.screenshotBrandText}>IndexPilot AI</Text>
          <View style={styles.verificationBadgeRow}>
            <View style={styles.screenshotVerifiedBadge}>
              <Ionicons name="checkmark-circle" size={10} color="#00FF66" />
              <Text style={styles.screenshotVerifiedText}>Verified P&L</Text>
            </View>
            {engineRunning && (
              <View style={styles.engineBadge}>
                <Ionicons name="flash" size={10} color="#FFB800" />
                <Text style={styles.engineBadgeText}>AI ENGINE {engineInterval}M</Text>
              </View>
            )}
          </View>
        </View>
      </View>
      
      {/* User Info Row */}
      <View style={styles.screenshotUserRow}>
        <View style={styles.screenshotAvatar}>
          <Text style={styles.screenshotAvatarText}>{userInitials}</Text>
        </View>
        <View style={styles.screenshotUserInfo}>
          <Text style={styles.screenshotUserName} numberOfLines={1}>{displayName}</Text>
          <Text style={styles.screenshotUserId}>ID: {userId}</Text>
        </View>
      </View>
      
      {/* P&L Badge - Highlighted */}
      <View style={[styles.pnlBadgeContainer, { borderColor: pnlPositive ? '#00FF66' : '#FF3344' }]}>
<View style={[styles.pnlBadgeHeader, { backgroundColor: pnlPositive ? 'rgba(0,255,102,0.15)' : 'rgba(255,51,68,0.15)' }]}>
            <Text style={styles.pnlBadgeLabel}>TODAY&apos;S P&L</Text>
          {pnlPositive ? (
            <Ionicons name="arrow-up" size={12} color="#00FF66" />
          ) : (
            <Ionicons name="arrow-down" size={12} color="#FF3344" />
          )}
        </View>
        <Text style={[styles.screenshotPnlValue, { color: pnlPositive ? '#00FF66' : '#FF3344' }]}>
          {pnlPositive ? '+' : ''}₹{Math.abs(todayPnl).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
        </Text>
        {totalPnl !== 0 && (
          <View style={styles.totalPnlRow}>
            <Text style={styles.totalPnlLabel}>Total P&L:</Text>
            <Text style={[styles.totalPnlValue, { color: totalPnl >= 0 ? '#00FF66' : '#FF3344' }]}>
              {totalPnl >= 0 ? '+' : ''}₹{Math.abs(totalPnl).toLocaleString('en-IN')}
            </Text>
          </View>
        )}
      </View>
      
      {/* Stats Grid - Date, Time, Runtime, Positions */}
      <View style={styles.screenshotStatsGrid}>
        <View style={styles.screenshotStatsRow}>
          <View style={styles.screenshotStat}>
            <Text style={styles.screenshotStatLabel}>📅 DATE</Text>
            <Text style={styles.screenshotStatValue}>{currentDate}</Text>
          </View>
          <View style={styles.screenshotStat}>
            <Text style={styles.screenshotStatLabel}>⏰ TIME</Text>
            <Text style={styles.screenshotStatValue}>{currentTimeStr}</Text>
          </View>
        </View>
        <View style={styles.screenshotStatsRow}>
          <View style={styles.screenshotStat}>
            <Text style={styles.screenshotStatLabel}>⚡ RUNTIME</Text>
            <Text style={styles.screenshotStatValue}>{tradeDuration}</Text>
          </View>
          <View style={styles.screenshotStat}>
            <Text style={styles.screenshotStatLabel}>📂 POSITIONS</Text>
            <Text style={styles.screenshotStatValue}>{positions.length}</Text>
          </View>
        </View>
      </View>

      {/* Symbols Row */}
      {positionSymbols ? (
        <View style={styles.symbolsContainer}>
          <Text style={styles.symbolsLabel}>🎯 ACTIVE SYMBOLS</Text>
          <Text style={styles.symbolsValue} numberOfLines={2}>{positionSymbols}</Text>
        </View>
      ) : (
        <View style={styles.symbolsContainer}>
          <Text style={styles.symbolsLabel}>🎯 ACTIVE SYMBOLS</Text>
          <Text style={styles.symbolsValueNoData}>No active symbols</Text>
        </View>
      )}

      {referralLink ? (
        <View style={styles.referralContainer}>
          <View style={styles.referralBadge}>
            <Ionicons name="gift" size={12} color="#FFB800" />
            <Text style={styles.referralBadgeText}>REFER &amp; EARN</Text>
          </View>
          <Text style={styles.referralLabel}>Join IndexPilot AI with my link</Text>
          <Text style={styles.referralLink} numberOfLines={1}>{referralLink}</Text>
        </View>
      ) : null}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  screenshotCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginVertical: spacing.base,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  screenshotHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  screenshotLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  screenshotBrand: {
    marginLeft: spacing.base,
    flex: 1,
  },
  screenshotBrandText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  verificationBadgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  screenshotVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,255,102,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  screenshotVerifiedText: {
    color: '#00FF66',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  engineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,184,0,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  engineBadgeText: {
    color: '#FFB800',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  screenshotUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.base,
    paddingBottom: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  screenshotAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'linear-gradient(135deg, #00B4FF 0%, #7C5CFF 100%)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  screenshotAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  screenshotUserInfo: {
    marginLeft: spacing.base,
    flex: 1,
  },
  screenshotUserName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  screenshotUserId: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontFamily: 'monospace',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
    overflow: 'hidden',
  },
  pnlBadgeContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    marginBottom: spacing.base,
    borderRadius: radius.md,
    borderWidth: 2,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  pnlBadgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pnlBadgeLabel: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  screenshotPnlValue: {
    fontSize: 36,
    fontWeight: '900',
    marginTop: 8,
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  totalPnlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  totalPnlLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '600',
  },
  totalPnlValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  screenshotStatsGrid: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: radius.md,
    padding: spacing.base,
    marginTop: spacing.sm,
  },
  screenshotStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.base,
  },
  screenshotStat: {
    alignItems: 'center',
    flex: 1,
  },
  screenshotStatLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  screenshotStatValue: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 4,
  },
  symbolsContainer: {
    marginTop: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: radius.md,
    padding: spacing.base,
  },
  symbolsLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  symbolsValue: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  symbolsValueNoData: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontStyle: 'italic',
  },
  referralContainer: {
    marginTop: spacing.sm,
    backgroundColor: 'rgba(255,184,0,0.12)',
    borderRadius: radius.md,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: 'rgba(255,184,0,0.35)',
  },
  referralBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,184,0,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  referralBadgeText: {
    color: '#FFB800',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  referralLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  referralLink: {
    color: '#FFB800',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    fontFamily: 'monospace',
  },
});

export default PnlScreenshotCard;
