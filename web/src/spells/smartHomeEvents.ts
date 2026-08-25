import { useEffect, useRef } from "react";

export interface SmartHomeDeviceUpdate {
  entityId: string;
  domain: string;
  state: string;
  attributes: Record<string, unknown>;
}

export interface SmartHomeDoorbellEvent {
  entityId: string;
  name: string;
  cameraEntityId: string;
}

type DeviceListener = (update: SmartHomeDeviceUpdate) => void;
type DoorbellListener = (event: SmartHomeDoorbellEvent) => void;

/** One shared EventSource for the whole app -- the spell page, a home-dashboard glance
 * widget, and the global doorbell watcher can all be mounted at once, and each just adds
 * its own listener rather than opening a competing connection (EventSource auto-reconnects
 * on its own, so there's no backoff logic to duplicate either). */
let source: EventSource | null = null;
let refCount = 0;
const deviceListeners = new Set<DeviceListener>();
const doorbellListeners = new Set<DoorbellListener>();

function ensureSource() {
  if (source) return;
  source = new EventSource("/api/spells/smart-home/events");
  source.addEventListener("device-update", (e) => {
    const update = JSON.parse((e as MessageEvent).data) as SmartHomeDeviceUpdate;
    deviceListeners.forEach((fn) => fn(update));
  });
  source.addEventListener("doorbell", (e) => {
    const event = JSON.parse((e as MessageEvent).data) as SmartHomeDoorbellEvent;
    doorbellListeners.forEach((fn) => fn(event));
  });
}

function release() {
  refCount = Math.max(0, refCount - 1);
  if (refCount === 0 && source) {
    source.close();
    source = null;
  }
}

/** Subscribes to live device-state pushes for as long as the calling component is
 * mounted. `onUpdate` is read through a ref so passing a new inline callback each render
 * (the common case -- it usually closes over local state) doesn't tear down and reopen
 * the shared connection. */
export function useSmartHomeDeviceSync(onUpdate: DeviceListener): void {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    const listener: DeviceListener = (update) => onUpdateRef.current(update);
    ensureSource();
    refCount += 1;
    deviceListeners.add(listener);
    return () => {
      deviceListeners.delete(listener);
      release();
    };
  }, []);
}

export function useSmartHomeDoorbell(onDoorbell: DoorbellListener): void {
  const onDoorbellRef = useRef(onDoorbell);
  onDoorbellRef.current = onDoorbell;

  useEffect(() => {
    const listener: DoorbellListener = (event) => onDoorbellRef.current(event);
    ensureSource();
    refCount += 1;
    doorbellListeners.add(listener);
    return () => {
      doorbellListeners.delete(listener);
      release();
    };
  }, []);
}
