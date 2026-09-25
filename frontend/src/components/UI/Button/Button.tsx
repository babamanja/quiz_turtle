import type { ButtonHTMLAttributes, ReactNode } from "react";

import { joinClassNames } from "../joinClassNames";
import "../style.scss";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  style?: "primary" | "secondary" | "success" | "danger" | "borderless";
};

export default function Button({
  children,
  type = "button",
  style = "primary",
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={joinClassNames("button", `button--${style}`, className)}
      {...rest}
    >
      {children}
    </button>
  );
}
