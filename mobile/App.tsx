/**
 * Engram Mobile — mine Engram on Akash Network from your phone.
 *
 * Stack:
 *   Wallet tab     — sr25519 keypair + Bittensor subnet info (raw JSON-RPC)
 *   Dashboard tab  — live mining stats from the active cloud node
 *   Start Mining   — configure tier/duration, pay via x402 (Dexter), launch node
 */

import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text } from 'react-native';
import { initCrypto } from './src/services/keystore';

import DashboardScreen  from './src/screens/DashboardScreen';
import StartMiningScreen from './src/screens/StartMiningScreen';
import WalletScreen     from './src/screens/WalletScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  useEffect(() => {
    // Initialise the WASM sr25519 backend once at startup.
    initCrypto().catch(console.error);
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <Tab.Navigator
          screenOptions={{
            headerShown:     false,
            tabBarStyle:     { backgroundColor: '#09090f', borderTopColor: 'rgba(255,255,255,0.06)', height: 60, paddingBottom: 8 },
            tabBarActiveTintColor:   '#a78bfa',
            tabBarInactiveTintColor: '#374151',
          }}
        >
          <Tab.Screen
            name="Dashboard"
            component={DashboardScreen}
            options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>⛏</Text> }}
          />
          <Tab.Screen
            name="Start Mining"
            component={StartMiningScreen}
            options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>▶</Text> }}
          />
          <Tab.Screen
            name="Wallet"
            component={WalletScreen}
            options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>🔑</Text> }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
