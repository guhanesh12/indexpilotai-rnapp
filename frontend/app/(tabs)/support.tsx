import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ScrollView, TouchableOpacity, Alert, Modal, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Card, Heading, Body, Button, Input, Chip } from '../../src/components/Primitives';
import { colors, spacing, radius, typography } from '../../src/lib/theme';
import { api } from '../../src/lib/api';
import { createSupportTicket, getSupportTickets, markTicketRead, SupportTicket } from '../../src/lib/supportApi';
import { AttachmentPicker, SelectedFile } from '../../src/components/AttachmentPicker';
import { AttachmentViewer } from '../../src/components/AttachmentViewer';

const CATS = ['general', 'billing', 'broker_request', 'technical'];
const PRIORITIES = ['low', 'medium', 'high'];

const statusStyle = (s: string) => {
  const S = (s || '').toLowerCase();
  if (S === 'open' || S === 'pending') return { bg: 'rgba(255,184,0,0.15)', fg: '#FFB800', label: 'PENDING' };
  if (S === 'replied' || S === 'in_progress' || S === 'in-progress')
    return { bg: 'rgba(0,180,255,0.15)', fg: '#00B4FF', label: 'REPLIED' };
  if (S === 'resolved' || S === 'closed') return { bg: 'rgba(0,255,102,0.15)', fg: '#00FF66', label: 'RESOLVED' };
  return { bg: 'rgba(255,255,255,0.06)', fg: colors.text.secondary, label: (s || 'UNKNOWN').toUpperCase() };
};

export default function SupportTab() {
  const insets = useSafeAreaInsets();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState(false);
  const [openTicket, setOpenTicket] = useState<SupportTicket | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await getSupportTickets();
      const list = res?.tickets || [];
      setTickets(Array.isArray(list) ? list : []);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Auto-refresh on focus to keep signed URLs fresh
  useFocusEffect(
    useCallback(() => {
      load();
      const t = setInterval(load, 30000);
      return () => clearInterval(t);
    }, [load])
  );

  const router = useRouter();

  const handleProfilePress = () => {
    router.push('/(tabs)/profile');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Heading variant="h3">Support Tickets</Heading>
          <Text style={{ color: colors.text.secondary, fontSize: 11, marginTop: 2 }}>
            {tickets.length} tickets · auto-refresh
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity testID="profile-button" onPress={handleProfilePress} style={styles.profileBtn}>
            <Ionicons name="person-outline" size={18} color={colors.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity testID="new-ticket-button" onPress={() => setModal(true)} style={styles.newBtn}>
            <Ionicons name="add" size={18} color="#050505" />
            <Text style={{ color: '#050505', fontWeight: '700', fontSize: 13 }}>New</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={tickets}
        keyExtractor={(i, idx) => i.id || i.ticketId || String(idx)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#fff" />}
contentContainerStyle={{ padding: spacing.base, paddingBottom: insets.bottom + 81 }}
        ListEmptyComponent={
          loading ? null : (
            <Card>
              <Body style={{ textAlign: 'center' }}>No tickets yet. Tap "New" to create one.</Body>
            </Card>
          )
        }
renderItem={({ item }) => (
          <TicketRow
            ticket={item}
            onPress={() => {
              setOpenTicket(item);
              // Mark as read when opening a ticket with unread reply
              const tid = item.id || item.ticketId || item.ticket_id;
              if (tid && item.unread) {
                markTicketRead(String(tid)).catch(() => {});
              }
            }}
          />
        )}
      />

      <NewTicketModal visible={modal} onClose={() => setModal(false)} onCreated={() => { setModal(false); load(); }} />
      <TicketDetailModal ticket={openTicket} onClose={() => setOpenTicket(null)} />
    </SafeAreaView>
  );
}

function TicketRow({ ticket, onPress }: { ticket: SupportTicket; onPress: () => void }) {
  const st = statusStyle(ticket.status);
  const tid = ticket.id || ticket.ticketId || ticket.ticket_id || '';
  const shortId = tid ? `#${String(tid).slice(-8).toUpperCase()}` : '';
  const created = ticket.createdAt || ticket.created_at;
  const dateStr = created ? new Date(created).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
  const hasReplies = ticket.adminReply && ticket.adminReply.length > 0;
  const unreadDot = ticket.unread || ticket.hasNewReply;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={[styles.ticketCard, { borderLeftColor: st.fg }]} testID="support-ticket-row">
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, marginRight: spacing.sm }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }} numberOfLines={1}>
            {ticket.subject}
          </Text>
          {shortId ? (
            <Text style={{ color: colors.text.disabled, fontSize: 10, marginTop: 2, fontVariant: ['tabular-nums'] }}>
              {shortId}
            </Text>
          ) : null}
        </View>
        <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
          <Text style={{ color: st.fg, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 }}>{st.label}</Text>
        </View>
      </View>
      <Text style={{ color: colors.text.secondary, fontSize: 12, marginTop: 8, lineHeight: 16 }} numberOfLines={2}>
        {ticket.message}
      </Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' }}>
        <Text style={[styles.metaPill, { backgroundColor: 'rgba(124,92,255,0.15)', color: '#7C5CFF' }]}>
          {ticket.category || 'general'}
        </Text>
        {ticket.priority ? (
          <Text style={[styles.metaPill, { backgroundColor: 'rgba(255,184,0,0.15)', color: '#FFB800' }]}>
            {ticket.priority}
          </Text>
        ) : null}
        <Text style={{ marginLeft: 'auto', color: colors.text.disabled, fontSize: 10 }}>
          {dateStr}
        </Text>
      </View>

<View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="chatbubble-ellipses-outline" size={14} color={hasReplies ? '#00B4FF' : colors.text.disabled} />
          <Text style={{ color: hasReplies ? '#00B4FF' : colors.text.disabled, fontSize: 11, fontWeight: '700' }}>
            {hasReplies ? 'Replied' : 'No replies yet'}
          </Text>
          {unreadDot ? (
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF4DD2', marginLeft: 4 }} />
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(124,92,255,0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}>
          <Ionicons name="eye-outline" size={12} color="#7C5CFF" />
          <Text style={{ color: '#7C5CFF', fontSize: 11, fontWeight: '800' }}>VIEW</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function TicketDetailModal({ ticket, onClose }: { ticket: SupportTicket | null; onClose: () => void }) {
  const visible = !!ticket;
  
  // Mark as read when detail modal opens
  useEffect(() => {
    if (ticket) {
      const tid = ticket.id || ticket.ticketId || ticket.ticket_id;
      if (tid && ticket.unread) {
        markTicketRead(String(tid)).catch(() => {});
      }
    }
  }, [ticket]);

  if (!ticket) {
    return <Modal visible={false} onRequestClose={onClose}><View /></Modal>;
  }
  const st = statusStyle(ticket.status);
  const tid = ticket.id || ticket.ticketId || ticket.ticket_id || '';
  const shortId = tid ? `#${String(tid).slice(-8).toUpperCase()}` : '';
  const created = ticket.createdAt || ticket.created_at;
  const dateStr = created ? new Date(created).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '';
  const repliedAt = ticket.repliedAt;
  const replyDateStr = repliedAt ? new Date(repliedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#050505' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }}>
          <TouchableOpacity onPress={onClose} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }} numberOfLines={1}>{ticket.subject}</Text>
            <Text style={{ color: colors.text.disabled, fontSize: 11, marginTop: 2 }}>{shortId} · {dateStr}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
            <Text style={{ color: st.fg, fontSize: 9, fontWeight: '800' }}>{st.label}</Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
          {/* User original message */}
          <View style={{ backgroundColor: 'rgba(124,92,255,0.10)', padding: 14, borderRadius: 10, borderLeftWidth: 3, borderLeftColor: '#7C5CFF' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Ionicons name="person-circle" size={18} color="#7C5CFF" />
              <Text style={{ color: '#7C5CFF', fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>YOU</Text>
              <Text style={{ marginLeft: 'auto', color: colors.text.disabled, fontSize: 10 }}>{dateStr}</Text>
            </View>
            <Text style={{ color: '#fff', fontSize: 14, lineHeight: 21 }}>{ticket.message}</Text>
            
{/* User attachments */}
            {ticket.attachments && ticket.attachments.length > 0 && (
              <View style={{ marginTop: 12 }}>
                <Text style={{ color: colors.text.secondary, fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>ATTACHMENTS</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <AttachmentViewer attachments={ticket.attachments} />
                </View>
              </View>
            )}
          </View>

          {/* Admin Reply */}
          {ticket.adminReply ? (
            <View style={{ backgroundColor: 'rgba(0,180,255,0.10)', padding: 14, borderRadius: 10, borderLeftWidth: 3, borderLeftColor: '#00B4FF', marginTop: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Ionicons name="headset" size={18} color="#00B4FF" />
                <Text style={{ color: '#00B4FF', fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>SUPPORT TEAM</Text>
                {replyDateStr && <Text style={{ marginLeft: 'auto', color: colors.text.disabled, fontSize: 10 }}>{replyDateStr}</Text>}
              </View>
              <Text style={{ color: '#fff', fontSize: 14, lineHeight: 21 }} selectable>{ticket.adminReply}</Text>
              
              {/* Reply attachments */}
              {ticket.replyAttachments && ticket.replyAttachments.length > 0 && (
                <View style={{ marginTop: 12 }}>
                  <Text style={{ color: colors.text.secondary, fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>ATTACHMENTS</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    <AttachmentViewer attachments={ticket.replyAttachments} />
                  </View>
                </View>
              )}
            </View>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 30, marginTop: 16 }}>
              <Ionicons name="time-outline" size={36} color={colors.text.disabled} />
              <Text style={{ color: colors.text.secondary, fontSize: 13, marginTop: 8, fontWeight: '600' }}>Awaiting Reply</Text>
              <Text style={{ color: colors.text.disabled, fontSize: 11, marginTop: 4, textAlign: 'center' }}>
                Our support team will get back to you within 24 hours.
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function NewTicketModal({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: () => void }) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [cat, setCat] = useState<string>('general');
  const [prio, setPrio] = useState<string>('medium');
  const [loading, setLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);

  const handleFilesChange = (files: SelectedFile[]) => {
    setSelectedFiles(files);
  };

  const submit = async () => {
    if (!subject || !message) return Alert.alert('Missing', 'Enter subject and message');
    setLoading(true);
    try {
      // Map SelectedFile to attachment format
      const attachments = selectedFiles.map(f => ({
        name: f.name,
        type: f.type,
        size: f.size,
        base64: f.base64,
      }));

      await createSupportTicket({
        subject,
        message,
        urgency: prio.toUpperCase() as 'LOW' | 'MEDIUM' | 'HIGH',
        category: cat as 'general' | 'trading' | 'billing' | 'technical',
        attachments: attachments.length > 0 ? attachments : undefined,
      });
      onCreated();
      setSubject('');
      setMessage('');
      setSelectedFiles([]);
    } catch (e: any) {
      Alert.alert('Failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={styles.modalBg}>
        <View style={styles.modalBody}>
          <View style={styles.handle} />
          <Heading variant="h3" style={{ marginBottom: spacing.base }}>New Ticket</Heading>
          <ScrollView>
            <Input label="Subject" value={subject} onChangeText={setSubject} testID="ticket-subject-input" />
            <Input
              label="Message"
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={4}
              style={{ minHeight: 100, textAlignVertical: 'top' }}
              testID="ticket-message-input"
            />
            <Text style={styles.label}>CATEGORY</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm, marginTop: 6 }}>
              {CATS.map((c) => (
                <Chip key={c} label={c} active={cat === c} onPress={() => setCat(c)} />
              ))}
            </View>
<Text style={styles.label}>PRIORITY</Text>
            <View style={{ flexDirection: 'row', marginTop: 6, marginBottom: spacing.base }}>
              {PRIORITIES.map((p) => (
                <Chip key={p} label={p} active={prio === p} onPress={() => setPrio(p)} />
              ))}
            </View>
            
            {/* Attachment Picker */}
            <Text style={styles.label}>ATTACHMENTS (OPTIONAL)</Text>
            <View style={{ marginTop: 6, marginBottom: spacing.base }}>
<AttachmentPicker 
                onFilesChange={handleFilesChange} 
                maxFiles={5}
                maxSizeBytes={10 * 1024 * 1024}
              />
            </View>
            
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button title="Cancel" onPress={onClose} variant="ghost" style={{ flex: 1 }} />
              <Button title="Submit" onPress={submit} loading={loading} style={{ flex: 1 }} testID="submit-ticket-button" />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.base },
  profileBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newBtn: {
    backgroundColor: colors.brand.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ticketCard: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
    padding: spacing.base,
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
  metaPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    fontSize: 10,
    fontWeight: '700',
    overflow: 'hidden',
  },
  label: { color: colors.text.secondary, fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalBody: {
    backgroundColor: colors.bg.secondary,
    padding: spacing.lg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  handle: { width: 48, height: 4, backgroundColor: colors.border.default, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.base },
});
