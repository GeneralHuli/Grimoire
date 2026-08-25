import { useState } from "react";
import { SmartHomeCameraModal } from "../spells/SmartHomeCameraModal";
import { useSmartHomeDoorbell, type SmartHomeDoorbellEvent } from "../spells/smartHomeEvents";

const AUTO_CLOSE_MS = 5 * 60 * 1000;

/** Mounted app-wide (see App.tsx) rather than only inside the Smart Home Spell page --
 * a ring should pop the live feed no matter which Spell the user is currently looking
 * at. Each ring bumps `nonce` so the modal remounts (and its auto-close timer restarts)
 * even if it's the same doorbell/camera ringing again while already open. */
export function SmartHomeDoorbell() {
  const [ring, setRing] = useState<{ event: SmartHomeDoorbellEvent; nonce: number } | null>(null);

  useSmartHomeDoorbell((event) => {
    setRing((prev) => ({ event, nonce: (prev?.nonce ?? 0) + 1 }));
  });

  if (!ring) return null;

  return (
    <SmartHomeCameraModal
      key={ring.nonce}
      entityId={ring.event.cameraEntityId}
      name={ring.event.name}
      title={`Ring: ${ring.event.name}`}
      autoCloseMs={AUTO_CLOSE_MS}
      onClose={() => setRing(null)}
    />
  );
}
