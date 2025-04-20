import { useEffect, useState } from 'react';
import { supabase } from '../../supabase'; // adjust path if needed
import { View, Text, Image, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { User } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { makeRedirectUri} from 'expo-auth-session';




const profileImage = 'https://placekitten.com/200/200'; // replace with dynamic photo if needed

const friends = [
  { id: '1', name: 'Jamie', avatar: 'https://placekitten.com/100/100' },
  { id: '2', name: 'Taylor', avatar: 'https://placekitten.com/101/101' },
];

export default function ProfileScreen() {
    const [user, setUser] = useState<User | null>(null);

    const signInWithGoogle = async () => {
      try {
        // First, clear any existing session
        await supabase.auth.signOut();
        
        // Clear any cached OAuth data
        await WebBrowser.maybeCompleteAuthSession();
        
        const redirectUri = makeRedirectUri({
          native: 'ember://login-callback',
        });
        
        console.log('🔗 Redirect URI:', redirectUri);
        
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUri,
            skipBrowserRedirect: true,
            queryParams: {
              prompt: 'select_account',
              access_type: 'offline',
            },
          },
        });
        
        if (error) {
          console.error('❌ OAuth error:', error.message);
          return;
        }
        
        if (data?.url) {
          console.log('🌐 Opening auth session to:', data.url);
          const result = await WebBrowser.openAuthSessionAsync(
            data.url,
            redirectUri,
            {
              showInRecents: true,
              dismissButtonStyle: 'cancel',
            }
          );
          
          if (result.type === 'success') {
            console.log('✅ Auth session completed successfully');
            
            // Get the updated session
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            
            if (sessionError) {
              console.error('❌ Session error:', sessionError.message);
              return;
            }
            
            if (session?.user) {
              console.log('👤 User session established:', {
                email: session.user.email,
                id: session.user.id
              });
              
              // Force a refresh of the user data
              const { data: { user }, error: userError } = await supabase.auth.getUser();
              
              if (userError) {
                console.error('❌ User data error:', userError.message);
                return;
              }
              
              if (user) {
                console.log('👤 User profile data:', {
                  name: user.user_metadata?.full_name,
                  email: user.email,
                  avatar: user.user_metadata?.avatar_url,
                  raw: user
                });
                setUser(user);
              }
            }
          } else {
            console.log('❌ Auth session failed:', result.type);
          }
        } else {
          console.warn('⚠️ No URL returned from Supabase');
        }
      } catch (error) {
        console.error('❌ Sign in error:', error);
      }
    };

  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      console.log('🔍 Initial session check:', {
        hasSession: !!session,
        email: session?.user?.email
      });

      if (session?.user) {
        // Get user metadata which includes the name from Google
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) {
          console.error('❌ Error fetching user data:', userError.message);
        } else if (user) {
          console.log('👤 User profile data:', {
            name: user.user_metadata?.full_name,
            email: user.email,
            avatar: user.user_metadata?.avatar_url,
            raw: user
          });
          setUser(user);
        }
      }

      if (error) {
        console.error('❌ Session fetch error:', error.message);
      }
    };

    fetchSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth state changed:', {
        event,
        hasSession: !!session,
        email: session?.user?.email
      });
      
      if (session?.user) {
        // Force a refresh of the user data
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          console.log('👤 Updated user data:', {
            name: user.user_metadata?.full_name,
            email: user.email,
            avatar: user.user_metadata?.avatar_url,
            raw: user
          });
          setUser(user);
        }
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <ScrollView contentContainerStyle={{ padding: 24 }}>
      {/* Sign In Button */}
      {!user && (
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <TouchableOpacity
            onPress={signInWithGoogle}
            style={{
              backgroundColor: '#4285F4',
              paddingVertical: 12,
              paddingHorizontal: 24,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: 'white', fontWeight: '600' }}>Sign in with Google</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Profile Header */}
      <View style={{ alignItems: 'center', marginBottom: 24 }}>
        <Image
          source={{ uri: user?.user_metadata?.avatar_url || profileImage }}
          style={{
            width: 100,
            height: 100,
            borderRadius: 50,
            borderWidth: 2,
            borderColor: '#ccc',
          }}
        />
        <Text style={{ fontSize: 20, fontWeight: 'bold', marginTop: 12 }}>
          {user?.user_metadata?.full_name || user?.email || 'Your Name'}
        </Text>
      </View>

      {/* Streak Stats */}
      <View style={{ backgroundColor: '#f3f3f3', padding: 16, borderRadius: 12, marginBottom: 24 }}>
        <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>🔥 Streak Stats</Text>
        <Text>Current Streak: 6</Text>
        <Text>Longest Streak: 12</Text>
        <Text>Total Completions: 78</Text>
      </View>

      {/* Weekly Progress Placeholder */}
      <View style={{ marginBottom: 24 }}>
        <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>📅 Weekly Progress</Text>
        <View style={{ height: 100, backgroundColor: '#eaeaea', borderRadius: 8 }} />
      </View>

      {/* Friends Section */}
      <View style={{ marginTop: 32 }}>
        <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 12 }}>👥 Friends</Text>
        {friends.map(friend => (
          <View
            key={friend.id}
            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}
          >
            <Image
              source={{ uri: friend.avatar }}
              style={{ width: 48, height: 48, borderRadius: 24, marginRight: 12 }}
            />
            <Text style={{ fontSize: 16 }}>{friend.name}</Text>
          </View>
        ))}

        <TouchableOpacity
          style={{
            marginTop: 12,
            paddingVertical: 10,
            paddingHorizontal: 16,
            backgroundColor: '#007AFF',
            borderRadius: 8,
            alignSelf: 'flex-start',
          }}
        >
          <Text style={{ color: 'white', fontWeight: '600' }}>+ Add Friend</Text>
        </TouchableOpacity>
      </View>

      {/* Settings / Logout */}
      <TouchableOpacity style={{ paddingVertical: 12 }}>
        <Text style={{ color: '#007AFF' }}>✏️ Edit Profile</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={{ paddingVertical: 12 }}
        onPress={() => {
          Alert.alert(
            "Log Out",
            "Are you sure you want to log out?",
            [
              {
                text: "Cancel",
                style: "cancel"
              },
              {
                text: "Log Out",
                style: "destructive",
                onPress: async () => {
                  const { error } = await supabase.auth.signOut();
                  if (error) {
                    console.error('Error signing out:', error.message);
                  } else {
                    setUser(null);
                  }
                }
              }
            ]
          );
        }}
      >
        <Text style={{ color: '#FF3B30' }}>🚪 Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
