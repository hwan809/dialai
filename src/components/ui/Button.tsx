import { CircleNotch } from "@phosphor-icons/react/dist/ssr";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "danger" | "primary" | "quiet" | "secondary";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly loading?: boolean;
  readonly leadingIcon?: ReactNode;
  readonly variant?: ButtonVariant;
};

export function Button({
  children,
  className = "",
  disabled,
  leadingIcon,
  loading = false,
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`ui-button ui-button--${variant} ${className}`.trim()}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading ? <CircleNotch className="ui-button__spinner" aria-hidden size={18} /> : leadingIcon}
      {children}
    </button>
  );
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly children: ReactNode;
  readonly label: string;
};

export function IconButton({
  children,
  className = "",
  label,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={`ui-icon-button ${className}`.trim()}
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </button>
  );
}
