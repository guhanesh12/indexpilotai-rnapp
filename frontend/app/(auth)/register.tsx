import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { OtpInput } from 'react-native-otp-entry/dist/OtpInput';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp, FadeIn } from 'react-native-reanimated';

// For backwards compatibility
const OTPInputView = OtpInput;
import * as Clipboard from 'expo-clipboard';
import { Button, Input, Heading, Body } from '../../src/components/Primitives';
import { colors, spacing, typography, radius } from '../../src/lib/theme';
import { RegisterIcon } from '../../src/components/icons/AppIcons';
import { api } from '../../src/lib/api';
import { useAuth } from '../../src/contexts/AuthContext';
import {
  loadPendingReferralCode,
  savePendingReferralCode,
  clearPendingReferralCode,
} from '../../src/broker/BrokerContext';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh',
  'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra',
  'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha',
  'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Jammu and Kashmir', 'Ladakh', 'Puducherry', 'Chandigarh',
];

// Registration flow: Form first, then Email Verify inline, then Mobile OTP
type RegistrationStep = 'form' | 'emailVerify' | 'mobile';

const { width } = Dimensions.get('window');

export default function RegisterScreen() {
  const router = useRouter();
  const routeParams = useLocalSearchParams();
  const { signIn } = useAuth();

  // Prefill referral code from deep link / pending AsyncStorage on first mount
  const [referralCode, setReferralCode] = useState('');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fromRoute = String((routeParams as any)?.ref || "").toUpperCase();
      const fromStorage = await loadPendingReferralCode();
      const code = (fromRoute || (fromStorage || "")).toUpperCase();
      if (!cancelled && code) {
        setReferralCode(code);
        if (fromStorage) {
          await savePendingReferralCode(fromStorage);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [routeParams]);

  // Clear the pending code once we successfully register.
  // (We'll do that inside verifyOtp after the success branch.)
  
  // Step tracking - start with form
  const [step, setStep] = useState<RegistrationStep>('form');
  
  // Email verification state
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtp, setEmailOtp] = useState('');
  
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    mobile: '',
    state: '',
    city: '',
    password: '',
  });
  const [agree, setAgree] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [stateOpen, setStateOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [otp, setOtp] = useState('');
  
  // Resend timer for mobile OTP
  const [resendTimer, setResendTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (resendTimer > 0) {
      timerRef.current = setTimeout(() => {
        setResendTimer(resendTimer - 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resendTimer]);

  // Check if referral code is applied (cosmetic badge)
  const referralApplied = referralCode.length >= 4;

  const update = (k: string) => (v: string) => {
    setErr('');
    setForm((s) => ({ ...s, [k]: v }));
  };

const validateForm = () => {
    // Debug: log form state for troubleshooting
    console.log('[validateForm] form:', JSON.stringify(form), 'emailVerified:', emailVerified, 'agree:', agree);
    
    // More lenient validation - check length first
    if (!form.fullName || form.fullName.trim().length < 1) {
      console.log('[validateForm] fullName missing, value:', form.fullName);
      return 'Please enter your full name';
    }
    if (!form.email || form.email.trim().length < 3) {
      console.log('[validateForm] email missing, value:', form.email);
      return 'Please enter your email';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      console.log('[validateForm] email invalid, value:', form.email);
      return 'Enter a valid email';
    }
    if (!emailVerified) {
      console.log('[validateForm] email not verified');
      return 'Please verify your email first';
    }
    // Mobile validation - must be only 10 digits, no +91
    if (!form.mobile || form.mobile.length < 10) {
      console.log('[validateForm] mobile missing, value:', form.mobile);
      return 'Enter a 10-digit mobile number';
    }
    // Validate mobile format /^[6-9]\d{9}$/
    if (!/^[6-9]\d{9}$/.test(form.mobile)) {
      console.log('[validateForm] mobile invalid, value:', form.mobile);
      return 'Enter a valid 10-digit mobile (starting with 6-9)';
    }
    if (!form.state) {
      console.log('[validateForm] state missing');
      return 'Please select your state';
    }
    if (!form.city || form.city.trim().length < 1) {
      console.log('[validateForm] city missing, value:', form.city);
      return 'Please enter your city';
    }
    if (!form.password || form.password.length < 8) {
      console.log('[validateForm] password missing or too short, length:', form.password?.length);
      return 'Password must be at least 8 characters';
    }
    if (!agree) {
      console.log('[validateForm] agree not checked');
      return 'Please agree to the Terms & Privacy Policy';
    }
    console.log('[validateForm] validation passed');
    return '';
  };

  // ─────────────────────────────────────────────────
  // STEP 1: Send Email OTP
  // ─────────────────────────────────────────────────
  const sendEmailOtp = async () => {
    if (!form.email.trim()) {
      setErr('Please enter your email first');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setErr('Please enter a valid email');
      return;
    }
    
    setLoading(true);
    setErr('');
    try {
      // Check if email exists
      try {
        const check: any = await api.checkEmail(form.email.trim());
        if (check?.exists) {
          setErr('An account with this email already exists. Please sign in.');
          setLoading(false);
          return;
        }
      } catch {
        /* if endpoint fails, continue — server will catch duplicates later */
      }
      
// Send email OTP with name
      await api.emailOtpSend(form.email.trim(), form.fullName.trim());
      setEmailOtpSent(true);
    } catch (e: any) {
      setErr(e.message || 'Failed to send email verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────
  // STEP 2: Verify Email OTP
  // ─────────────────────────────────────────────────
const verifyEmailOtp = async () => {
    if (!emailOtp || emailOtp.length !== 6) {
      setErr('Please enter the 6-digit verification code');
      return;
    }
    
    setLoading(true);
    setErr('');
    try {
      const res: any = await api.emailOtpVerify(form.email.trim(), emailOtp);
      if (res?.verified || res?.success) {
        setEmailVerified(true);
        setEmailOtpSent(false);
        setEmailOtp('');
        // Stay on form - email is now verified
        setStep('form');
      } else {
        setErr('Invalid verification code. Please try again.');
      }
    } catch (e: any) {
      setErr(e.message || 'Invalid verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

// ──────────────���─���────────────────────────────────
  // STEP 3: Send Mobile OTP (after form submission)
  // ─────────────────────────────────────────────────
  const submit = async () => {
    console.log('[submit] Starting submit, form state:', JSON.stringify(form));
    const v = validateForm();
    if (v) {
      console.log('[submit] Validation failed:', v);
      setErr(v);
      return;
    }
console.log('[submit] Validation passed, sending OTP to:', form.mobile);
    setLoading(true);
    setErr('');
    try {
      // Send mobile OTP with email and name
      const otpResult: any = await api.sendOtp(form.mobile, form.email.trim(), form.fullName.trim());
      console.log('[submit] OTP sent result:', JSON.stringify(otpResult));
      
      // Move to mobile OTP step
      setStep('mobile');
      setResendTimer(60);
      console.log('[submit] Step changed to mobile');
    } catch (e: any) {
      console.log('[submit] ERROR sending OTP:', e.message);
      setErr(e.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

// ─────────────────────────────────────────────────
  // STEP 4: Verify Mobile OTP and create account
  // ─────────────────────────────────────────────────
  const verifyOtp = async () => {
    console.log('[verifyOtp] Starting with OTP:', otp, 'mobile:', form.mobile);
    if (!otp || otp.length !== 6) {
      setErr('Please enter the 6-digit OTP');
      return;
    }
    setLoading(true);
    setErr('');
    try {
// Step A: Verify mobile OTP
      console.log('[verifyOtp] Verifying OTP for:', form.mobile);
      const otpRes: any = await api.verifyOtp(form.mobile, otp);
      console.log('[verifyOtp] OTP verify result:', JSON.stringify(otpRes));
      
      if (!otpRes?.success) {
        console.log('[verifyOtp] Invalid OTP');
        setErr(otpRes?.error || 'Invalid OTP. Please try again.');
        setLoading(false);
        setOtp(''); // Clear the OTP on invalid
        return;
      }
      
console.log('[verifyOtp] OTP verified, registering user...');
      // Step B: Register with both email and mobile verified
      const res: any = await api.registerDirect({
        email: form.email.trim(),
        password: form.password,
        name: form.fullName.trim(),
        phone: form.mobile,
        referredBy: referralCode || undefined,
      });
      console.log('[verifyOtp] Registration result:', JSON.stringify(res));
      
// Allow both session OR userId for successful registration
      if (res?.session?.access_token || res?.userId || res?.success) {
        console.log('[verifyOtp] Registration success, logging in...');
        
        // Try to get token - handle both session and direct response formats
        const accessToken = res?.session?.access_token || res?.access_token;
        const refreshToken = res?.session?.refresh_token || res?.refresh_token || accessToken;
        
        if (accessToken) {
          // Auto-login after successful registration with session
          // AuthContext's RootNavigation will handle navigation to create-pin
          await signIn(
            { email: form.email.trim(), name: form.fullName },
            accessToken,
            refreshToken
          );
          // Consume the pending referral code so it doesn't reapply next time.
          await clearPendingReferralCode();
          // RootNavigation will automatically redirect to /create-pin based on pinState
        } else {
          // No session but registration succeeded - navigate to login
          console.log('[verifyOtp] Registered but no session, redirecting to login');
          router.replace('/(auth)/login');
        }
      } else {
        console.log('[verifyOtp] Registration failed - no session, res:', JSON.stringify(res));
        setErr('Registration failed. Please try again.');
      }
    } catch (e: any) {
      console.log('[verifyOtp] ERROR:', e.message);
      setErr(e.message || 'Invalid OTP or registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

// Resend Email OTP
  const handleResendOtp = async () => {
    setErr('');
    setLoading(true);
    try {
      await api.emailOtpSend(form.email.trim(), form.fullName.trim());
    } catch (e: any) {
      setErr(e.message || 'Failed to resend email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

// Resend Mobile OTP (for mobile verification step)
  const handleResendMobileOtp = async () => {
    if (resendTimer > 0) return;
    setErr('');
    setLoading(true);
    try {
      await api.sendOtp(form.mobile, form.email.trim(), form.fullName.trim());
      setResendTimer(60);
      setOtp('');
    } catch (e: any) {
      setErr(e.message || 'Failed to resend OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <LinearGradient
        colors={[colors.bg.primary, '#1a1a2e', colors.bg.primary]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <Animated.View 
        style={styles.decorativeCircle} 
        entering={FadeIn.duration(1000)}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
{step === 'emailVerify' ? (
            <>
              {/* Email OTP Verification Step */}
              <TouchableOpacity onPress={() => { setStep('form'); setOtp(''); setErr(''); }} style={styles.back}>
                <Text style={{ color: colors.text.secondary, fontSize: 14 }}>← Back</Text>
              </TouchableOpacity>
              
              <Heading variant="h3" style={{ marginBottom: spacing.sm }}>
                Verify Your Email
              </Heading>
              <Body style={{ marginBottom: spacing.xl }}>
                We've sent a 6-digit verification code to{'\n'}
                <Text style={{ color: colors.text.primary }}>{form.email}</Text>
              </Body>
              
<View style={styles.otpContainer}>
                <OTPInputView
                  numberOfDigits={6}
                  onTextChange={(code: string) => {
                    setErr('');
setOtp(code);
                  }}
                  autoFocus
                  // @ts-ignore - library types incomplete
                  theme={{
                    // @ts-ignore
                    containerStyle: styles.otpInput,
                    placeholderTextStyle: { color: colors.text.disabled },
                    // @ts-ignore
                    pinCodeTextStyle: { color: colors.text.primary },
                  }}
                />
              </View>

              <TouchableOpacity
                onPress={handleResendOtp}
                disabled={resendTimer > 0 || loading}
                style={styles.resendBtn}
              >
                <Text style={styles.resendText}>
                  {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Didn't receive? Resend OTP"}
                </Text>
              </TouchableOpacity>
              
              {err ? (
                <View style={styles.errBox}>
                  <Text style={styles.errText}>{err}</Text>
                </View>
              ) : null}
              
              <Button
                title="Verify & Create Account"
                onPress={verifyOtp}
                loading={loading}
              />
              
              <TouchableOpacity
                onPress={() => { setStep('form'); setOtp(''); setErr(''); }}
                style={styles.editBtn}
              >
<Ionicons name="arrow-back" size={16} color={colors.text.secondary} />
                <Text style={styles.editText}> Edit Details</Text>
              </TouchableOpacity>
            </>
          ) : step === 'mobile' ? (
            <>
              <TouchableOpacity onPress={() => { setStep('form'); setOtp(''); setErr(''); }} style={styles.back}>
                <Text style={{ color: colors.text.secondary, fontSize: 14 }}>← Back</Text>
              </TouchableOpacity>
              
              <Heading variant="h3" style={{ marginBottom: spacing.sm }}>
                Verify Your Mobile
              </Heading>
              <Body style={{ marginBottom: spacing.xl }}>
                We've sent a 6-digit OTP to{'\n'}
                <Text style={{ color: colors.text.primary }}>+91 {form.mobile}</Text>
              </Body>
              
<View style={styles.otpContainer}>
                <OTPInputView
                  numberOfDigits={6}
onTextChange={(code: string) => {
                    setErr('');
                    setOtp(code);
                  }}
                  autoFocus
                  // @ts-ignore - library types incomplete
                  theme={{
                    // @ts-ignore
                    containerStyle: styles.otpInput,
                    placeholderTextStyle: { color: colors.text.disabled },
                    // @ts-ignore
                    pinCodeTextStyle: { color: colors.text.primary },
                  }}
                />
              </View>

              <TouchableOpacity
                onPress={handleResendMobileOtp}
                disabled={resendTimer > 0 || loading}
                style={styles.resendBtn}
              >
                <Text style={styles.resendText}>
                  {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Didn't receive? Resend OTP"}
                </Text>
              </TouchableOpacity>
              
              {err ? (
                <View style={styles.errBox}>
                  <Text style={styles.errText}>{err}</Text>
                </View>
              ) : null}
              
              <Button
                title="Complete Registration"
                onPress={verifyOtp}
                loading={loading}
              />
            </>
) : (
            <>
              <TouchableOpacity onPress={() => router.back()} style={styles.back}>
                <Text style={{ color: colors.text.secondary, fontSize: 14 }}>← Back</Text>
              </TouchableOpacity>

          <Animated.View entering={FadeInDown.delay(100).springify()}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: spacing.sm }}>
              <RegisterIcon size={28} color="#8B5CF6" focused />
              <Heading variant="h1" style={{ marginBottom: 0, fontSize: 40, lineHeight: 48 }}>
                Create Your{'\n'}
                <Text style={{ color: colors.trading.profit }}>Account</Text>
              </Heading>
            </View>
            <Body style={{ marginBottom: spacing.xl, color: colors.text.secondary }}>
              Join IndexPilot AI and start your trading journey.
            </Body>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).springify()}>
            <FieldLabel icon="person-outline" text="Full Name" />
            <Input
              testID="register-name-input"
              value={form.fullName}
              onChangeText={update('fullName')}
              placeholder="Enter your full name"
            />
          </Animated.View>

<FieldLabel icon="mail-outline" text="Email Address" />
          <View style={styles.emailRow}>
            <View style={{ flex: 1 }}>
              <Input
                testID="register-email-input"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={form.email}
                onChangeText={update('email')}
                placeholder="your.email@example.com"
              />
            </View>
{!emailVerified && (
              <TouchableOpacity
                testID="verify-email-btn"
                onPress={sendEmailOtp}
                disabled={loading || !form.email.trim()}
                style={styles.verifyBtn}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={[styles.verifyBtnText, emailOtpSent && styles.verifyBtnSent]}>
                    {emailOtpSent ? 'Sent' : emailVerified ? '✓' : 'Verify'}
                  </Text>
                )}
              </TouchableOpacity>
            )}
            {emailVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={20} color={colors.trading.profit} />
              </View>
            )}
          </View>
          
          {/* Inline OTP for email verification */}
          {emailOtpSent && !emailVerified && (
<View style={styles.inlineOtp}>
              <OTPInputView
                numberOfDigits={6}
                onTextChange={(code: string) => {
                  setErr('');
                  setEmailOtp(code);
                }}
                autoFocus
                // @ts-ignore - library types incomplete
                theme={{
                  // @ts-ignore
                  containerStyle: styles.inlineOtpInput,
                  placeholderTextStyle: { color: colors.text.disabled },
                    // @ts-ignore
                    pinCodeTextStyle: { color: colors.text.primary },
                }}
              />
              <Button
                title="Verify Email"
                onPress={verifyEmailOtp}
                loading={loading}
                style={{ marginTop: spacing.sm }}
              />
            </View>
          )}

          <FieldLabel icon="call-outline" text="Mobile Number" />
          <View style={styles.phoneRow}>
            <View style={styles.prefix}>
              <Text style={styles.prefixText}>+91</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Input
                testID="register-mobile-input"
                keyboardType="number-pad"
                maxLength={10}
                value={form.mobile}
                onChangeText={(v) => update('mobile')(v.replace(/\D/g, ''))}
                placeholder="9876543210"
              />
            </View>
          </View>

          <View style={styles.row2}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <FieldLabel icon="business-outline" text="State" />
              <TouchableOpacity
                testID="register-state-select"
                onPress={() => setStateOpen(true)}
                style={styles.selectBox}
              >
                <Text style={{ color: form.state ? colors.text.primary : colors.text.disabled, fontSize: 15 }}>
                  {form.state || 'Select'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <FieldLabel icon="location-outline" text="City" />
              <Input
                testID="register-city-input"
                value={form.city}
                onChangeText={update('city')}
                placeholder="Your city"
              />
            </View>
          </View>

<FieldLabel icon="lock-closed-outline" text="Password" />
          <View style={{ position: 'relative' }}>
            <Input
              testID="register-password-input"
              secureTextEntry={!showPwd}
              value={form.password}
              onChangeText={update('password')}
              placeholder="Min. 8 characters"
              style={{ paddingRight: 44 }}
            />
            <TouchableOpacity
              onPress={() => setShowPwd((s) => !s)}
              style={styles.eyeBtn}
            >
              <Ionicons
                name={showPwd ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={colors.text.secondary}
              />
            </TouchableOpacity>
          </View>

          {/* Referral Code Field */}
          <FieldLabel icon="gift-outline" text="Referral Code (Optional)" />
          <View style={{ position: 'relative' }}>
            <Input
              testID="register-referral-input"
              autoCapitalize="characters"
              maxLength={12}
              value={referralCode}
              onChangeText={(v) => setReferralCode(v.toUpperCase())}
              placeholder="Enter referral code"
              style={{ paddingRight: referralApplied ? 80 : 20 }}
            />
            {referralApplied && (
              <View style={styles.referralBadge}>
                <Ionicons name="checkmark-circle" size={16} color={colors.trading.profit} />
                <Text style={styles.referralBadgeText}>Applied</Text>
              </View>
            )}
          </View>
          {referralCode.length > 0 && referralCode.length < 4 && (
            <Text style={styles.referralHelper}>Got a referral code? Enter it to get bonus.</Text>
          )}

          <TouchableOpacity
            testID="register-agree-checkbox"
            onPress={() => setAgree((a) => !a)}
            style={styles.tcRow}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, agree && styles.checkboxOn]}>
              {agree ? <Ionicons name="checkmark" size={14} color="#050505" /> : null}
            </View>
            <Text style={styles.tcText}>
              I agree to the{' '}
              <Text style={{ color: colors.trading.profit, fontWeight: '600' }}>Terms & Conditions</Text>
              {' '}and{' '}
              <Text style={{ color: colors.trading.profit, fontWeight: '600' }}>Privacy Policy</Text>
            </Text>
          </TouchableOpacity>

          {err ? (
            <View style={styles.errBox}>
              <Text style={styles.errText}>{err}</Text>
            </View>
          ) : null}

          <Button
            testID="register-submit-button"
            title="Continue to OTP Verification"
            onPress={submit}
            loading={loading}
            style={{ marginTop: spacing.base }}
          />

          <TouchableOpacity
            onPress={() => router.replace('/(auth)/login')}
            style={{ marginTop: spacing.lg, alignItems: 'center' }}
          >
            <Text style={{ color: colors.text.secondary }}>
              Already have an account?{' '}
              <Text style={{ color: colors.text.primary, fontWeight: '700' }}>Sign in</Text>
            </Text>
          </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <StateModal
        visible={stateOpen}
        onClose={() => setStateOpen(false)}
        onPick={(s) => {
          update('state')(s);
          setStateOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

function FieldLabel({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={fl.row}>
      <Ionicons name={icon} size={14} color={colors.text.secondary} />
      <Text style={fl.text}>{text}</Text>
    </View>
  );
}

function StateModal({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (s: string) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={sm.bg}>
        <View style={sm.body}>
          <View style={sm.handle} />
          <View style={sm.header}>
            <Text style={{ color: colors.text.primary, fontSize: 18, fontWeight: '700' }}>
              Select State
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={INDIAN_STATES}
            keyExtractor={(i) => i}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => onPick(item)} style={sm.item}>
                <Text style={{ color: colors.text.primary, fontSize: 15 }}>{item}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const fl = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  text: { color: colors.text.secondary, fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
});

const sm = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  body: {
    backgroundColor: colors.bg.secondary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  handle: {
    width: 48,
    height: 4,
    backgroundColor: colors.border.default,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: spacing.base,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 8,
  },
  item: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  decorativeCircle: {
    position: 'absolute',
    top: -width * 0.4,
    right: -width * 0.2,
    width: width,
    height: width,
    borderRadius: width / 2,
    backgroundColor: 'rgba(57, 255, 20, 0.05)',
  },
  scroll: { padding: spacing.lg, flexGrow: 1 },
  back: { marginBottom: spacing.lg },
  phoneRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  prefix: {
    height: 50,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: 4,
    backgroundColor: colors.bg.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefixText: { color: colors.text.primary, fontWeight: '700', fontSize: 15 },
  row2: { flexDirection: 'row' },
  selectBox: {
    backgroundColor: colors.bg.primary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: 4,
    paddingHorizontal: 14,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.base,
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    top: 14,
    padding: 4,
  },
  tcRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.sm,
    marginBottom: spacing.base,
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.border.focus,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxOn: {
    backgroundColor: colors.trading.profit,
    borderColor: colors.trading.profit,
  },
  tcText: { color: colors.text.secondary, fontSize: 13, flex: 1, lineHeight: 18 },
errBox: {
    backgroundColor: 'rgba(255, 51, 68, 0.1)',
    borderWidth: 1,
    borderColor: colors.trading.loss,
    borderRadius: 4,
    padding: 12,
    marginTop: spacing.sm,
  },
  errText: { color: colors.trading.loss, fontSize: 13 },
  referralBadge: {
    position: 'absolute',
    right: 12,
    top: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  referralBadgeText: {
    color: colors.trading.profit,
    fontSize: 12,
    fontWeight: '600',
  },
referralHelper: {
    color: colors.text.disabled,
    fontSize: 12,
    marginTop: -4,
    marginBottom: spacing.base,
  },
  // Email verification inline styles
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
verifyBtn: {
    backgroundColor: colors.brand.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 4,
    minWidth: 70,
    alignItems: 'center',
  },
  verifyBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 13,
  },
  verifyBtnSent: {
    backgroundColor: colors.text.disabled,
  },
  verifiedBadge: {
    paddingLeft: 8,
  },
  inlineOtp: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  inlineOtpInput: {
    width: '100%',
    height: 60,
  },
  // OTP step styles
  otpContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  otpInput: {
    width: '100%',
    height: 80,
  },
  resendBtn: {
    alignItems: 'center',
    marginBottom: spacing.base,
    paddingVertical: spacing.sm,
  },
  resendText: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.base,
    paddingVertical: spacing.sm,
  },
  editText: {
    color: colors.text.secondary,
    fontSize: 14,
  },
});
