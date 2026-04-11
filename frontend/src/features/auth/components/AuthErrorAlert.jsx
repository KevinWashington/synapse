import { AlertCircle } from "lucide-react";

function AuthErrorAlert({ error }) {
  if (!error) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
      <AlertCircle className="h-4 w-4" />
      <span>{error}</span>
    </div>
  );
}

export default AuthErrorAlert;
