import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import { AiAnswer, AiAction, SlotRow, Verdict, JournalEntry, JournalStats, LogEntry } from '../api/aiChat';
import { colors, spacing, radius, typography } from '../lib/theme';

interface Props {
  answer: AiAnswer;
  onActionPress: (action: AiAction) => Promise<void>;
  actionLoading: boolean;
  onUpdateSlot: (slot: number, fields: any) => Promise<void>;
  onConnectBroker: () => void;
  onNavigateToJournal?: () => void;
  onNavigateToLogs?: () => void;
}

// ─── Verdict config ─────────────────────────────────────
const VERDICT_CONFIG: Record<Verdict, { label: string; color: string; bg: string; border: string }> = {
  WAIT: { label: 'WAIT', color: '#FFB800', bg: 'rgba(255,184,0,0.1)', border: 'rgba(255,184,0,0.3)' },
  PLACE: { label: 'ENTRY READY', color: '#00FF66', bg: 'rgba(0,255,102,0.1)', border: 'rgba(0,255,102,0.3)' },
  HOLD: { label: 'HOLD', color: '#00BFFF', bg: 'rgba(0,191,255,0.1)', border: 'rgba(0,191,255,0.3)' },
  EXIT: { label: 'EXIT NOW', color: '#FF3344', bg: 'rgba(255,51,68,0.1)', border: 'rgba(255,51,68,0.3)' },
  INFO: { label: 'INFO', color: '#8A8A93', bg: 'rgba(138,138,147,0.1)', border: 'rgba(138,138,147,0.3)' },
};

const INDEX_OPTIONS = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX'];
const MONEYNESS_OPTIONS = ['ITM2', 'ITM1', 'ATM', 'OTM1', 'OTM2'];

export default function AIChatAssistantCard({
  answer,
  onActionPress,
  actionLoading,
  onUpdateSlot,
  onConnectBroker,
  onNavigateToJournal,
  onNavigateToLogs,
}: Props) {
  const [slotForm, setSlotForm] = useState<any>(null);

  const vc = VERDICT_CONFIG[answer.verdict] || VERDICT_CONFIG.INFO;

  const handleActionPress = async () => {
    if (!answer.action || answer.action.type === 'none') return;
    await onActionPress(answer.action);
  };

  const handleSlotSave = async () => {
    if (!slotForm) return;
    await onUpdateSlot(answer.action.slot!, slotForm);
    setSlotForm(null);
  };

  const renderActionUI = () => {
    const action = answer.action;
    if (!action || action.type === 'none') return null;

    switch (action.type) {
      case 'place_order':
        return (
          <View style={styles.actionSection}>
            <TouchableOpacity
              testID="action-place-order"
              style={[styles.actionBtn, styles.actionBtnGreen]}
              onPress={handleActionPress}
              disabled={actionLoading}
              activeOpacity={0.8}
            >
              {actionLoading ? (
                <ActivityIndicator color="#050505" size="small" />
              ) : (
                <Ionicons name="checkmark-circle" size={18} color="#050505" />
              )}
              <Text style={styles.actionBtnText}>
                {actionLoading ? 'Placing…' : (action.label || 'Place order')}
              </Text>
            </TouchableOpacity>
            <Text style={styles.actionCaption}>no wallet charge</Text>
          </View>
        );

      case 'exit_position':
        return (
          <View style={styles.actionSection}>
            <TouchableOpacity
              testID="action-exit-position"
              style={[styles.actionBtn, styles.actionBtnRed]}
              onPress={handleActionPress}
              disabled={actionLoading}
              activeOpacity={0.8}
            >
              {actionLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="exit" size={18} color="#fff" />
              )}
              <Text style={styles.actionBtnText}>
                {actionLoading ? 'Exiting…' : (action.label || 'Exit position')}
              </Text>
            </TouchableOpacity>
            <Text style={styles.actionCaption}>no wallet charge</Text>
          </View>
        );

      case 'start_engine':
        return (
          <View style={styles.actionSection}>
            <TouchableOpacity
              testID="action-start-engine"
              style={[styles.actionBtn, styles.actionBtnGreen]}
              onPress={handleActionPress}
              disabled={actionLoading}
              activeOpacity={0.8}
            >
              {actionLoading ? (
                <ActivityIndicator color="#050505" size="small" />
              ) : (
                <Ionicons name="play" size={18} color="#050505" />
              )}
              <Text style={styles.actionBtnText}>
                {actionLoading ? 'Starting…' : (action.label || 'Start trading engine')}
              </Text>
            </TouchableOpacity>
            <Text style={styles.actionCaption}>no wallet charge</Text>
          </View>
        );

      case 'stop_engine':
        return (
          <View style={styles.actionSection}>
            <TouchableOpacity
              testID="action-stop-engine"
              style={[styles.actionBtn, styles.actionBtnGrey]}
              onPress={handleActionPress}
              disabled={actionLoading}
              activeOpacity={0.8}
            >
              {actionLoading ? (
                <ActivityIndicator color="#050505" size="small" />
              ) : (
                <Ionicons name="stop" size={18} color="#050505" />
              )}
              <Text style={styles.actionBtnText}>
                {actionLoading ? 'Stopping…' : (action.label || 'Stop trading engine')}
              </Text>
            </TouchableOpacity>
            <Text style={styles.actionCaption}>no wallet charge</Text>
          </View>
        );

      case 'edit_slot':
        const current = action.current;
        const form = slotForm ?? {
          indexName: current?.index_name || 'NIFTY',
          moneyness: current?.moneyness || 'ATM',
          lotCount: current?.lot_count || 1,
          targetPerLot: current?.target_per_lot || 6000,
          stopLossPerLot: current?.stop_loss_per_lot || 3000,
          trailingEnabled: current?.trailing_enabled ?? true,
          trailingActivationPerLot: current?.trailing_activation_per_lot || 2000,
          trailingStepPerLot: current?.trailing_step_per_lot || 1000,
        };

        return (
          <View style={styles.actionSection}>
            <Text style={styles.slotTitle}>Slot {action.slot} Configuration</Text>

            {/* Index picker */}
            <View style={styles.pickerRow}>
              <Text style={styles.pickerLabel}>Index</Text>
              <View style={styles.pickerOptions}>
                {INDEX_OPTIONS.map((idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.pickerOption,
                      form.indexName === idx && styles.pickerOptionActive,
                    ]}
                    onPress={() => setSlotForm({ ...form, indexName: idx })}
                  >
                    <Text style={[styles.pickerOptionText, form.indexName === idx && styles.pickerOptionTextActive]}>
                      {idx}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Moneyness picker */}
            <View style={styles.pickerRow}>
              <Text style={styles.pickerLabel}>Moneyness</Text>
              <View style={styles.pickerOptions}>
                {MONEYNESS_OPTIONS.map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.pickerOption,
                      form.moneyness === m && styles.pickerOptionActive,
                    ]}
                    onPress={() => setSlotForm({ ...form, moneyness: m })}
                  >
                    <Text style={[styles.pickerOptionText, form.moneyness === m && styles.pickerOptionTextActive]}>
                      {m}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Numeric inputs */}
            <View style={styles.inputRow}>
              <View style={styles.inputHalf}>
                <Text style={styles.inputLabel}>Lots</Text>
                <TextInput
                  style={styles.slotInput}
                  value={String(form.lotCount)}
                  onChangeText={(v) => setSlotForm({ ...form, lotCount: parseInt(v) || 0 })}
                  keyboardType="number-pad"
                  placeholder="1"
                  placeholderTextColor={colors.text.disabled}
                />
              </View>
              <View style={styles.inputHalf}>
                <Text style={styles.inputLabel}>Target / lot (₹)</Text>
                <TextInput
                  style={styles.slotInput}
                  value={String(form.targetPerLot)}
                  onChangeText={(v) => setSlotForm({ ...form, targetPerLot: parseInt(v) || 0 })}
                  keyboardType="number-pad"
                  placeholder="6000"
                  placeholderTextColor={colors.text.disabled}
                />
              </View>
            </View>

            <View style={styles.inputRow}>
              <View style={styles.inputHalf}>
                <Text style={styles.inputLabel}>SL / lot (₹)</Text>
                <TextInput
                  style={styles.slotInput}
                  value={String(form.stopLossPerLot)}
                  onChangeText={(v) => setSlotForm({ ...form, stopLossPerLot: parseInt(v) || 0 })}
                  keyboardType="number-pad"
                  placeholder="3000"
                  placeholderTextColor={colors.text.disabled}
                />
              </View>
              <View style={styles.inputHalf}>
                <Text style={styles.inputLabel}>Trail activate (₹)</Text>
                <TextInput
                  style={styles.slotInput}
                  value={String(form.trailingActivationPerLot)}
                  onChangeText={(v) => setSlotForm({ ...form, trailingActivationPerLot: parseInt(v) || 0 })}
                  keyboardType="number-pad"
                  placeholder="2000"
                  placeholderTextColor={colors.text.disabled}
                />
              </View>
            </View>

            <View style={styles.inputRow}>
              <View style={styles.inputHalf}>
                <Text style={styles.inputLabel}>Trail step (₹)</Text>
                <TextInput
                  style={styles.slotInput}
                  value={String(form.trailingStepPerLot)}
                  onChangeText={(v) => setSlotForm({ ...form, trailingStepPerLot: parseInt(v) || 0 })}
                  keyboardType="number-pad"
                  placeholder="1000"
                  placeholderTextColor={colors.text.disabled}
                />
              </View>
              <View style={styles.inputHalf}>
                <Text style={styles.inputLabel}>Enabled</Text>
                <TouchableOpacity
                  style={[styles.toggle, form.enabled && styles.toggleActive]}
                  onPress={() => setSlotForm({ ...form, enabled: !form.enabled })}
                >
                  <View style={[styles.toggleKnob, form.enabled && styles.toggleKnobActive]} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputRow}>
              <View style={styles.inputHalf}>
                <Text style={styles.inputLabel}>Trailing SL</Text>
                <TouchableOpacity
                  style={[styles.toggle, form.trailingEnabled && styles.toggleActive]}
                  onPress={() => setSlotForm({ ...form, trailingEnabled: !form.trailingEnabled })}
                >
                  <View style={[styles.toggleKnob, form.trailingEnabled && styles.toggleKnobActive]} />
                </TouchableOpacity>
              </View>
              <View style={styles.inputHalf} />
            </View>

            <TouchableOpacity
              testID="slot-save-button"
              style={[styles.actionBtn, styles.actionBtnGreen, { marginTop: spacing.sm }]}
              onPress={handleSlotSave}
              disabled={actionLoading}
              activeOpacity={0.8}
            >
              {actionLoading ? (
                <ActivityIndicator color="#050505" size="small" />
              ) : (
                <Ionicons name="save" size={18} color="#050505" />
              )}
              <Text style={styles.actionBtnText}>
                {actionLoading ? 'Saving…' : 'Save Slot'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.actionCaption}>no wallet charge</Text>
          </View>
        );

      case 'connect_broker':
        return (
          <View style={styles.actionSection}>
            <TouchableOpacity
              testID="action-connect-broker"
              style={[styles.actionBtn, styles.actionBtnPrimary]}
              onPress={onConnectBroker}
              activeOpacity={0.8}
            >
              <Ionicons name="flash" size={18} color="#050505" />
              <Text style={styles.actionBtnText}>
                {action.label || 'Open broker settings'}
              </Text>
            </TouchableOpacity>
          </View>
        );

      case 'create_ticket': {
        const ticket = action.ticket || { subject: '', message: '', urgency: 'NORMAL', category: 'TECHNICAL' };
        return (
          <View style={styles.actionSection}>
            <Text style={styles.slotTitle}>Create Support Ticket</Text>
            <View style={styles.inputRow}>
              <View style={styles.inputHalf}>
                <Text style={styles.inputLabel}>Subject</Text>
                <TextInput
                  style={styles.slotInput}
                  value={ticket.subject}
                  onChangeText={(subject) => onActionPress({ ...action, ticket: { ...ticket, subject } })}
                  placeholder="Brief subject"
                  placeholderTextColor={colors.text.disabled}
                />
              </View>
            </View>
            <View style={styles.inputRow}>
              <View style={styles.inputFull}>
                <Text style={styles.inputLabel}>Message</Text>
                <TextInput
                  style={[styles.slotInput, { minHeight: 80, textAlignVertical: 'top' }]}
                  value={ticket.message}
                  onChangeText={(message) => onActionPress({ ...action, ticket: { ...ticket, message } })}
                  placeholder="Describe your issue..."
                  placeholderTextColor={colors.text.disabled}
                  multiline
                />
              </View>
            </View>
            <View style={styles.inputRow}>
              <View style={styles.inputHalf}>
                <Text style={styles.inputLabel}>Urgency</Text>
                <View style={styles.pickerOptions}>
                  {['LOW', 'NORMAL', 'URGENT'].map((u) => (
                    <TouchableOpacity
                      key={u}
                      style={[styles.pickerOption, ticket.urgency === u && styles.pickerOptionActive]}
                      onPress={() => onActionPress({ ...action, ticket: { ...ticket, urgency: u } })}
                    >
                      <Text style={[styles.pickerOptionText, ticket.urgency === u && styles.pickerOptionTextActive]}>
                        {u}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.inputHalf}>
                <Text style={styles.inputLabel}>Category</Text>
                <View style={styles.pickerOptions}>
                  {['TECHNICAL', 'REFUND', 'WEBSITE', 'OTHER'].map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.pickerOption, ticket.category === c && styles.pickerOptionActive]}
                      onPress={() => onActionPress({ ...action, ticket: { ...ticket, category: c } })}
                    >
                      <Text style={[styles.pickerOptionText, ticket.category === c && styles.pickerOptionTextActive]}>
                        {c}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
            <TouchableOpacity
              testID="action-create-ticket"
              style={[styles.actionBtn, styles.actionBtnGreen, { marginTop: spacing.sm }]}
              onPress={() => onActionPress({ ...action, ticket })}
              disabled={actionLoading}
              activeOpacity={0.8}
            >
              {actionLoading ? (
                <ActivityIndicator color="#050505" size="small" />
              ) : (
                <Ionicons name="create" size={18} color="#050505" />
              )}
              <Text style={styles.actionBtnText}>
                {actionLoading ? 'Creating…' : 'Create support ticket'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.actionCaption}>no wallet charge</Text>
          </View>
        );
      }

      case 'edit_profile': {
        const profile = action.profile || { full_name: '', mobile: '', photo_url: '', client_id: '', email: '' };
        return (
          <View style={styles.actionSection}>
            <Text style={styles.slotTitle}>Edit Profile</Text>
            <View style={styles.inputRow}>
              <View style={styles.inputFull}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <TextInput
                  style={styles.slotInput}
                  value={profile.full_name}
                  onChangeText={(full_name) => onActionPress({ ...action, profile: { ...profile, full_name } })}
                  placeholder="Your name"
                  placeholderTextColor={colors.text.disabled}
                />
              </View>
            </View>
            <View style={styles.inputRow}>
              <View style={styles.inputFull}>
                <Text style={styles.inputLabel}>Mobile Number</Text>
                <TextInput
                  style={styles.slotInput}
                  value={profile.mobile}
                  onChangeText={(mobile) => onActionPress({ ...action, profile: { ...profile, mobile } })}
                  placeholder="9876543210"
                  placeholderTextColor={colors.text.disabled}
                  keyboardType="phone-pad"
                />
              </View>
            </View>
            <View style={styles.inputRow}>
              <View style={styles.inputFull}>
                <Text style={styles.inputLabel}>Photo URL</Text>
                <TextInput
                  style={styles.slotInput}
                  value={profile.photo_url}
                  onChangeText={(photo_url) => onActionPress({ ...action, profile: { ...profile, photo_url } })}
                  placeholder="https://..."
                  placeholderTextColor={colors.text.disabled}
                  autoCapitalize="none"
                />
              </View>
            </View>
            <TouchableOpacity
              testID="action-update-profile"
              style={[styles.actionBtn, styles.actionBtnGreen, { marginTop: spacing.sm }]}
              onPress={() => onActionPress({ ...action, profile })}
              disabled={actionLoading}
              activeOpacity={0.8}
            >
              {actionLoading ? (
                <ActivityIndicator color="#050505" size="small" />
              ) : (
                <Ionicons name="save" size={18} color="#050505" />
              )}
              <Text style={styles.actionBtnText}>
                {actionLoading ? 'Saving…' : 'Save profile'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.actionCaption}>no wallet charge</Text>
          </View>
        );
      }

      case 'view_journal': {
        const journal = action.journal || { stats: { total_trades: 0, total_pnl: 0, wins: 0, losses: 0, win_rate: 0 }, entries: [] };
        const displayEntries = journal.entries.slice(0, 6);
        return (
          <View style={styles.actionSection}>
            <View style={styles.statsRow}>
              <View style={[styles.statChip, { borderColor: 'rgba(0,255,102,0.3)' }]}>
                <Text style={[styles.statChipLabel, { color: '#00FF66' }]}>Trades</Text>
                <Text style={styles.statChipValue}>{journal.stats.total_trades}</Text>
              </View>
              <View style={[styles.statChip, { borderColor: journal.stats.total_pnl >= 0 ? 'rgba(0,255,102,0.3)' : 'rgba(255,51,68,0.3)' }]}>
                <Text style={[styles.statChipLabel, { color: journal.stats.total_pnl >= 0 ? '#00FF66' : '#FF3344' }]}>P&L</Text>
                <Text style={[styles.statChipValue, { color: journal.stats.total_pnl >= 0 ? '#00FF66' : '#FF3344' }]}>
                  ₹{journal.stats.total_pnl.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={[styles.statChip, { borderColor: 'rgba(0,191,255,0.3)' }]}>
                <Text style={[styles.statChipLabel, { color: '#00BFFF' }]}>Win %</Text>
                <Text style={styles.statChipValue}>{journal.stats.win_rate.toFixed(1)}%</Text>
              </View>
            </View>
            <View style={styles.journalList}>
              {displayEntries.map((entry: JournalEntry) => (
                <View key={entry.id} style={styles.journalRow}>
                  <View style={styles.journalLeft}>
                    <Text style={styles.journalDate}>{entry.date}</Text>
                    <Text style={styles.journalSymbol}>{entry.symbol}</Text>
                    <Text style={styles.journalSide}>{entry.side}</Text>
                  </View>
                  <Text style={[styles.journalPnl, { color: entry.pnl >= 0 ? '#00FF66' : '#FF3344' }]}>
                    ₹{entry.pnl.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </Text>
                </View>
              ))}
            </View>
            <TouchableOpacity
              testID="action-open-journal"
              style={[styles.actionBtn, styles.actionBtnPrimary, { marginTop: spacing.sm }]}
              onPress={() => onNavigateToJournal?.()}
              activeOpacity={0.8}
            >
              <Ionicons name="book" size={18} color="#050505" />
              <Text style={styles.actionBtnText}>Open full journal</Text>
            </TouchableOpacity>
          </View>
        );
      }

      case 'view_logs': {
        const logs = action.logs || [];
        const displayLogs = logs.slice(0, 6);
        return (
          <View style={styles.actionSection}>
            <View style={styles.logsList}>
              {displayLogs.map((log: LogEntry, idx: number) => (
                <View key={idx} style={styles.logRow}>
                  <Text style={styles.logTime}>
                    {log.timestamp ? new Date(log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </Text>
                  <Text style={styles.logMessage}>{log.message}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity
              testID="action-open-logs"
              style={[styles.actionBtn, styles.actionBtnPrimary, { marginTop: spacing.sm }]}
              onPress={() => onNavigateToLogs?.()}
              activeOpacity={0.8}
            >
              <Ionicons name="list" size={18} color="#050505" />
              <Text style={styles.actionBtnText}>Open logs</Text>
            </TouchableOpacity>
          </View>
        );
      }

      default:
        return null;
    }
  };

  return (
    <View style={styles.card}>
      {/* Header row: verdict pill + title + confidence */}
      <View style={styles.cardHeader}>
        <View style={[styles.verdictPill, { backgroundColor: vc.bg, borderColor: vc.border }]}>
          <Text style={[styles.verdictText, { color: vc.color }]}>{vc.label}</Text>
        </View>
        <Text style={styles.cardTitle}>{answer.title}</Text>
        {answer.confidence > 0 ? (
          <View style={styles.confidenceChip}>
            <Text style={styles.confidenceText}>{answer.confidence}%</Text>
          </View>
        ) : null}
      </View>

      {/* Summary (markdown) */}
      <View style={styles.summarySection}>
        <Markdown style={markdownStyles}>{answer.summary}</Markdown>
      </View>

      {/* Sections */}
      {answer.sections.map((section, idx) => (
        <View key={idx} style={styles.section}>
          <Text style={styles.sectionHeading}>{section.heading.toUpperCase()}</Text>
          {section.points.map((point, pidx) => (
            <View key={pidx} style={styles.pointRow}>
              <Text style={styles.bullet}>•</Text>
              <Markdown style={markdownStyles}>{point}</Markdown>
            </View>
          ))}
        </View>
      ))}

      {/* Risk strip */}
      {answer.risk ? (
        <View style={styles.riskStrip}>
          <Ionicons name="shield-checkmark" size={16} color="#FFB800" />
          <Text style={styles.riskText}>{answer.risk}</Text>
        </View>
      ) : null}

      {/* Action UI */}
      {renderActionUI()}
    </View>
  );
}

// ─── Markdown styles ────────────────────────────────────
const markdownStyles = {
  body: { color: colors.text.primary, fontSize: 14, lineHeight: 20 },
  heading1: { color: colors.text.primary, fontSize: 18, fontWeight: '700' as const, marginVertical: 4 },
  heading2: { color: colors.text.primary, fontSize: 16, fontWeight: '700' as const, marginVertical: 4 },
  heading3: { color: colors.text.primary, fontSize: 15, fontWeight: '600' as const, marginVertical: 4 },
  paragraph: { color: colors.text.primary, fontSize: 14, lineHeight: 20, marginVertical: 2 },
  bullet_list: { marginVertical: 4, marginLeft: 8 },
  list_item: { marginVertical: 2 },
  strong: { fontWeight: '700' as const, color: colors.text.primary },
  em: { fontStyle: 'italic' as const, color: colors.text.secondary },
  code_inline: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, paddingHorizontal: 4, color: '#00FF66', fontSize: 13 },
  code_block: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: 8, marginVertical: 4 },
  blockquote: { borderLeftColor: colors.brand.primary, borderLeftWidth: 3, paddingLeft: 8, marginVertical: 4, opacity: 0.8 },
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.base,
    marginBottom: spacing.sm,
    marginHorizontal: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
    flexWrap: 'wrap',
  },
  verdictPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  verdictText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardTitle: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  confidenceChip: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  confidenceText: {
    color: colors.text.secondary,
    fontSize: 11,
    fontWeight: '700',
  },
  summarySection: {
    marginBottom: spacing.sm,
  },
  section: {
    marginBottom: spacing.sm,
  },
  sectionHeading: {
    color: colors.text.disabled,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  pointRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  bullet: {
    color: colors.brand.primary,
    fontSize: 14,
    marginRight: 4,
    lineHeight: 18,
  },
  riskStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,184,0,0.1)',
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,184,0,0.3)',
  },
  riskText: {
    color: '#FFB800',
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
  actionSection: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
    minHeight: 44,
  },
  actionBtnGreen: {
    backgroundColor: '#00FF66',
  },
  actionBtnRed: {
    backgroundColor: '#FF3344',
  },
  actionBtnGrey: {
    backgroundColor: colors.bg.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  actionBtnPrimary: {
    backgroundColor: colors.brand.primary,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#050505',
  },
  actionCaption: {
    color: colors.text.disabled,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },
  slotTitle: {
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  inputFull: {
    width: '100%',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statChip: {
    flex: 1,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  statChipLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  statChipValue: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  journalList: {
    gap: 6,
    marginBottom: spacing.sm,
  },
  journalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bg.primary,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  journalLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  journalDate: {
    color: colors.text.disabled,
    fontSize: 11,
    fontWeight: '700',
    minWidth: 80,
  },
  journalSymbol: {
    color: colors.text.primary,
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  journalSide: {
    color: colors.text.secondary,
    fontSize: 11,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'right',
  },
  journalPnl: {
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 8,
  },
  logsList: {
    gap: 4,
    marginBottom: spacing.sm,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.bg.primary,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  logTime: {
    color: colors.text.disabled,
    fontSize: 11,
    fontWeight: '700',
    minWidth: 50,
  },
  logMessage: {
    color: colors.text.primary,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  pickerRow: {
    marginBottom: spacing.sm,
  },
  pickerLabel: {
    color: colors.text.disabled,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  pickerOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pickerOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.bg.primary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  pickerOptionActive: {
    backgroundColor: 'rgba(124,92,255,0.2)',
    borderColor: '#7C5CFF',
  },
  pickerOptionText: {
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '600',
  },
  pickerOptionTextActive: {
    color: '#7C5CFF',
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  inputHalf: {
    flex: 1,
  },
  inputLabel: {
    color: colors.text.disabled,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  slotInput: {
    backgroundColor: colors.bg.primary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.bg.primary,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: 2,
    alignSelf: 'flex-start',
  },
  toggleActive: {
    backgroundColor: 'rgba(0,255,102,0.2)',
    borderColor: '#00FF66',
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.text.disabled,
  },
  toggleKnobActive: {
    backgroundColor: '#00FF66',
    alignSelf: 'flex-end',
  },
});
