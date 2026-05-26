import { createContext, useContext, useState, ReactNode } from 'react';

interface AuthContextType {
  isLoggedIn: boolean;
  isAdmin: boolean;
  username: string;
  loginApp: (username: string, password: string) => boolean;
  logoutApp: () => void;
  login: (pin: string) => boolean;
  logout: () => void;
  updatePin: (oldPin: string, newPin: string) => boolean;
  changePassword: (oldPassword: string, newPassword: string) => boolean;
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

  // Admin PIN state (existing functionality)
  const [isAdmin, setIsAdmin] = useState(() => {
    return sessionStorage.getItem('isAdmin') === 'true';
  });
  const [storedPin, setStoredPin] = useState(() => {
    return localStorage.getItem('adminPin') || '1234';
  });

  // Stored credentials
  const getStoredPassword = () => localStorage.getItem('appPassword') || 'admin123';

  // App login
  const loginApp = (user: string, pass: string) => {
    const storedPassword = getStoredPassword();
    if (user === 'admin' && pass === storedPassword) {
      setIsLoggedIn(true);
      setUsername(user);
      setIsAdmin(true);
      sessionStorage.setItem('isLoggedIn', 'true');
      sessionStorage.setItem('loggedInUser', user);
      sessionStorage.setItem('isAdmin', 'true');
      return true;
    }
    return false;
  };

  // App logout
  const logoutApp = () => {
    setIsLoggedIn(false);
    setIsAdmin(false);
    setUsername('');
    sessionStorage.removeItem('isLoggedIn');
    sessionStorage.removeItem('loggedInUser');
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

  return (
    <AuthContext.Provider value={{ 
      isLoggedIn, isAdmin, username,
      loginApp, logoutApp, 
      login, logout, updatePin, changePassword 
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
