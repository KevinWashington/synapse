import { createContext } from "react";
import { useAuthProvider } from "@features/auth/hooks/useAuthProvider";

const AuthContext = createContext(null);

const AuthProvider = ({ children }) => {
  const value = useAuthProvider();

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
export { AuthContext };
