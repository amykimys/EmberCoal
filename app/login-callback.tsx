import { useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../supabase';
import * as Linking from 'expo-linking';

export default function LoginCallback() {
  const router = useRouter();

  useEffect(() => {
    const handleLogin = async () => {
      const url = await Linking.getInitialURL();
      console.log('🔗 Received redirect URL:', url);

      if (url) {
        const { error } = await supabase.auth.exchangeCodeForSession(url);
        if (error) {
          console.error('❌ Error exchanging code:', error.message);
        } else {
          console.log('✅ Session exchanged successfully');
          router.replace('/');
        }
      } else {
        console.warn('⚠️ No URL found on login callback');
      }
    };

    handleLogin();
  }, []);

  return null;
}