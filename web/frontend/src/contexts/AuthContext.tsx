import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { initAuth, interactiveLogin, getUserInfo, revokeToken, hasValidToken, restoreServerSession } from '../services/googleAuth';

export interface User {
  id: string;
  username: string;
  email: string;
  picture?: string;
}

interface AuthContextType {
  user: User | null;
  /** Inicia sesión con Google (abre el popup de consentimiento). */
  login: () => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const STORAGE_KEY = 'facturacion_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const persist = (u: User | null) => {
    setUser(u);
    try {
      if (u) localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  // Al arrancar solo inicializamos Google (cargar script + token client).
  // NO pedimos token acá: requestAccessToken abre un popup y, sin un click del
  // usuario, el navegador lo bloquea. El login ocurre al tocar el botón.
  useEffect(() => {
    let cancelled = false;
    initAuth()
      .catch((e) => console.warn('No se pudo inicializar Google Auth:', e))
      .finally(async () => {
        if (cancelled) return;
        // 1) Sesión larga: restaurar vía cookie httpOnly del servidor (sin popup).
        let restored = false;
        try {
          restored = await restoreServerSession();
        } catch {
          /* ignore */
        }
        if (cancelled) return;
        // 2) Si hay sesión (servidor o token clásico vigente), recuperar el usuario.
        if (restored || hasValidToken()) {
          try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
              setUser(JSON.parse(stored));
            } else {
              // Sesión de servidor sin user guardado: traerlo de Google.
              const info = await getUserInfo();
              if (!cancelled) {
                persist({ id: info.sub, username: info.name || info.email, email: info.email, picture: info.picture });
              }
            }
          } catch {
            /* ignore */
          }
        }
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (): Promise<boolean> => {
    try {
      // Code flow (sesión larga) si el servidor lo soporta; si no, token client clásico.
      await interactiveLogin();
      const info = await getUserInfo();
      persist({ id: info.sub, username: info.name || info.email, email: info.email, picture: info.picture });
      return true;
    } catch (error) {
      console.error('Error en login con Google:', error);
      return false;
    }
  };

  const logout = () => {
    revokeToken();
    persist(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, login, logout, isAuthenticated: !!user, isLoading }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
