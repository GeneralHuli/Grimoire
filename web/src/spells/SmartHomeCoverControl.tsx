interface SmartHomeCoverControlProps {
  name: string;
  state: string;
  canStop: boolean;
  onOpen: () => void;
  onClose: () => void;
  onStop: () => void;
  disabled?: boolean;
}

export function SmartHomeCoverControl({ name, state, canStop, onOpen, onClose, onStop, disabled }: SmartHomeCoverControlProps) {
  const isOpening = state === "opening";
  const isClosing = state === "closing";
  const isOpen = state === "open" || isOpening;

  return (
    <div className="smart-home-cover">
      <div className="smart-home-cover-group">
        <button
          type="button"
          className={`btn btn-icon smart-home-cover-btn${isOpening ? " active" : ""}`}
          onClick={onOpen}
          disabled={disabled || isOpen}
          aria-label={`Open ${name}`}
        >
          ▲
        </button>
        {canStop && (
          <button
            type="button"
            className="btn btn-icon smart-home-cover-btn"
            onClick={onStop}
            disabled={disabled || (!isOpening && !isClosing)}
            aria-label={`Stop ${name}`}
          >
            ■
          </button>
        )}
        <button
          type="button"
          className={`btn btn-icon smart-home-cover-btn${isClosing ? " active" : ""}`}
          onClick={onClose}
          disabled={disabled || (!isOpen && !isClosing)}
          aria-label={`Close ${name}`}
        >
          ▼
        </button>
      </div>
      <div className="smart-home-cover-label">{name}</div>
      <div className="smart-home-cover-state">
        {isOpening ? "Opening…" : isClosing ? "Closing…" : isOpen ? "Open" : "Closed"}
      </div>
    </div>
  );
}
