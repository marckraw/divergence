import type { ReactNode } from "react";
import PanelHeader from "./PanelHeader.presentational";
import PanelToolbar from "./PanelToolbar.presentational";

export interface FilterHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  toolbar?: ReactNode;
}

function FilterHeader({ title, description, actions, toolbar }: FilterHeaderProps) {
  return (
    <>
      <PanelHeader title={title} description={description} actions={actions} />
      {toolbar ? <PanelToolbar>{toolbar}</PanelToolbar> : null}
    </>
  );
}

export default FilterHeader;
