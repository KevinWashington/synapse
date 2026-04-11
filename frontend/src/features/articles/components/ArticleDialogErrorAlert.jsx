import { AlertTriangleIcon } from "lucide-react";

function ArticleDialogErrorAlert({ error }) {
  if (!error) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-red-700 dark:border-red-800 dark:bg-red-900 dark:text-red-200">
      <AlertTriangleIcon className="h-4 w-4" />
      <span className="text-sm">{error}</span>
    </div>
  );
}

export default ArticleDialogErrorAlert;
