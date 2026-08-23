import { createContext, useContext, useState, ReactNode } from 'react';

interface AuthContextType {
  isLoggedIn: boolean;
  isAdmin: boolean;
  username: string;
  token: string | null;
  loginApp: (username: string, password: string) => Promise<boolean>;
  logoutApp: () => void;
  login: (pin: string) => boolean;
  logout: () => void;
  updatePin: (oldPin: string, newPin: string) => boolean;
  changePassword: (oldPassword: string, newPassword: string) => boolean;
  isNotebookUnlocked: boolean;
  unlockNotebook: (pin: string) => boolean;
  updateNotebookPin: (oldPin: string, newPin: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // App-level login state
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return sessionStorage.getItem('isLoggedIn') === 'true';
  });
  const [username, setUsername] = useState(() => {
    return sessionStorage.getItem('loggedInUser') || '';
  });
  const [token, setToken] = useState<string | null>(() => {
    return sessionStorage.getItem('token');
  });

  // Admin PIN state (existing functionality)
  const [isAdmin, setIsAdmin] = useState(() => {
    return sessionStorage.getItem('isAdmin') === 'true';
  });
  const [storedPin, setStoredPin] = useState(() => {
    return localStorage.getItem('adminPin') || '1234';
  });

  // Notebook PIN state
  const [isNotebookUnlocked, setIsNotebookUnlocked] = useState(false);
  const [storedNotebookPin, setStoredNotebookPin] = useState(() => {
    return localStorage.getItem('notebookPin') || '1232';
  });

  // Stored credentials
  const getStoredPassword = () => localStorage.getItem('appPassword') || 'admin123';

  // App login (Backend JWT)
  const loginApp = async (user: string, pass: string): Promise<boolean> => {
    try {
      const API_BASE = import.meta.env.PROD ? '/api' : 'http://localhost:5001/api';
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass })
      });
      if (res.ok) {
        const data = await res.json();
        setIsLoggedIn(true);
        setUsername(data.username);
        setToken(data.token);
        setIsAdmin(true); // Treat API logged in users as admins for now
        sessionStorage.setItem('isLoggedIn', 'true');
        sessionStorage.setItem('loggedInUser', data.username);
        sessionStorage.setItem('token', data.token);
        sessionStorage.setItem('isAdmin', 'true');
        return true;
      }
      return false;
    } catch (err) {
      console.error('Login error:', err);
      return false;
    }
  };

  // App logout
  const logoutApp = () => {
    setIsLoggedIn(false);
    setIsAdmin(false);
    setUsername('');
    setToken(null);
    sessionStorage.removeItem('isLoggedIn');
    sessionStorage.removeItem('loggedInUser');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('isAdmin');
  };

  // Admin PIN login (backward compatible)
  const login = (pin: string) => {
    if (pin === storedPin) {
      setIsAdmin(true);
      sessionStorage.setItem('isAdmin', 'true');
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAdmin(false);
    sessionStorage.removeItem('isAdmin');
  };

  const updatePin = (oldPin: string, newPin: string) => {
    if (oldPin === storedPin) {
      localStorage.setItem('adminPin', newPin);
      setStoredPin(newPin);
      return true;
    }
    return false;
  };

  // Password change
  const changePassword = (oldPassword: string, newPassword: string) => {
    const storedPassword = getStoredPassword();
    if (oldPassword === storedPassword) {
      localStorage.setItem('appPassword', newPassword);
      return true;
    }
    return false;
  };

  const unlockNotebook = (pin: string) => {
    if (pin === storedNotebookPin) {
      setIsNotebookUnlocked(true);
      return true;
    }
    return false;
  };

  const updateNotebookPin = (oldPin: string, newPin: string) => {
    if (oldPin === storedNotebookPin) {
      localStorage.setItem('notebookPin', newPin);
      setStoredNotebookPin(newPin);
      return true;
    }
    return false;
  };

  return (
    <AuthContext.Provider value={{ 
      isLoggedIn, isAdmin, username, token,
      loginApp, logoutApp, 
      login, logout, updatePin, changePassword,
      isNotebookUnlocked, unlockNotebook, updateNotebookPin
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
