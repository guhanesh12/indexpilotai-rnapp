import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useAIChat } from '../contexts/AIChatContext';
import { ChatMessage, AiAnswer, AiAction } from '../api/aiChat';
import AIChatAssistantCard from './AIChatAssistantCard';
import { colors, spacing, radius } from '../lib/theme';
import { useRouter } from 'expo-router';

const QUICK_CHIPS = [
  'next signal?',
  'why no trade today',
  'hold or exit my position',
  'slot 1 details',
  'start my trading engine',
  'broker token expiry status',
  'why was my wallet debited',
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function AIChatSheet({ visible, onClose }: Props) {
  const {
    config,
    messages,
    messagesLoading,
    sending,
    sendError,
    actionLoading,
    actionError,
    walletBalance,
    sendMessage,
    executeAction,
    loadConfig,
    loadHistory,
  } = useAIChat();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const [showChips, setShowChips] = useState(true);

  // Animation
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) });
      opacity.value = withTiming(1, { duration: 300 });
    } else {
      translateY.value = withTiming(300, { duration: 250, easing: Easing.in(Easing.cubic) });
      opacity.value = withTiming(0, { duration: 250 });
    }
  }, [visible, translateY, opacity]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0 && !sending) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, sending]);

  // Hide chips when there are messages
  useEffect(() => {
    setShowChips(messages.length === 0);
  }, [messages]);

  // Handle send
  const handleSend = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || sending) return;
    setInputText('');
    await sendMessage(trimmed);
  };

  // Handle quick chip press
  const handleChipPress = (chip: string) => {
    setInputText(chip);
  };

  // Handle action press
  const handleActionPress = async (action: AiAction) => {
    if (action.type === 'connect_broker') {
      onClose();
      router.push('/(tabs)/broker');
      return;
    }
    if (action.type === 'view_journal') {
      onClose();
      router.push('/(tabs)/journal');
      return;
    }
    if (action.type === 'view_logs') {
      onClose();
      router.push('/(tabs)/logs');
      return;
    }
    if (action.type === 'edit_slot') {
      return;
    }
    await executeAction(action);
  };

  // Handle slot update
  const handleUpdateSlot = async (slot: number, fields: any) => {
    const payload: any = { slot };
    if (fields.indexName) payload.indexName = fields.indexName;
    if (fields.moneyness) payload.moneyness = fields.moneyness;
    if (fields.lotCount !== undefined) payload.lotCount = fields.lotCount;
    if (fields.enabled !== undefined) payload.enabled = fields.enabled;
    if (fields.targetPerLot !== undefined) payload.targetPerLot = fields.targetPerLot;
    if (fields.stopLossPerLot !== undefined) payload.stopLossPerLot = fields.stopLossPerLot;
    if (fields.trailingEnabled !== undefined) payload.trailingEnabled = fields.trailingEnabled;
    if (fields.trailingActivationPerLot !== undefined) payload.trailingActivationPerLot = fields.trailingActivationPerLot;
    if (fields.trailingStepPerLot !== undefined) payload.trailingStepPerLot = fields.trailingStepPerLot;

    await executeAction({ type: 'edit_slot', label: 'Save Slot', slot, current: undefined, ...payload });
  };

  // Handle errors
  const handleRetry = () => {
    loadHistory();
  };

  const handleClose = () => {
    onClose();
  };

  // Render error state
  const renderError = () => {
    if (!sendError && !actionError) return null;

    const error = sendError || actionError;
    let title = 'Error';
    let message = error;
    let isBalanceError = false;

    if (error === 'Unauthorized') {
      title = 'Session Expired';
      message = 'Please sign in again';
    } else if (error === 'INSUFFICIENT_BALANCE') {
      title = 'Insufficient Balance';
      message = 'Add funds to your wallet to continue';
      isBalanceError = true;
    } else if (error === 'RATE_LIMIT') {
      title = 'Rate Limited';
      message = 'Too many requests. Please wait a moment and try again.';
    } else if (error === 'AI_ERROR') {
      title = 'Service Error';
      message = 'The AI service encountered an error. Your charge has been auto-refunded.';
    } else if (error === 'AI_DISABLED') {
      title = 'AI Disabled';
      message = 'The AI assistant is currently disabled by admin.';
    } else if (error === 'SERVER_ERROR') {
      title = 'Server Error';
      message = 'Something went wrong on our end. Please try again.';
    }

    return (
      <View style={styles.errorBubble}>
        <View style={styles.errorHeader}>
          <Ionicons name="warning" size={16} color="#FFB800" />
          <Text style={styles.errorTitle}>{title}</Text>
        </View>
        <Text style={styles.errorMessage}>{message}</Text>
        {isBalanceError ? (
          <TouchableOpacity
            style={styles.errorBtn}
            onPress={() => {
              Alert.alert('Add Funds', 'Please add funds to your wallet from the Dashboard.', [{ text: 'OK' }]);
            }}
          >
            <Text style={styles.errorBtnText}>Add Funds</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.errorBtn} onPress={handleRetry}>
            <Ionicons name="reload" size={14} color="#050505" />
            <Text style={styles.errorBtnText}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Render a single message
  const renderMessage = ({ item }: { item: ChatMessage }) => {
    if (item.role === 'user') {
      return (
        <View style={styles.userBubbleContainer}>
          <View style={styles.userBubble}>
            <Text style={styles.userBubbleText}>{item.content}</Text>
            <Text style={styles.userBubbleTime}>
              {item.created_at ? new Date(item.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
            </Text>
          </View>
        </View>
      );
    }

    // Assistant message - render as card
    return (
      <View style={styles.assistantMessageContainer}>
        <View style={styles.assistantAvatar}>
          <Ionicons name="cube" size={18} color="#7C5CFF" />
        </View>
        <View style={styles.assistantMessageContent}>
            {item.answer ? (
              <AIChatAssistantCard
                answer={item.answer}
                onActionPress={handleActionPress}
                actionLoading={actionLoading}
                onUpdateSlot={handleUpdateSlot}
                onConnectBroker={() => {
                  onClose();
                  router.push('/(tabs)/broker');
                }}
                onNavigateToJournal={() => {
                  onClose();
                  router.push('/(tabs)/journal');
                }}
                onNavigateToLogs={() => {
                  onClose();
                  router.push('/(tabs)/logs');
                }}
              />
          ) : (
            <View style={styles.assistantTextCard}>
              <Text style={styles.assistantText}>{item.content}</Text>
            </View>
          )}

          {/* Footer: charged info */}
          {item.charged !== undefined && (
            <View style={styles.messageFooter}>
              <Text style={styles.messageFooterText}>
                {item.charged > 0
                  ? `₹${item.charged.toFixed(2)} debited from wallet`
                  : 'Free — general question'}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  // Render shimmer/loading state
  const renderShimmer = () => {
    if (!sending) return null;
    return (
      <View style={styles.assistantMessageContainer}>
        <View style={styles.assistantAvatar}>
          <Ionicons name="cube" size={18} color="#7C5CFF" />
        </View>
        <View style={styles.shimmerCard}>
          <View style={styles.shimmerLine} />
          <View style={[styles.shimmerLine, { width: '80%' }]} />
          <View style={[styles.shimmerLine, { width: '60%' }]} />
        </View>
      </View>
    );
  };

  // Render quick chips
  const renderQuickChips = () => {
    if (!showChips || messages.length > 0) return null;
    return (
      <View style={styles.chipsContainer}>
        <Text style={styles.chipsTitle}>Quick questions:</Text>
        <View style={styles.chipsGrid}>
          {QUICK_CHIPS.map((chip) => (
            <TouchableOpacity
              key={chip}
              testID={`quick-chip-${chip.replace(/\s+/g, '-')}`}
              style={styles.chip}
              onPress={() => handleChipPress(chip)}
              activeOpacity={0.7}
            >
              <Text style={styles.chipText}>{chip}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  // Render empty state
  const renderEmpty = () => {
    if (messagesLoading) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#7C5CFF" />
          <Text style={styles.emptyStateText}>Loading conversation…</Text>
        </View>
      );
    }
    if (messages.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.botAvatarLarge}>
            <Ionicons name="cube" size={40} color="#7C5CFF" />
          </View>
          <Text style={styles.emptyStateTitle}>IndexPilot AI</Text>
          <Text style={styles.emptyStateSubtitle}>
            Ask me about signals, positions, orders, slots, engine, or wallet.
          </Text>
        </View>
      );
    }
    return null;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <TouchableWithoutFeedback onPress={handleClose}>
          <View style={styles.backdropTouch} />
        </TouchableWithoutFeedback>

        <Animated.View style={[styles.sheet, sheetStyle, { paddingBottom: insets.bottom + 8 }]}>
          <KeyboardAvoidingView
            style={styles.keyboardAvoid}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.botAvatar}>
                  <Ionicons name="cube" size={22} color="#7C5CFF" />
                </View>
                <View>
                  <Text style={styles.headerTitle}>IndexPilot AI</Text>
                  <Text style={styles.headerSubtitle}>
                    Signals · Orders · Positions · Slots · Engine · Wallet
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                testID="ai-chat-close"
                onPress={handleClose}
                style={styles.closeBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={22} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            {/* Strip under header */}
            <View style={styles.strip}>
              <Text style={styles.stripLeft}>
                ₹{config?.pricePerQuery.toFixed(2)} per analysis · general Q free
              </Text>
              <View style={styles.stripRight}>
                <Ionicons name="wallet" size={14} color={colors.text.secondary} />
                <Text style={styles.stripRightText}>
                  ₹{walletBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </Text>
              </View>
            </View>

            {/* Chat transcript */}
            <View style={styles.transcript}>
              <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={renderMessage}
                contentContainerStyle={{ flexGrow: 1, paddingBottom: 12 }}
                ListEmptyComponent={renderEmpty}
                ListFooterComponent={renderShimmer}
                ListHeaderComponent={renderError()}
                showsVerticalScrollIndicator={false}
                onContentSizeChange={() => {
                  if (messages.length > 0 && !sending) {
                    flatListRef.current?.scrollToEnd({ animated: true });
                  }
                }}
              />

              {/* Quick chips overlay */}
              {renderQuickChips()}
            </View>

            {/* Composer */}
            <View style={styles.composerContainer}>
              <View style={styles.composer}>
                <TextInput
                  testID="ai-chat-input"
                  style={styles.input}
                  value={inputText}
                  onChangeText={setInputText}
                  placeholder="Ask about signals, positions, orders…"
                  placeholderTextColor={colors.text.disabled}
                  multiline
                  maxLength={1000}
                  editable={!sending}
                />
                <Text style={styles.charCount}>
                  {inputText.length}/1000
                </Text>
                <TouchableOpacity
                  testID="ai-chat-send"
                  style={[
                    styles.sendBtn,
                    (!inputText.trim() || sending) && styles.sendBtnDisabled,
                  ]}
                  onPress={handleSend}
                  disabled={!inputText.trim() || sending}
                  activeOpacity={0.8}
                >
                  {sending ? (
                    <ActivityIndicator color="#050505" size="small" />
                  ) : (
                    <Ionicons name="send" size={20} color="#050505" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  backdropTouch: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.bg.primary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    height: '90%',
    overflow: 'hidden',
  },
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  botAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(124,92,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(124,92,255,0.3)',
  },
  headerTitle: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: colors.text.secondary,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bg.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  strip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
    backgroundColor: colors.bg.secondary,
  },
  stripLeft: {
    color: colors.text.secondary,
    fontSize: 11,
    fontWeight: '700',
  },
  stripRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stripRightText: {
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  transcript: {
    flex: 1,
    paddingHorizontal: spacing.sm,
  },
  composerContainer: {
    paddingHorizontal: spacing.base,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    backgroundColor: colors.bg.secondary,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: colors.text.primary,
    fontSize: 15,
    lineHeight: 20,
    maxHeight: 120,
  },
  charCount: {
    color: colors.text.disabled,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7C5CFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  // Message bubbles
  userBubbleContainer: {
    alignItems: 'flex-end',
    marginBottom: spacing.sm,
    paddingRight: 4,
  },
  userBubble: {
    backgroundColor: '#7C5CFF',
    borderRadius: 18,
    borderBottomRightRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth: '80%',
  },
  userBubbleText: {
    color: '#050505',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
  userBubbleTime: {
    color: 'rgba(5,5,5,0.6)',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'right',
    marginTop: 4,
  },
  assistantMessageContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.sm,
    paddingLeft: 4,
  },
  assistantAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(124,92,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(124,92,255,0.3)',
    marginTop: 4,
  },
  assistantMessageContent: {
    flex: 1,
  },
  assistantTextCard: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.base,
  },
  assistantText: {
    color: colors.text.primary,
    fontSize: 14,
    lineHeight: 20,
  },
  messageFooter: {
    marginTop: 6,
    paddingHorizontal: 4,
  },
  messageFooterText: {
    color: colors.text.disabled,
    fontSize: 10,
    fontWeight: '700',
  },
  // Shimmer
  shimmerCard: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.base,
    flex: 1,
  },
  shimmerLine: {
    height: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
    marginBottom: 6,
  },
  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.base,
  },
  botAvatarLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(124,92,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(124,92,255,0.3)',
    marginBottom: spacing.base,
  },
  emptyStateTitle: {
    color: colors.text.primary,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptyStateSubtitle: {
    color: colors.text.secondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyStateText: {
    color: colors.text.secondary,
    fontSize: 13,
    marginTop: spacing.base,
  },
  // Quick chips
  chipsContainer: {
    paddingHorizontal: spacing.base,
    paddingBottom: 12,
  },
  chipsTitle: {
    color: colors.text.secondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
  },
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    backgroundColor: colors.bg.secondary,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  chipText: {
    color: colors.text.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  // Error bubble
  errorBubble: {
    backgroundColor: 'rgba(255,51,68,0.1)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,51,68,0.3)',
    padding: spacing.base,
    marginHorizontal: 4,
    marginBottom: spacing.sm,
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  errorTitle: {
    color: '#FFB800',
    fontSize: 13,
    fontWeight: '800',
  },
  errorMessage: {
    color: colors.text.secondary,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
  },
  errorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFB800',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  errorBtnText: {
    color: '#050505',
    fontSize: 12,
    fontWeight: '800',
  },
});
