import { Settings } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { SmartHomeDeviceTile } from "./SmartHomeDeviceTile";
import { SmartHomeGlanceDrawer } from "./SmartHomeGlanceDrawer";
import { createSmartHomeActions, type SmartHomeArea, type SmartHomeDevice, type UpdateSmartHomeDevice } from "./smartHomeActions";
import { createSmartHomeGroupActions } from "./smartHomeGroupActions";
import { buildGroupDevice, groupDisplayName, groupNameFromId, parseGroupControlId, resolveGroupMembers } from "./smartHomeGroups";
import { useSmartHomeDeviceSync } from "./smartHomeEvents";
import {
  SMART_HOME_GRID_COLS,
  SMART_HOME_GRID_ROWS,
  PICKABLE_DOMAINS,
  controlGridSize,
  type SmartHomeGridPlacement,
} from "./smartHomeGrid";
import { useSmartHomeGridDrag, type PlacedControl } from "./smartHomeGridDrag";
import { useSmartHomeGridInsertDrag } from "./smartHomeGridInsertDrag";

/** The pixel size of one cell a control's dimensions (widths/heights in
 * SmartHome*Control.tsx) were designed against -- actual cells are almost always a
 * different size (the grid always fills its container, see cellPx below), so every
 * control gets `transform: scale(cellPx / BASELINE_CELL_PX)` to match. */
const BASELINE_CELL_PX = 104;

interface DomainSummary {
  domain: string;
  onCount: number;
  totalCount: number;
}

const DOMAIN_LABELS: Record<string, string> = {
  light: "lights",
  switch: "switches",
  fan: "fans",
  lock: "locked",
  cover: "open",
  media_player: "playing",
};

/** Bursty updates (a bulk "All off" touches every light at once) shouldn't each trigger
 * their own re-fetch -- collapse them into one refresh shortly after the burst settles. */
const SUMMARY_REFRESH_DEBOUNCE_MS = 400;

export function SmartHomeSummaryGlance() {
  const [summary, setSummary] = useState<DomainSummary[] | null>(null);
  const [connected, setConnected] = useState(true);

  const loadSummary = useCallback(() => {
    fetch("/api/spells/smart-home/summary")
      .then(async (res) => {
        if (!res.ok) {
          setConnected(false);
          return;
        }
        const data = (await res.json()) as { summary: DomainSummary[] };
        setSummary(data.summary);
      })
      .catch(() => setConnected(false));
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const refreshTimer = useRef<number | null>(null);
  useSmartHomeDeviceSync(() => {
    if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(loadSummary, SUMMARY_REFRESH_DEBOUNCE_MS);
  });

  if (!connected) return <p className="glance-empty">Connect Home Assistant in Settings</p>;
  if (!summary) return <p className="glance-empty">Loading…</p>;
  if (summary.length === 0) return <p className="glance-empty">No devices found</p>;

  return (
    <ul className="glance-list">
      {summary.map((s) => (
        <li key={s.domain} className="glance-list-row">
          <span className="glance-list-title">
            {s.onCount} {DOMAIN_LABELS[s.domain] ?? s.domain}
          </span>
          <span className="glance-list-meta">of {s.totalCount}</span>
        </li>
      ))}
    </ul>
  );
}

async function persistGlanceLayout(layout: SmartHomeGridPlacement[]) {
  await fetch("/api/settings/smart-home", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ glanceLayout: layout }),
  }).catch(() => {});
}

function pickDrawerEdge(rect: DOMRect): "left" | "right" | "top" | "bottom" {
  const spaceRight = window.innerWidth - rect.right;
  const spaceLeft = rect.left;
  const spaceBottom = window.innerHeight - rect.bottom;
  const spaceTop = rect.top;
  const max = Math.max(spaceRight, spaceLeft, spaceBottom, spaceTop);
  if (max === spaceRight) return "right";
  if (max === spaceLeft) return "left";
  if (max === spaceBottom) return "bottom";
  return "top";
}

/**
 * Shows the exact same controls as the full Smart Home Spell view, restricted to
 * whichever devices are on the compact view, arranged on its own small grid
 * (independent of the home dashboard's outer grid) sized to always fill its widget card
 * with no scrolling -- SMART_HOME_GRID_COLS x SMART_HOME_GRID_ROWS tracks are `1fr` each,
 * and a ResizeObserver-measured `cellPx` drives both the drag math and a uniform
 * transform:scale() on each control so it fits its allocated cell(s) regardless of how
 * large or small the widget card ends up being. A gear icon opens a slide-out drawer
 * (SmartHomeGlanceDrawer) listing every controllable device not yet on the grid --
 * dragging one out of the drawer and onto the grid places it there.
 */
export function SmartHomeBoardGlance() {
  const [devices, setDevices] = useState<SmartHomeDevice[] | null>(null);
  const [areas, setAreas] = useState<SmartHomeArea[]>([]);
  const [glanceLayout, setGlanceLayout] = useState<SmartHomeGridPlacement[] | null>(null);
  const [connected, setConnected] = useState(true);
  const [colorPickerFor, setColorPickerFor] = useState<string | null>(null);
  const [drawerEdge, setDrawerEdge] = useState<"left" | "right" | "top" | "bottom" | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [cellPx, setCellPx] = useState(BASELINE_CELL_PX);

  useEffect(() => {
    Promise.all([
      fetch("/api/spells/smart-home/devices"),
      fetch("/api/settings/smart-home"),
      fetch("/api/spells/smart-home/areas"),
    ])
      .then(async ([devicesRes, settingsRes, areasRes]) => {
        if (!devicesRes.ok) {
          setConnected(false);
          return;
        }
        const devicesData = (await devicesRes.json()) as { devices: SmartHomeDevice[] };
        const settingsData = (await settingsRes.json()) as { glanceLayout?: SmartHomeGridPlacement[] };
        setDevices(devicesData.devices);
        setGlanceLayout(settingsData.glanceLayout ?? []);
        setAreas(areasRes.ok ? ((await areasRes.json()) as { areas: SmartHomeArea[] }).areas : []);
      })
      .catch(() => setConnected(false));
  }, []);

  /** Gates the ResizeObserver effect below -- the grid div (and gridRef) doesn't exist in
   * the DOM until the devices/settings fetch resolves (see the "Loading…" early return),
   * so an effect with a `[]` dependency array would run once against a still-null ref and
   * never fire again, leaving cellPx (and every control's scale) stuck at its initial
   * value forever. */
  const gridReady = devices !== null && glanceLayout !== null;

  useEffect(() => {
    const grid = gridRef.current;
    if (!gridReady || !grid) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect || rect.width <= 0 || rect.height <= 0) return;
      setCellPx(Math.min(rect.width / SMART_HOME_GRID_COLS, rect.height / SMART_HOME_GRID_ROWS));
    });
    observer.observe(grid);
    return () => observer.disconnect();
  }, [gridReady]);

  const updateDevice = useMemo<UpdateSmartHomeDevice>(
    () => (entityId, patch) => {
      setDevices(
        (prev) =>
          prev?.map((d) => (d.entityId === entityId ? { ...d, ...(typeof patch === "function" ? patch(d) : patch) } : d)) ??
          prev
      );
    },
    []
  );

  const actions = useMemo(() => createSmartHomeActions(updateDevice), [updateDevice]);

  // Keeps the board's tiles in sync with changes made outside this widget -- another
  // Grimoire view, the Home Assistant app, or a physical switch.
  useSmartHomeDeviceSync((update) => {
    updateDevice(update.entityId, { state: update.state, attributes: update.attributes });
  });

  function updateLayout(next: SmartHomeGridPlacement[]) {
    setGlanceLayout(next);
    persistGlanceLayout(next);
  }

  function removeFromGlance(entityId: string) {
    updateLayout((glanceLayout ?? []).filter((p) => p.entityId !== entityId));
  }

  function toggleDrawer() {
    if (drawerEdge !== null) {
      setDrawerEdge(null);
      return;
    }
    const rect = boardRef.current?.getBoundingClientRect();
    setDrawerEdge(rect ? pickDrawerEdge(rect) : "right");
  }

  const placed: (PlacedControl & { device: SmartHomeDevice; group: boolean; members: SmartHomeDevice[] })[] = useMemo(() => {
    if (!devices || !glanceLayout) return [];
    const result: (PlacedControl & { device: SmartHomeDevice; group: boolean; members: SmartHomeDevice[] })[] = [];
    for (const p of glanceLayout) {
      const groupInfo = parseGroupControlId(p.entityId);
      if (groupInfo) {
        const members = resolveGroupMembers(groupInfo.areaId, groupInfo.domain, devices, areas);
        if (members.length === 0) continue;
        const areaName = groupInfo.areaId === null ? "Home" : (areas.find((a) => a.id === groupInfo.areaId)?.name ?? "Home");
        const device = buildGroupDevice(p.entityId, groupDisplayName(groupInfo.areaId, areaName, groupInfo.domain), groupInfo.domain, members);
        const { w, h } = controlGridSize(device);
        result.push({ entityId: p.entityId, x: p.x, y: p.y, w, h, device, group: true, members });
        continue;
      }
      const device = devices.find((d) => d.entityId === p.entityId);
      if (!device) continue;
      const { w, h } = controlGridSize(device);
      result.push({ entityId: p.entityId, x: p.x, y: p.y, w, h, device, group: false, members: [] });
    }
    return result;
  }, [devices, glanceLayout, areas]);

  const placedIds = useMemo(() => new Set((glanceLayout ?? []).map((p) => p.entityId)), [glanceLayout]);

  const availableDevices = useMemo(() => {
    if (!devices || !glanceLayout) return [];
    return devices.filter((d) => PICKABLE_DOMAINS.has(d.domain) && !placedIds.has(d.entityId));
  }, [devices, glanceLayout, placedIds]);

  const { dragState, startDrag } = useSmartHomeGridDrag({
    cellSize: cellPx,
    items: placed,
    onDrop: (entityId, x, y) => {
      updateLayout((glanceLayout ?? []).map((p) => (p.entityId === entityId ? { ...p, x, y } : p)));
    },
  });

  const { dragState: insertDragState, startDrag: startInsertDrag } = useSmartHomeGridInsertDrag({
    gridRef,
    cellSize: cellPx,
    items: placed,
    onDrop: (entityId, x, y) => {
      updateLayout([...(glanceLayout ?? []), { entityId, x, y }]);
    },
  });

  if (!connected) return <p className="glance-empty">Connect Home Assistant in Settings</p>;
  if (!devices || glanceLayout === null) return <p className="glance-empty">Loading…</p>;

  const scale = cellPx / BASELINE_CELL_PX;
  const editMode = drawerEdge !== null;
  const activeTarget = dragState
    ? { x: dragState.targetX, y: dragState.targetY, w: dragState.w, h: dragState.h, valid: dragState.valid }
    : insertDragState && insertDragState.targetX !== null && insertDragState.targetY !== null
      ? { x: insertDragState.targetX, y: insertDragState.targetY, w: insertDragState.w, h: insertDragState.h, valid: insertDragState.valid }
      : null;
  const insertDragName = insertDragState
    ? (devices.find((d) => d.entityId === insertDragState.entityId)?.name ?? groupNameFromId(insertDragState.entityId, areas) ?? undefined)
    : undefined;

  return (
    <div
      ref={boardRef}
      className="smart-home-glance-board"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="smart-home-glance-toolbar">
        <button
          type="button"
          className={`btn btn-icon smart-home-glance-gear${editMode ? " active" : ""}`}
          onClick={toggleDrawer}
          aria-label={editMode ? "Close compact view editor" : "Edit compact view"}
          aria-pressed={editMode}
        >
          <Settings />
        </button>
      </div>
      <div
        ref={gridRef}
        className="smart-home-glance-grid"
        style={{
          gridTemplateColumns: `repeat(${SMART_HOME_GRID_COLS}, 1fr)`,
          gridTemplateRows: `repeat(${SMART_HOME_GRID_ROWS}, 1fr)`,
        }}
      >
        {placed.length === 0 && !editMode && (
          <p className="glance-empty">
            Choose devices to show here -- tap <Settings size={14} style={{ verticalAlign: -2 }} /> to add some
          </p>
        )}
        {editMode &&
          Array.from({ length: SMART_HOME_GRID_COLS * SMART_HOME_GRID_ROWS }, (_, i) => {
            const x = i % SMART_HOME_GRID_COLS;
            const y = Math.floor(i / SMART_HOME_GRID_COLS);
            const isTarget = activeTarget && x >= activeTarget.x && x < activeTarget.x + activeTarget.w && y >= activeTarget.y && y < activeTarget.y + activeTarget.h;
            const cellClass = isTarget ? (activeTarget!.valid ? " valid" : " invalid") : "";
            return <div key={i} className={`smart-home-glance-cell${cellClass}`} style={{ gridColumn: x + 1, gridRow: y + 1 }} />;
          })}
        {colorPickerFor !== null && (
          <div className="smart-home-color-picker-backdrop" onClick={() => setColorPickerFor(null)} aria-hidden="true" />
        )}
        {placed.map((control) => {
          const isDragging = dragState?.entityId === control.entityId;
          const style: CSSProperties = {
            gridColumn: `${control.x + 1} / span ${control.w}`,
            gridRow: `${control.y + 1} / span ${control.h}`,
          };
          if (isDragging && dragState) {
            style.transform = `translate(${dragState.offsetX}px, ${dragState.offsetY}px)`;
            style.zIndex = 20;
          }
          return (
            <div
              key={control.entityId}
              className={`smart-home-glance-tile${editMode ? " edit-mode" : ""}${isDragging ? " dragging" : ""}`}
              style={style}
              onPointerDown={editMode ? (e) => startDrag(control, e) : undefined}
            >
              {editMode && (
                <button
                  type="button"
                  className="smart-home-glance-tile-remove"
                  onClick={() => removeFromGlance(control.entityId)}
                  onPointerDown={(e) => e.stopPropagation()}
                  aria-label={`Remove ${control.device.name} from the compact view`}
                >
                  ×
                </button>
              )}
              <div
                className={`smart-home-glance-tile-content${editMode ? " inert" : ""}`}
                style={{
                  width: `${BASELINE_CELL_PX * control.w}px`,
                  height: `${BASELINE_CELL_PX * control.h}px`,
                  transform: `scale(${scale})`,
                }}
              >
                <SmartHomeDeviceTile
                  device={control.device}
                  actions={control.group ? createSmartHomeGroupActions(control.members, updateDevice) : actions}
                  colorPickerFor={colorPickerFor}
                  onOpenColorPicker={setColorPickerFor}
                  compact
                />
              </div>
            </div>
          );
        })}
      </div>
      {editMode && drawerEdge && (
        <SmartHomeGlanceDrawer
          edge={drawerEdge}
          allDevices={devices}
          availableDevices={availableDevices}
          areas={areas}
          placedIds={placedIds}
          onStartDragChip={(device, e) => startInsertDrag({ entityId: device.entityId, ...controlGridSize(device) }, e)}
          onClose={() => setDrawerEdge(null)}
        />
      )}
      {insertDragState && insertDragName && (
        <div
          className={`smart-home-glance-insert-ghost${insertDragState.valid ? " valid" : ""}`}
          style={{ left: insertDragState.clientX, top: insertDragState.clientY }}
        >
          {insertDragName}
        </div>
      )}
    </div>
  );
}
