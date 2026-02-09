import { useEffect, useState } from "react";
import TaskCenterPagePresentational from "./TaskCenterPage.presentational";
import type { TaskCenterPageProps } from "./TaskCenterPage.types";

function TaskCenterPageContainer(props: TaskCenterPageProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  return <TaskCenterPagePresentational {...props} nowMs={nowMs} />;
}

export default TaskCenterPageContainer;
