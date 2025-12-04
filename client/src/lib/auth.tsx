import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { clientApi, authApi, isAuthenticated, clearToken, isMockMode, type ClientContext } from "./api";

interface AuthState {
  isLoading: boolean;
  isLoggedIn: boolean;
  user: ClientContext | null;
  mockMode: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isLoggedIn: false,
    user: null,
    mockMode: isMockMode(),
  });

  const refresh = async () => {
    if (!isAuthenticated()) {
      setState(prev => ({ ...prev, isLoading: false, isLoggedIn: false, user: null }));
      return;
    }

    try {
      const result = await clientApi.getMe();
      if (result.success && result.data) {
        setState({
          isLoading: false,
          isLoggedIn: true,
          user: result.data,
          mockMode: isMockMode(),
        });
      } else {
        clearToken();
        setState({ isLoading: false, isLoggedIn: false, user: null, mockMode: isMockMode() });
      }
    } catch {
      clearToken();
      setState({ isLoading: false, isLoggedIn: false, user: null, mockMode: isMockMode() });
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const login = async (email: string, password: string) => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const result = await authApi.login(email, password);
      
      if (result.success) {
        await refresh();
        return { success: true };
      }
      
      setState(prev => ({ ...prev, isLoading: false }));
      return { success: false, error: result.error?.message || "Login failed" };
    } catch (err) {
      setState(prev => ({ ...prev, isLoading: false }));
      return { success: false, error: err instanceof Error ? err.message : "Login failed" };
    }
  };

  const logout = () => {
    authApi.logout();
    setState({ isLoading: false, isLoggedIn: false, user: null, mockMode: isMockMode() });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
