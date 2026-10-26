import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserProfile, UserRole } from '../types';
import {
  supabase,
  isSupabaseConfigured,
  setAdminSessionCredentials,
  clearAdminSessionCredentials,
  getCustomerAuthHeaders,
} from '../lib/supabase';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  login: (email: string, role?: UserRole) => Promise<{ success: boolean; message?: string }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    phone?: string
  ) => Promise<{ success: boolean; message?: string }>;
  signInWithPassword: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; message?: string }>;
  authenticateOwner: (
    email: string,
    passcode: string
  ) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  setOwnerSession: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('form_fit_user_session');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      return null;
    }
    return null;
  });

  const [loading, setLoading] = useState<boolean>(true);

  const syncServerProfile = useCallback(
    async (
      accessToken: string,
      fallbackUser: { id: string; email: string; full_name?: string; phone?: string }
    ): Promise<UserProfile> => {
      try {
        const res = await fetch('/api/auth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            action: 'sync-profile',
            full_name: fallbackUser.full_name,
            phone: fallbackUser.phone,
          }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json?.success && json?.profile) {
            const synced: UserProfile = {
              id: json.profile.id,
              email: json.profile.email || fallbackUser.email,
              full_name: json.profile.full_name,
              phone: json.profile.phone,
              role: (json.profile.role as UserRole) || 'customer',
              created_at: json.profile.created_at || new Date().toISOString(),
            };
            setUser(synced);
            localStorage.setItem('form_fit_user_session', JSON.stringify(synced));
            return synced;
          }
        }
      } catch {
        // Fall through to direct Supabase query below
      }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', fallbackUser.id)
        .maybeSingle();

      const profile: UserProfile = data
        ? {
            id: data.id,
            email: data.email || fallbackUser.email,
            full_name: data.full_name || fallbackUser.full_name,
            phone: data.phone || fallbackUser.phone,
            role: (data.role as UserRole) || 'customer',
            created_at: data.created_at,
          }
        : {
            id: fallbackUser.id,
            email: fallbackUser.email,
            full_name: fallbackUser.full_name,
            phone: fallbackUser.phone,
            role: 'customer',
            created_at: new Date().toISOString(),
          };

      setUser(profile);
      localStorage.setItem('form_fit_user_session', JSON.stringify(profile));
      return profile;
    },
    []
  );

  useEffect(() => {
    if (isSupabaseConfigured()) {
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (session?.user) {
          await syncServerProfile(session.user.id ? session.access_token : '', {
            id: session.user.id,
            email: session.user.email || '',
            full_name: session.user.user_metadata?.full_name,
            phone: session.user.user_metadata?.phone,
          });
        }
        setLoading(false);
      });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          syncServerProfile(session.access_token, {
            id: session.user.id,
            email: session.user.email || '',
            full_name: session.user.user_metadata?.full_name,
            phone: session.user.user_metadata?.phone,
          }).finally(() => setLoading(false));
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
  }, [syncServerProfile]);

  const signUp = async (email: string, password: string, fullName: string, phone?: string) => {
    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    try {
      // 1. Register via server `/api/auth` so account is confirmed in `auth.users` & stored in `public.profiles`
      try {
        const apiRes = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'register',
            email: cleanEmail,
            password,
            fullName: fullName.trim(),
            phone: phone?.trim() || '',
          }),
        });

        const apiJson = await apiRes.json().catch(() => null);
        if (!apiRes.ok && apiJson?.error) {
          setLoading(false);
          return { success: false, message: apiJson.error };
        }

        if (apiRes.ok && apiJson?.success) {
          if (isSupabaseConfigured()) {
            const { data: signInData } = await supabase.auth.signInWithPassword({
              email: cleanEmail,
              password,
            });
            if (signInData?.session?.access_token && signInData.user) {
              await syncServerProfile(signInData.session.access_token, {
                id: signInData.user.id,
                email: cleanEmail,
                full_name: fullName.trim(),
                phone: phone?.trim() || '',
              });
              setLoading(false);
              return {
                success: true,
                message: 'Account registered & signed in! Welcome to Form & Fit.',
              };
            }
          }

          if (apiJson.user) {
            const profile: UserProfile = {
              id: apiJson.user.id,
              email: apiJson.user.email || cleanEmail,
              full_name: apiJson.user.full_name || fullName.trim(),
              phone: apiJson.user.phone || phone?.trim() || '',
              role: (apiJson.user.role as UserRole) || 'customer',
              created_at: apiJson.user.created_at || new Date().toISOString(),
            };
            setUser(profile);
            localStorage.setItem('form_fit_user_session', JSON.stringify(profile));
            setLoading(false);
            return {
              success: true,
              message: 'Account registered successfully! Welcome to Form & Fit.',
            };
          }
        }
      } catch {
        // Fall through to direct Supabase client sign-up if `/api/auth` is unreachable
      }

      if (isSupabaseConfigured()) {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              phone: phone?.trim() || '',
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
            email: cleanEmail,
            full_name: fullName.trim(),
            phone: phone?.trim() || '',
            role: 'customer',
            created_at: new Date().toISOString(),
          };
          await supabase.from('profiles').upsert(profile);
          setUser(profile);
          localStorage.setItem('form_fit_user_session', JSON.stringify(profile));
        }

        setLoading(false);
        return { success: true, message: 'Account registered successfully! Welcome to Form & Fit.' };
      }

      const localProfile: UserProfile = {
        id: `usr_${Math.random().toString(36).substring(2, 9)}`,
        email: cleanEmail,
        full_name: fullName.trim(),
        phone: phone?.trim() || '',
        role: 'customer',
        created_at: new Date().toISOString(),
      };
      setUser(localProfile);
      localStorage.setItem('form_fit_user_session', JSON.stringify(localProfile));
      setLoading(false);
      return { success: true, message: 'Account registered successfully!' };
    } catch (err: any) {
      setLoading(false);
      return { success: false, message: err?.message || 'Registration failed' };
    }
  };

  const signInWithPassword = async (email: string, password: string) => {
    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    try {
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (error) {
          setLoading(false);
          return { success: false, message: error.message };
        }
        if (data.user && data.session?.access_token) {
          await syncServerProfile(data.session.access_token, {
            id: data.user.id,
            email: data.user.email || cleanEmail,
            full_name: data.user.user_metadata?.full_name,
            phone: data.user.user_metadata?.phone,
          });
        }
        setLoading(false);
        return { success: true };
      } else {
        const localProfile: UserProfile = {
          id: `usr_${Math.random().toString(36).substring(2, 9)}`,
          email: cleanEmail,
          full_name: cleanEmail.split('@')[0].toUpperCase(),
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
    const cleanEmail = email.trim().toLowerCase();
    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase.auth.signInWithOtp({ email: cleanEmail });
        setLoading(false);
        if (error) {
          return { success: false, message: error.message };
        }
        return { success: true, message: 'Magic login link sent to your email.' };
      } else {
        const simulatedProfile: UserProfile = {
          id: `usr_${Math.random().toString(36).substring(2, 9)}`,
          email: cleanEmail,
          full_name: cleanEmail.split('@')[0].toUpperCase(),
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

  const authenticateOwner = async (
    email: string,
    passcode: string
  ): Promise<{ success: boolean; message?: string }> => {
    setLoading(true);
    const cleanEmail = email
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim()
      .replace(/^["']+|["']+$/g, '')
      .trim()
      .toLowerCase();
    const cleanPasscode = passcode
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim()
      .replace(/^["']+|["']+$/g, '')
      .trim();

    let apiReached = false;

    // 1. Validate against server `/api/auth` (`ADMIN_PASSCODE` + Supabase Auth & `profiles` sync)
    try {
      const apiRes = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'owner-login',
          email: cleanEmail,
          passcode: cleanPasscode,
        }),
      });

      const contentType = apiRes.headers.get('content-type') || '';
      const apiJson = contentType.includes('application/json')
        ? await apiRes.json().catch(() => null)
        : null;

      if (apiJson !== null) {
        apiReached = true;
      }

      if (apiRes.ok && apiJson?.authorized) {
        setAdminSessionCredentials(cleanEmail, cleanPasscode);

        let supabaseUserId = apiJson.user?.id || 'owner_primary_account';
        if (isSupabaseConfigured()) {
          const { data: signInData } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: cleanPasscode,
          });
          if (signInData?.user?.id) {
            supabaseUserId = signInData.user.id;
          }
        }

        const verifiedOwner: UserProfile = {
          id: supabaseUserId,
          email: cleanEmail,
          full_name: apiJson.user?.full_name || 'Store Owner Admin',
          role: (apiJson.role === 'admin' ? 'admin' : 'owner') as UserRole,
          created_at: new Date().toISOString(),
        };

        setUser(verifiedOwner);
        localStorage.setItem('form_fit_user_session', JSON.stringify(verifiedOwner));
        localStorage.setItem('form_fit_owner_mode', 'true');
        setLoading(false);
        return { success: true };
      }

      if (apiRes.status === 401 && apiJson?.error) {
        setLoading(false);
        return { success: false, message: apiJson.error };
      }
    } catch {
      // Fall back to direct Supabase check below if `/api/auth` is unreachable
    }

    // 2. Direct Supabase fallback
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPasscode,
        });

        if (!error && data.user) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .maybeSingle();

          const isMasterEmail =
            cleanEmail === 'admin@formandfit.in' || cleanEmail === 'owner@formandfit.in';
          const isApprovedRole =
            isMasterEmail ||
            (profileData && (profileData.role === 'owner' || profileData.role === 'admin'));

          if (isApprovedRole) {
            setAdminSessionCredentials(cleanEmail, cleanPasscode);
            const verifiedOwner: UserProfile = {
              id: data.user.id,
              email: profileData?.email || data.user.email || cleanEmail,
              full_name: profileData?.full_name || 'Store Owner Admin',
              role: (profileData?.role === 'admin' ? 'admin' : 'owner') as UserRole,
              created_at: profileData?.created_at || new Date().toISOString(),
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
    } else if (
      !apiReached &&
      (cleanEmail === 'admin@formandfit.in' || cleanEmail === 'owner@formandfit.in') &&
      cleanPasscode === 'FormFit2026!Admin'
    ) {
      setAdminSessionCredentials(cleanEmail, cleanPasscode);
      const verifiedOwner: UserProfile = {
        id: 'owner_primary_account',
        email: cleanEmail,
        full_name: 'Store Owner Admin',
        role: 'owner',
        created_at: new Date().toISOString(),
      };
      setUser(verifiedOwner);
      localStorage.setItem('form_fit_user_session', JSON.stringify(verifiedOwner));
      localStorage.setItem('form_fit_owner_mode', 'true');
      setLoading(false);
      return { success: true };
    }

    setLoading(false);
    return {
      success: false,
      message:
        'Access Denied: Invalid Admin Credentials. Only approved store administrators may log in.',
    };
  };

  const setOwnerSession = () => {
    setAdminSessionCredentials('admin@formandfit.in', 'FormFit2026!Admin');
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
    clearAdminSessionCredentials();
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

    try {
      const headers = await getCustomerAuthHeaders();
      if (headers.Authorization) {
        await fetch('/api/auth', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            action: 'sync-profile',
            full_name: updated.full_name,
            phone: updated.phone,
          }),
        });
        return;
      }
    } catch {
      // fall through
    }

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
