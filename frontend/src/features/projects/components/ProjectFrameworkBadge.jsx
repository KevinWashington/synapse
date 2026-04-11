import { memo } from "react";
import { getFrameworkInfo } from "@/lib/frameworkConfig";

function ProjectFrameworkBadge({ framework = "PICOC", className = "" }) {
  const resolvedFramework = framework || "PICOC";
  const frameworkInfo = getFrameworkInfo(resolvedFramework);

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${className}`.trim()}
      style={{
        backgroundColor: frameworkInfo.badgeBg,
        color: frameworkInfo.badgeText,
      }}
    >
      {resolvedFramework}
    </span>
  );
}

export default memo(ProjectFrameworkBadge);

