const STATE_TEXT: Record<string, string> = {
  locked: "Locked",
  unlocked: "Unlocked",
  locking: "Locking…",
  unlocking: "Unlocking…",
  jammed: "Jammed",
};

interface SmartHomeLockControlProps {
  state: string;
  label: string;
  onToggle: () => void;
  disabled?: boolean;
}

export function SmartHomeLockControl({ state, label, onToggle, disabled }: SmartHomeLockControlProps) {
  const isUnlocked = state === "unlocked" || state === "unlocking";
  const isMoving = state === "locking" || state === "unlocking";
  const isJammed = state === "jammed";
  const stateClass = isJammed ? "jammed" : isUnlocked ? "unlocked" : "locked";
  const nextAction = state === "locked" ? "unlock" : "lock";

  return (
    <div className="smart-home-lock">
      <button
        type="button"
        className={`smart-home-lock-btn is-${stateClass}${isMoving ? " is-moving" : ""}`}
        onClick={onToggle}
        disabled={disabled || isMoving}
        aria-pressed={state === "locked"}
        aria-label={`${label}: ${STATE_TEXT[state] ?? state}, tap to ${nextAction}`}
      >
        <svg viewBox="0 0 64 64" className="smart-home-lock-icon" aria-hidden="true">
          {/* Two hand-drawn shackle shapes cross-fade on toggle -- both legs anchored at
              the body for "locked", right leg anchored with the left leg swung up and
              clear of the body for "unlocked". Animating between them with a CSS
              transform/rotation was error-prone to get the pivot and direction right;
              two fixed paths sidestep that entirely. */}
          <path
            className="smart-home-lock-shackle smart-home-lock-shackle-closed"
            d="M20 30 V20 a12 12 0 0 1 24 0 V30"
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            className="smart-home-lock-shackle smart-home-lock-shackle-open"
            d="M44 30 V20 a12 12 0 1 0 -23 -7"
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <rect className="smart-home-lock-body" x="14" y="28" width="36" height="26" rx="6" />
          <circle className="smart-home-lock-keyhole" cx="32" cy="38.5" r="3.2" />
          <rect className="smart-home-lock-keyhole" x="30.6" y="38.5" width="2.8" height="6.5" rx="1" />
        </svg>
      </button>
      <div className="smart-home-lock-label">{label}</div>
    </div>
  );
}
