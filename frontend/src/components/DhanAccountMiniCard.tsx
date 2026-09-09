import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { Card } from './Primitives';
import { colors, radius, spacing } from '../lib/theme';

const DHAN_REFERRAL_URL = 'https://login.dhan.co/?location=DH_WEB&refer=SMIL56887';

export default function DhanAccountMiniCard() {
  const [openingAccount, setOpeningAccount] = useState(false);

  const openDhanAccount = async () => {
    setOpeningAccount(true);
    try {
      await WebBrowser.openBrowserAsync(DHAN_REFERRAL_URL, {
        toolbarColor: '#1A1A2E',
        controlsColor: '#7C5CFF',
        enableBarCollapsing: false,
      });
    } catch (e: any) {
      Alert.alert('Error', 'Could not open browser: ' + e.message);
    } finally {
      setOpeningAccount(false);
    }
  };

  return (
    <Card style={{ 
      marginBottom: spacing.base, 
      overflow: 'hidden', 
      borderWidth: 1, 
      borderColor: 'rgba(124,92,255,0.3)',
    }}>
      {/* Compact Header Row */}
      <View style={{ 
        backgroundColor: '#1A0A3E', 
        margin: -1, 
        padding: spacing.sm,
        borderTopLeftRadius: radius.xl,
        borderTopRightRadius: radius.xl,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(124,92,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="flash" size={16} color="#7C5CFF" />
          </View>
          <View>
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>Dhan Account</Text>
            <Text style={{ color: '#9CA3AF', fontSize: 10 }}>Via IndexPilot AI</Text>
          </View>
        </View>
        <View style={{ paddingHorizontal: 6, paddingVertical: 3, backgroundColor: 'rgba(124,92,255,0.2)', borderRadius: 4 }}>
          <Text style={{ color: '#7C5CFF', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 }}>REFERRAL</Text>
        </View>
      </View>

      {/* Compact Content */}
      <View style={{ padding: spacing.sm, paddingTop: spacing.sm }}>
        {/* Referral Code - Single Row */}
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          backgroundColor: 'rgba(124,92,255,0.08)',
          borderRadius: radius.sm,
          padding: 10,
          borderWidth: 1,
          borderColor: 'rgba(124,92,255,0.2)',
          marginBottom: 8,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="gift-outline" size={16} color="#7C5CFF" />
            <Text style={{ color: '#9CA3AF', fontSize: 9, fontWeight: '700', letterSpacing: 1 }}>CODE</Text>
            <Text style={{ color: '#7C5CFF', fontSize: 15, fontWeight: '900', letterSpacing: 2 }}>SMIL56887</Text>
          </View>
          <Text style={{ color: '#00FF66', fontSize: 9, fontWeight: '700' }}>GET ₹0 BROKERAGE*</Text>
        </View>

        {/* Open Account Button - Compact */}
        <TouchableOpacity
          onPress={openDhanAccount}
          disabled={openingAccount}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: '#7C5CFF',
            borderRadius: radius.sm,
            paddingVertical: 12,
          }}
        >
          {openingAccount ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="add-circle" size={18} color="#FFFFFF" />
          )}
          <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '800', letterSpacing: 0.5 }}>
            {openingAccount ? 'Opening...' : 'Open Dhan Account'}
          </Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
}
