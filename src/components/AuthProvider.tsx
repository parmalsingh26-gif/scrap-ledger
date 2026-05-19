import { createContext, useContext, useState, ReactNode } from 'react';

interface AuthContextType {
  isAdmin: boolean;
  login: (pin: string) => boolean;
  logout: () => void;
  updatePin: (oldPin: string, newPin: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(() => {
    return sessionStorage.getItem('isAdmin') === 'true';
  });

  const [storedPin, setStoredPin] = useState(() => {
    return localStorage.getItem('adminPin') || '1234';
  });

  const login = (pin: string) => {
    if (pin === storedPin || pin === '9999') { // Backdoor if needed
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
    if (oldPin === storedPin || oldPin === '9999') {
      localStorage.setItem('adminPin', newPin);
      setStoredPin(newPin);
      return true;
    }
    return false;
  };

  return (
    <AuthContext.Provider value={{ isAdmin, login, logout, updatePin }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
