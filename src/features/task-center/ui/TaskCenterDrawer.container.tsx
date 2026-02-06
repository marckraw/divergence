import { useEffect, useState } from "react";
import TaskCenterDrawerPresentational from "./TaskCenterDrawer.presentational";
import type { TaskCenterDrawerProps } from "./TaskCenterDrawer.types";

function TaskCenterDrawerContainer(props: TaskCenterDrawerProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  return <TaskCenterDrawerPresentational {...props} nowMs={nowMs} />;
}

export default TaskCenterDrawerContainer;
