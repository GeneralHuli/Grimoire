import type { ReactNode } from "react";

interface SmartHomeSwitchToggleProps {
  checked: boolean;
  label: string;
  icon?: ReactNode;
  onToggle: () => void;
  disabled?: boolean;
}

export function SmartHomeSwitchToggle({ checked, label, icon, onToggle, disabled }: SmartHomeSwitchToggleProps) {
  return (
    <button
      type="button"
      className={`smart-home-switch${checked ? " on" : ""}`}
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={checked}
    >
      <span className="smart-home-switch-track" aria-hidden="true">
        <span className="smart-home-switch-knob" />
      </span>
      <span className="smart-home-switch-label">
        {icon}
        {label}
      </span>
    </button>
  );
}
