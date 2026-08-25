const STATE_TEXT: Record<string, string> = {
  playing: "Playing",
  paused: "Paused",
  idle: "Idle",
  off: "Off",
  buffering: "Buffering…",
  standby: "Standby",
  on: "On",
};

interface SmartHomeMediaPlayerControlProps {
  name: string;
  state: string;
  title?: string;
  artist?: string;
  supportsPause: boolean;
  supportsStop: boolean;
  /** null when the player doesn't report a volume level -- the slider is omitted rather
   * than shown stuck at 0. */
  volumePct: number | null;
  onPlayPause: () => void;
  onStop: () => void;
  onChangeVolume: (pct: number) => void;
  disabled?: boolean;
}

export function SmartHomeMediaPlayerControl({
  name,
  state,
  title,
  artist,
  supportsPause,
  supportsStop,
  volumePct,
  onPlayPause,
  onStop,
  onChangeVolume,
  disabled,
}: SmartHomeMediaPlayerControlProps) {
  const isPlaying = state === "playing";
  const canStop = state !== "idle" && state !== "off";

  return (
    <div className="smart-home-media">
      <div className="smart-home-media-name">{name}</div>
      {(title || artist) && (
        <div className="smart-home-media-track">
          {title && <div className="smart-home-media-title">{title}</div>}
          {artist && <div className="smart-home-media-artist">{artist}</div>}
        </div>
      )}
      <div className="smart-home-media-buttons">
        {supportsPause && (
          <button
            type="button"
            className={`btn btn-icon smart-home-media-btn${isPlaying ? " active" : ""}`}
            onClick={onPlayPause}
            disabled={disabled}
            aria-label={isPlaying ? `Pause ${name}` : `Play ${name}`}
          >
            {isPlaying ? "⏸" : "▶"}
          </button>
        )}
        {supportsStop && (
          <button
            type="button"
            className="btn btn-icon smart-home-media-btn"
            onClick={onStop}
            disabled={disabled || !canStop}
            aria-label={`Stop ${name}`}
          >
            ⏹
          </button>
        )}
      </div>
      {volumePct !== null && (
        <input
          type="range"
          className="smart-home-media-volume"
          min={0}
          max={100}
          value={volumePct}
          onChange={(e) => onChangeVolume(Number(e.target.value))}
          disabled={disabled}
          aria-label={`${name} volume`}
        />
      )}
      <div className="smart-home-media-state">{STATE_TEXT[state] ?? state}</div>
    </div>
  );
}
