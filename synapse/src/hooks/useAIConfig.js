import { useContext } from "react";
import { AIConfigContext } from "../context/aiConfigContext.js";

export const useAIConfig = () => {
  const context = useContext(AIConfigContext);
  if (!context) {
    throw new Error("useAIConfig deve ser usado dentro de um AIConfigProvider");
  }
  return context;
};
