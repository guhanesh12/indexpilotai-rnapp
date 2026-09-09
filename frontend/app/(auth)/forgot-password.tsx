import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { OtpInput } from 'react-native-otp-entry/dist/OtpInput';

// For backwards compatibility
const OTPInputView = OtpInput;
import { Button, Input, Heading, Body } from '../../src/components/Primitives';
import { colors, spacing, typography, radius } from '../../src/lib/theme';
import { api } from '../../src/lib/api';

type ForgotPasswordStep = 'identity' | 'otp' | 'reset';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  
  // Step management: identity -> otp -> reset
  const [step, setStep] = useState<ForgotPasswordStep>('identity');
  
  // Form values
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Resend timer for OTP
  const [resendTimer, setResendTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Store verified userId for password reset
  const [verifiedUserId, setVerifiedUserId] = useState('');

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

  // ============================================================
  // SCREEN 1: VERIFY IDENTITY
  // ============================================================
  const handleVerifyIdentity = async () => {
    setErr('');
    
    // Validation
    if (!email.trim()) {
      setErr('Please enter your email address');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErr('Please enter a valid email address');
      return;
    }
if (!mobile.trim()) {
      setErr('Please enter your mobile number');
      return;
    }
    // Mobile validation - must be 10 digits starting with 6-9
    if (!/^[6-9]\d{9}$/.test(mobile.trim())) {
      setErr('Please enter a valid 10-digit mobile (starting with 6-9)');
      return;
    }
    
    setLoading(true);
    try {
      // Call: POST /auth/forgot-password with { email, phone } - step 1 sends OTP
      const res: any = await api.forgotPasswordSendOtp(email.trim(), mobile.trim());
      
      if (res?.success) {
        // OTP sent successfully - proceed to OTP + reset step
        setStep('otp');
        setResendTimer(30);
      } else {
        setErr(res?.error || 'Email and mobile do not match our records');
      }
    } catch (e: any) {
      setErr(e.message || 'Email and mobile do not match our records');
    } finally {
      setLoading(false);
    }
  };

// ============================================================
  // SCREEN 2: MOBILE OTP
  // ============================================================
  const sendOtpToMobile = async () => {
    try {
      // Call: POST /auth/forgot-password with { email, phone } - sends OTP
      await api.forgotPasswordSendOtp(email.trim(), mobile.trim());
      setResendTimer(30);
    } catch (e: any) {
      // Don't block flow if OTP fails to send
      console.log('OTP send error:', e.message);
      setResendTimer(30);
    }
  };

const handleVerifyOtp = async () => {
    setErr('');
    
    if (!otp || otp.length !== 6) {
      setErr('Please enter the 6-digit OTP');
      return;
    }
    
setLoading(true);
    try {
      // The OTP will be verified when resetting password
      // For now, we just check if OTP is entered and proceed
      if (!otp || otp.length !== 6) {
        setErr('Please enter the 6-digit OTP');
        setLoading(false);
        return;
      }
      
      // Proceed to reset step
      setStep('reset');
    } catch (e: any) {
      setErr(e.message || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

const handleResendOtp = async () => {
    if (resendTimer > 0) return;
    setErr('');
    setLoading(true);
    try {
      await sendOtpToMobile();
      setOtp('');
    } catch (e: any) {
      setErr(e.message || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

// ============================================================
  // SCREEN 3: SET NEW PASSWORD
  // ============================================================
  // Forgot password reset token (stored when identity is verified)
  const [resetToken, setResetToken] = useState('');

const handleResetPassword = async () => {
    setErr('');
    
    // Validation
    if (!newPassword) {
      setErr('Please enter a new password');
      return;
    }
    if (newPassword.length < 8) {
      setErr('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErr('Passwords do not match');
      return;
    }
    
setLoading(true);
    try {
      // Call: POST /auth/reset-password with { phone, otp, newPassword }
      const res: any = await api.forgotPasswordReset(mobile.trim(), otp.trim(), newPassword);
      
      if (res?.success) {
        Alert.alert(
          'Password Updated',
          'Your password has been reset successfully. Please sign in with your new password.',
          [
            {
              text: 'OK',
              onPress: () => router.replace('/(auth)/login'),
            },
          ]
        );
      } else {
        setErr(res?.error || 'Failed to reset password. Please try again.');
      }
    } catch (e: any) {
      setErr(e.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // RENDER STEPS
  // ============================================================
  const renderStep = () => {
    switch (step) {
      case 'identity':
        return renderIdentityStep();
      case 'otp':
        return renderOtpStep();
      case 'reset':
        return renderResetStep();
    }
  };

  // Step 1: Verify Identity (Email + Mobile)
  const renderIdentityStep = () => (
    <>
      <Heading variant="h3" style={{ marginBottom: spacing.sm }}>
        Reset Your Password
      </Heading>
      <Body style={{ marginBottom: spacing.xl }}>
        Enter your email and mobile number to verify your identity.
      </Body>

      <Input
        label="Email Address"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        value={email}
        onChangeText={(v) => {
          setErr('');
          setEmail(v);
        }}
        placeholder="you@example.com"
      />

      <View style={{ marginTop: spacing.base }}>
        <Input
          label="Mobile Number"
          keyboardType="phone-pad"
          maxLength={10}
          value={mobile}
          onChangeText={(v) => {
            setErr('');
            setMobile(v.replace(/\D/g, ''));
          }}
          placeholder="9876543210"
        />
      </View>

      {err ? (
        <View style={styles.errBox}>
          <Text style={styles.errText}>{err}</Text>
        </View>
      ) : null}

      <Button
        title="Verify & Continue"
        onPress={handleVerifyIdentity}
        loading={loading}
      />
    </>
  );

  // Step 2: Mobile OTP Verification
  const renderOtpStep = () => (
    <>
      <Heading variant="h3" style={{ marginBottom: spacing.sm }}>
        Verify Mobile
      </Heading>
      <Body style={{ marginBottom: spacing.xl }}>
        We've sent a 6-digit verification code to{'\n'}
        <Text style={{ color: colors.text.primary }}>+91 {mobile}</Text>
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
        title="Verify OTP"
        onPress={handleVerifyOtp}
        loading={loading}
      />

      <TouchableOpacity
        onPress={() => {
          setStep('identity');
          setOtp('');
          setErr('');
        }}
        style={styles.backLink}
      >
        <Ionicons name="arrow-back" size={16} color={colors.text.secondary} />
        <Text style={styles.backLinkText}> Back to identity</Text>
      </TouchableOpacity>
    </>
  );

  // Step 3: Set New Password
  const renderResetStep = () => (
    <>
      <Heading variant="h3" style={{ marginBottom: spacing.sm }}>
        Create New Password
      </Heading>
      <Body style={{ marginBottom: spacing.xl }}>
        Enter your new password below. Must be at least 8 characters.
      </Body>

      <Input
        label="New Password"
        secureTextEntry={!showPassword}
        value={newPassword}
        onChangeText={(v) => {
          setErr('');
          setNewPassword(v);
        }}
        placeholder="Min. 8 characters"
      />
      
      <TouchableOpacity
        onPress={() => setShowPassword(!showPassword)}
        style={styles.eyeToggle}
      >
        <Ionicons
          name={showPassword ? 'eye-off-outline' : 'eye-outline'}
          size={20}
          color={colors.text.secondary}
        />
      </TouchableOpacity>

      <View style={{ marginTop: spacing.base }}>
        <Input
          label="Confirm New Password"
          secureTextEntry={!showConfirmPassword}
          value={confirmPassword}
          onChangeText={(v) => {
            setErr('');
            setConfirmPassword(v);
          }}
          placeholder="Re-enter password"
        />
      </View>
      
      <TouchableOpacity
        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
        style={[styles.eyeToggle, { top: 158 }]}
      >
        <Ionicons
          name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
          size={20}
          color={colors.text.secondary}
        />
      </TouchableOpacity>

      {err ? (
        <View style={styles.errBox}>
          <Text style={styles.errText}>{err}</Text>
        </View>
      ) : null}

      <Button
        title="Update Password"
        onPress={handleResetPassword}
        loading={loading}
      />

      <TouchableOpacity
        onPress={() => {
          setStep('otp');
          setNewPassword('');
          setConfirmPassword('');
          setErr('');
        }}
        style={styles.backLink}
      >
        <Ionicons name="arrow-back" size={16} color={colors.text.secondary} />
        <Text style={styles.backLinkText}> Back to OTP</Text>
      </TouchableOpacity>
    </>
  );

  // ============================================================
  // MAIN RENDER
  // ============================================================
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back button */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>

          {/* Progress indicator */}
          <View style={styles.progressRow}>
            <View style={[styles.progressDot, step !== 'identity' && styles.progressDotActive]} />
            <View style={[styles.progressLine, step !== 'identity' && styles.progressLineActive]} />
            <View style={[styles.progressDot, step === 'reset' && styles.progressDotActive]} />
          </View>

          {/* Step content */}
          {renderStep()}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  scroll: {
    padding: spacing.lg,
    paddingTop: spacing.md,
    flexGrow: 1,
  },
  backBtn: {
    marginBottom: spacing.base,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.border.default,
  },
  progressDotActive: {
    backgroundColor: colors.brand.primary,
  },
  progressLine: {
    width: 60,
    height: 2,
    backgroundColor: colors.border.default,
    marginHorizontal: spacing.sm,
  },
  progressLineActive: {
    backgroundColor: colors.brand.primary,
  },
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
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.base,
    paddingVertical: spacing.sm,
  },
  backLinkText: {
    color: colors.text.secondary,
    fontSize: 14,
  },
  eyeToggle: {
    position: 'absolute',
    right: 12,
    top: 42,
    padding: 4,
    zIndex: 10,
  },
  errBox: {
    backgroundColor: 'rgba(255, 51, 68, 0.1)',
    borderWidth: 1,
    borderColor: colors.trading.loss,
    borderRadius: radius.md,
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  errText: {
    color: colors.trading.loss,
    fontSize: 13,
  },
});
