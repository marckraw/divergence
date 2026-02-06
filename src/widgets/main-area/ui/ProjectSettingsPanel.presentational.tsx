import type { ReactNode } from "react";

interface ProjectSettingsPanelPresentationalProps {
  children: ReactNode;
}

function ProjectSettingsPanelPresentational({ children }: ProjectSettingsPanelPresentationalProps) {
  return <>{children}</>;
}

export default ProjectSettingsPanelPresentational;
