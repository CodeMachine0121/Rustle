import type { LucideIcon } from "lucide-react";
import type { ComponentProps } from "react";

type IconButtonProps = Omit<ComponentProps<"button">, "children" | "aria-label" | "title" | "type"> & {
  /** What the button does; read out and shown as its tooltip, never drawn. */
  label: string;
  icon: LucideIcon;
};

/** A button that shows only a thin line icon in the colour of its text. */
export function IconButton({ label, icon: Icon, className, ...button }: IconButtonProps) {
  return (
    <button
      {...button}
      type="button"
      className={className === undefined ? "icon-button" : `icon-button ${className}`}
      aria-label={label}
      title={label}
    >
      <Icon className="icon" aria-hidden="true" />
    </button>
  );
}
