import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Session } from '@supabase/supabase-js';

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession(); // 👈 this initializes session context
      console.log('🧩 Restoring session from getSession:', session);
      setSession(session);
      setIsLoading(false);
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('📡 Auth state changed:', _event, session);
      setSession(session);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return { session, isLoading };
}
