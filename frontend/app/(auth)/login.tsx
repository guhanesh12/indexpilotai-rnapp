import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp, FadeIn } from 'react-native-reanimated';
import { Button, Input, Heading, Body } from '../../src/components/Primitives';
import { colors, spacing, typography, radius } from '../../src/lib/theme';
import { LoginIcon } from '../../src/components/icons/AppIcons';
import { api } from '../../src/lib/api';
import { useAuth } from '../../src/contexts/AuthContext';

const { width } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const { signInWithFlag, pinState } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [showPassword, setShowPassword] = useState(false);

const submit = async () => {
    setErr('');
    if (!email.trim() || !password) {
      setErr('Please enter email and password');
      return;
    }
    setLoading(true);
    try {
      // Debug: Log the login attempt
      console.log('[Login] Attempting login for:', email.trim());
      
      const res: any = await api.loginWithPassword(email.trim(), password);
      console.log('[Login] Response:', JSON.stringify(res));
      
      // Validate response structure
      if (!res || typeof res !== 'object') {
        console.log('[Login] Invalid response type:', typeof res);
        setErr('Invalid response from server');
        setLoading(false);
        return;
      }
      
      if (res?.access_token) {
        // Ensure we have valid tokens
        const accessToken = res.access_token;
        const refreshToken = res.refresh_token || res.access_token;
        
        // Create user object from response
        const user = res.user || { email: email.trim(), id: res.userId };
        
        console.log('[Login] Login successful, calling signInWithFlag...');
        await signInWithFlag(user, accessToken, refreshToken);
        console.log('[Login] signInWithFlag complete');
        
        // Navigation will be handled by RootNavigation in _layout.tsx
        // It detects the signIn state change and routes accordingly
      } else {
        // Check for error message in response
        const errorMsg = res?.error || res?.message || res?.error_description || 'Invalid email or password';
        console.log('[Login] No access_token, error:', errorMsg);
        setErr(errorMsg);
      }
    } catch (e: any) {
      console.log('[Login] Exception:', e.message, e.stack);
      setErr(e.message || 'Invalid email or password');
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
          
           <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.brand}>
             <LoginIcon size={28} color="#EC4899" focused />
             <View style={styles.logoDot} />
             <Text style={styles.brandText}>INDEXPILOT AI</Text>
           </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).springify()}>
            <Heading variant="h1" style={styles.heading}>
              Welcome{'\n'}
              <Text style={{ color: colors.trading.profit }}>back.</Text>
            </Heading>
            <Body style={{ marginBottom: spacing.xl, color: colors.text.secondary }}>
              Sign in to continue your trading journey.
            </Body>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(300).springify()}>
            <Input
              testID="auth-email-input"
              label="Email"
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
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(400).springify()} style={{ marginBottom: spacing.base }}>
            <Text style={[typography.caption as any, { color: colors.text.secondary, marginBottom: spacing.sm }]}>
              Password
            </Text>
            <View style={styles.passwordContainer}>
              <TextInput
                testID="auth-password-input"
                style={styles.passwordInput}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={(v) => {
                  setErr('');
                  setPassword(v);
                }}
                placeholder="••••••••"
                placeholderTextColor={colors.text.disabled}
              />
              <TouchableOpacity
                testID="auth-password-toggle"
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                <Feather 
                  name={showPassword ? 'eye' : 'eye-off'} 
                  size={20} 
                  color={colors.text.secondary} 
                />
              </TouchableOpacity>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(500).springify()}>
            <TouchableOpacity
              testID="auth-forgot-password"
              onPress={() => router.push({ pathname: '/(auth)/forgot-password' } as any)}
              style={styles.forgotWrap}
            >
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            {err ? (
              <Animated.View entering={FadeInUp.duration(300)} style={styles.errBox}>
                <Feather name="alert-circle" size={16} color={colors.trading.loss} style={{ marginRight: 8 }} />
                <Text style={styles.errText}>{err}</Text>
              </Animated.View>
            ) : null}

            <Button
              testID="auth-submit-button"
              title="Sign In"
              onPress={submit}
              loading={loading}
              style={styles.loginButton}
            />

            <TouchableOpacity
              testID="auth-navigate-register"
              onPress={() => router.push('/(auth)/register')}
              style={styles.linkWrap}
            >
              <Text style={styles.link}>
                New here?{' '}
                <Text style={{ color: colors.trading.profit, fontWeight: '700' }}>Create account</Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  decorativeCircle: {
    position: 'absolute',
    top: -width * 0.4,
    right: -width * 0.2,
    width: width,
    height: width,
    borderRadius: width / 2,
    backgroundColor: 'rgba(57, 255, 20, 0.05)', // Subtle neon green hint
  },
  scroll: { padding: spacing.lg, paddingTop: spacing.xl, flexGrow: 1, justifyContent: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.huge, gap: 10 },
  logoDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.trading.profit, shadowColor: colors.trading.profit, shadowOpacity: 0.8, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  brandText: { ...(typography.caption as any), color: colors.text.primary, fontWeight: '800', letterSpacing: 2 },
  heading: { marginBottom: spacing.sm, fontSize: 40, lineHeight: 48 },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: spacing.base,
    paddingVertical: 16,
    color: colors.text.primary,
    fontSize: 16,
  },
  eyeButton: {
    paddingHorizontal: spacing.base,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  forgotWrap: { alignItems: 'flex-end', marginBottom: spacing.xl },
  forgotText: { color: colors.text.secondary, fontSize: 14, fontWeight: '600' },
  linkWrap: { marginTop: spacing.xl, alignItems: 'center', paddingVertical: spacing.sm },
  link: { color: colors.text.secondary, fontSize: 15 },
  errBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 51, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 51, 68, 0.3)',
    borderRadius: radius.sm,
    padding: 14,
    marginBottom: spacing.base,
  },
  errText: { color: colors.trading.loss, fontSize: 14, flex: 1 },
  loginButton: {
    paddingVertical: 16,
    borderRadius: radius.md,
    shadowColor: colors.trading.profit,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  }
});
