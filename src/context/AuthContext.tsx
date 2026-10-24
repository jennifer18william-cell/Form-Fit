import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  login: (email: string, role?: UserRole) => Promise<{ success: boolean; message?: string }>;
  signUp: (email: string, password: string, fullName: string, phone?: string) => Promise<{ success: boolean; message?: string }>;
  signInWithPassword: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  authenticateOwner: (email: string, passcode: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  setOwnerSession: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('form_fit_user_session');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (isSupabaseConfigured()) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          fetchUserProfile(session.user.id, session.user.email || '');
        } else {
          setLoading(false);
        }
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          fetchUserProfile(session.user.id, session.user.email || '');
        } else {
          if (!localStorage.getItem('form_fit_owner_mode')) {
            setUser(null);
            localStorage.removeItem('form_fit_user_session');
          }
          setLoading(false);
        }
      });

      return () => subscription.unsubscribe();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUserProfile = async (userId: string, email: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (data) {
        const profile: UserProfile = {
          id: data.id,
          email: data.email || email,
          full_name: data.full_name,
          phone: data.phone,
          role: (data.role as UserRole) || 'customer',
          created_at: data.created_at,
        };
        setUser(profile);
        localStorage.setItem('form_fit_user_session', JSON.stringify(profile));
      } else {
        const newProfile: UserProfile = {
          id: userId,
          email: email,
          role: 'customer',
          created_at: new Date().toISOString(),
        };
        setUser(newProfile);
        localStorage.setItem('form_fit_user_session', JSON.stringify(newProfile));
      }
    } catch (err) {
      console.error('Profile fetch exception:', err);
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, fullName: string, phone?: string) => {
    setLoading(true);
    try {
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              phone: phone || '',
            },
          },
        });

        if (error) {
          setLoading(false);
          return { success: false, message: error.message };
        }

        if (data.user) {
          const profile: UserProfile = {
            id: data.user.id,
            email: email,
            full_name: fullName,
            phone: phone || '',
            role: 'customer',
            created_at: new Date().toISOString(),
          };

          // Upsert profile into public.profiles table
          await supabase.from('profiles').upsert(profile);
          setUser(profile);
          localStorage.setItem('form_fit_user_session', JSON.stringify(profile));
        }

        setLoading(false);
        return { success: true, message: 'Account registered successfully! Welcome to Form & Fit.' };
      } else {
        // Direct local registration
        const localProfile: UserProfile = {
          id: `usr_${Math.random().toString(36).substring(2, 9)}`,
          email,
          full_name: fullName,
          phone: phone || '',
          role: 'customer',
          created_at: new Date().toISOString(),
        };
        setUser(localProfile);
        localStorage.setItem('form_fit_user_session', JSON.stringify(localProfile));
        setLoading(false);
        return { success: true, message: 'Account registered successfully!' };
      }
    } catch (err: any) {
      setLoading(false);
      return { success: false, message: err?.message || 'Registration failed' };
    }
  };

  const signInWithPassword = async (email: string, password: string) => {
    setLoading(true);
    try {
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setLoading(false);
          return { success: false, message: error.message };
        }
        if (data.user) {
          await fetchUserProfile(data.user.id, data.user.email || email);
        }
        setLoading(false);
        return { success: true };
      } else {
        const localProfile: UserProfile = {
          id: `usr_${Math.random().toString(36).substring(2, 9)}`,
          email,
          full_name: email.split('@')[0].toUpperCase(),
          role: 'customer',
          created_at: new Date().toISOString(),
        };
        setUser(localProfile);
        localStorage.setItem('form_fit_user_session', JSON.stringify(localProfile));
        setLoading(false);
        return { success: true };
      }
    } catch (err: any) {
      setLoading(false);
      return { success: false, message: err?.message || 'Authentication failed' };
    }
  };

  const login = async (email: string, requestedRole: UserRole = 'customer') => {
    setLoading(true);
    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase.auth.signInWithOtp({ email });
        if (error) {
          setLoading(false);
          return { success: false, message: error.message };
        }
        return { success: true, message: 'Magic login link sent to your email.' };
      } else {
        const simulatedProfile: UserProfile = {
          id: `usr_${Math.random().toString(36).substring(2, 9)}`,
          email: email,
          full_name: email.split('@')[0].toUpperCase(),
          role: requestedRole,
          created_at: new Date().toISOString(),
        };
        setUser(simulatedProfile);
        localStorage.setItem('form_fit_user_session', JSON.stringify(simulatedProfile));
        setLoading(false);
        return { success: true };
      }
    } catch (err: any) {
      setLoading(false);
      return { success: false, message: err?.message || 'Login failed' };
    }
  };

  const authenticateOwner = async (email: string, passcode: string): Promise<{ success: boolean; message?: string }> => {
    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    const cleanPasscode = passcode.trim();

    // Check strict master admin credentials OR verified Supabase owner profile
    const isMasterCredential = (cleanEmail === 'admin@formandfit.in' || cleanEmail === 'owner@formandfit.in') && cleanPasscode === 'FormFit2026!Admin';

    if (isMasterCredential) {
      const ownerProfile: UserProfile = {
        id: 'owner_primary_account',
        email: 'admin@formandfit.in',
        full_name: 'Store Owner Admin',
        role: 'owner',
        created_at: new Date().toISOString(),
      };
      setUser(ownerProfile);
      localStorage.setItem('form_fit_user_session', JSON.stringify(ownerProfile));
      localStorage.setItem('form_fit_owner_mode', 'true');
      setLoading(false);
      return { success: true };
    }

    // Attempt Supabase owner authentication if configured
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password: cleanPasscode });
        if (!error && data.user) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

          if (profileData && (profileData.role === 'owner' || profileData.role === 'admin')) {
            const verifiedOwner: UserProfile = {
              id: profileData.id,
              email: profileData.email,
              full_name: profileData.full_name || 'Store Owner',
              role: profileData.role as UserRole,
              created_at: profileData.created_at,
            };
            setUser(verifiedOwner);
            localStorage.setItem('form_fit_user_session', JSON.stringify(verifiedOwner));
            localStorage.setItem('form_fit_owner_mode', 'true');
            setLoading(false);
            return { success: true };
          }
        }
      } catch (err) {
        console.error('Owner auth check exception:', err);
      }
    }

    setLoading(false);
    return {
      success: false,
      message: 'Access Denied: Invalid Admin Credentials. Only approved store administrators may log in.',
    };
  };

  const setOwnerSession = () => {
    const ownerProfile: UserProfile = {
      id: 'owner_primary_account',
      email: 'admin@formandfit.in',
      full_name: 'Store Owner Admin',
      role: 'owner',
      created_at: new Date().toISOString(),
    };
    setUser(ownerProfile);
    localStorage.setItem('form_fit_user_session', JSON.stringify(ownerProfile));
    localStorage.setItem('form_fit_owner_mode', 'true');
  };

  const logout = async () => {
    if (isSupabaseConfigured()) {
      await supabase.auth.signOut();
    }
    setUser(null);
    localStorage.removeItem('form_fit_user_session');
    localStorage.removeItem('form_fit_owner_mode');
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    const updated = { ...user, ...data };
    setUser(updated);
    localStorage.setItem('form_fit_user_session', JSON.stringify(updated));

    if (isSupabaseConfigured()) {
      await supabase.from('profiles').update(data).eq('id', user.id);
    }
  };

  const isOwner = user?.role === 'owner';
  const isAdmin = user?.role === 'owner' || user?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isOwner,
        isAdmin,
        login,
        signUp,
        signInWithPassword,
        authenticateOwner,
        logout,
        updateProfile,
        setOwnerSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
