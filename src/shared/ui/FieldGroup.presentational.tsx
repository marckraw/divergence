import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn.pure";

export interface FieldGroupProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}

function FieldGroup({ title, description, children, className, ...rest }: FieldGroupProps) {
  return (
    <section className={cn("space-y-3", className)} {...rest}>
      {title || description ? (
        <div>
          {title ? <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-subtext">{title}</h3> : null}
          {description ? <p className="mt-1 text-xs text-subtext">{description}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export default FieldGroup;
