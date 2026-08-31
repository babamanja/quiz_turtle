import type { HTMLAttributes, ReactNode } from "react";

import { joinClassNames } from "./joinClassNames";
import "./layout.scss";

type CardVariant = "default" | "flat" | "stat";
type CardPadding = "default" | "none" | "compact";

type CardProps = {
  children: ReactNode;
  variant?: CardVariant;
  padding?: CardPadding;
  className?: string;
} & Omit<HTMLAttributes<HTMLDivElement>, "className">;

export default function Card({
  children,
  variant = "default",
  padding = "default",
  className,
  ...rest
}: CardProps) {
  return (
    <div
      className={joinClassNames(
        "card",
        variant !== "default" && `card--${variant}`,
        padding !== "default" && `card--padding-${padding}`,
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
