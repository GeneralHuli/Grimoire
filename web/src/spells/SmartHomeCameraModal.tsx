import { useEffect, useRef } from "react";

interface SmartHomeCameraModalProps {
  entityId: string;
  name: string;
  /** Overrides the modal's heading -- used by the doorbell popup ("Ring: <name>")
   * instead of just the camera's own name. */
  title?: string;
  /** Auto-closes after this many ms unless the user closes it first -- used by the
   * doorbell popup (5 minutes). Omitted for a manual "Expand" open, which stays open
   * until dismissed. */
  autoCloseMs?: number;
  onClose: () => void;
}

/** Full-size live MJPEG feed for one camera -- shared by a room card's "Expand" button
 * and the global doorbell-ring popup (SmartHomeDoorbell). */
export function SmartHomeCameraModal({ entityId, name, title, autoCloseMs, onClose }: SmartHomeCameraModalProps) {
  // Read through a ref rather than depending on `onClose` directly -- it's a fresh
  // closure every render (setRing(null) inline in the doorbell watcher), and depending
  // on it would re-run this effect (resetting the 5-minute countdown) on every unrelated
  // parent re-render, not just a real ring.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!autoCloseMs) return;
    const timer = window.setTimeout(() => onCloseRef.current(), autoCloseMs);
    return () => window.clearTimeout(timer);
  }, [entityId, autoCloseMs]);

  const src = `/api/spells/smart-home/devices/${encodeURIComponent(entityId)}/stream`;

  return (
    <div className="smart-home-camera-modal-backdrop" onClick={onClose}>
      <div className="smart-home-camera-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-actions">
          <h3 className="modal-actions-title">{title ?? name}</h3>
          <button type="button" className="btn btn-icon" onClick={onClose} aria-label="Close live feed">
            ✕
          </button>
        </div>
        <img src={src} alt={name} className="smart-home-camera-modal-img" />
      </div>
    </div>
  );
}
