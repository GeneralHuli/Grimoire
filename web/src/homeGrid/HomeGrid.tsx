import { useEffect, useRef, useState } from "react";
import { GRID_COLS, GRID_ROWS } from "./gridConfig";
import { DEFAULT_LAYOUT } from "./defaultLayout";
import { fits, firstFreeSlot, occupiedCells } from "./collision";
import { useGridDrag } from "./dragEngine";
import { WidgetCard } from "./WidgetCard";
import { WidgetDrawer } from "./WidgetDrawer";
import { HOME_WIDGET_VARIANTS } from "../spells/homeWidgets/registry";
import type { HomeWidgetVariant } from "../spells/homeWidgets/registry";
import { useView } from "../appState/ViewContext";
import type { PlacedWidget } from "./types";
import type { SpellManifest } from "../types";

interface HomeGridProps {
  spells: SpellManifest[];
}

function resolveVariant(widget: PlacedWidget): HomeWidgetVariant | null {
  const variants = HOME_WIDGET_VARIANTS[widget.spellName];
  if (!variants || variants.length === 0) return null;
  return variants.find((v) => v.id === widget.widgetId) ?? variants[0];
}

async function persistLayout(widgets: PlacedWidget[]) {
  await fetch("/api/settings/layout", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ widgets }),
  }).catch(() => {});
}

export function HomeGrid({ spells }: HomeGridProps) {
  const { openSpell } = useView();
  const [widgets, setWidgets] = useState<PlacedWidget[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/settings/layout")
      .then((res) => res.json())
      .then((data: { widgets?: PlacedWidget[] }) => {
        if (data.widgets && data.widgets.length > 0) {
          setWidgets(data.widgets);
        } else {
          setWidgets(DEFAULT_LAYOUT);
          persistLayout(DEFAULT_LAYOUT);
        }
        setLoaded(true);
      })
      .catch(() => {
        setWidgets(DEFAULT_LAYOUT);
        setLoaded(true);
      });
  }, []);

  function updateWidgets(next: PlacedWidget[]) {
    setWidgets(next);
    persistLayout(next);
  }

  const { dragState, startDrag } = useGridDrag({
    containerRef,
    widgets,
    onDrop: (spellName, x, y) => {
      updateWidgets(widgets.map((w) => (w.spellName === spellName ? { ...w, x, y } : w)));
    },
  });

  if (!loaded) {
    return <div className="home-grid-loading">Loading…</div>;
  }

  function cycleSize(widget: PlacedWidget) {
    const variants = HOME_WIDGET_VARIANTS[widget.spellName];
    if (!variants || variants.length < 2) return;
    const currentIndex = variants.findIndex((v) => v.id === widget.widgetId);
    const next = variants[(currentIndex + 1) % variants.length];
    const occupied = occupiedCells(widgets, widget.spellName);
    if (!fits(widget.x, widget.y, next.cols, next.rows, occupied)) return;
    updateWidgets(
      widgets.map((w) =>
        w.spellName === widget.spellName ? { ...w, widgetId: next.id, w: next.cols, h: next.rows } : w
      )
    );
  }

  function removeWidget(spellName: string) {
    updateWidgets(widgets.filter((w) => w.spellName !== spellName));
  }

  function addWidget(spellName: string) {
    const variants = HOME_WIDGET_VARIANTS[spellName];
    if (!variants || variants.length === 0) return;
    const variant = variants[0];
    const occupied = occupiedCells(widgets, spellName);
    const slot = firstFreeSlot(variant.cols, variant.rows, occupied);
    if (!slot) return;
    updateWidgets([
      ...widgets,
      { spellName, widgetId: variant.id, x: slot.x, y: slot.y, w: variant.cols, h: variant.rows },
    ]);
  }

  const placedSpellNames = new Set(widgets.map((w) => w.spellName));

  return (
    <div className="home-grid-wrapper">
      <div className="home-toolbar">
        {editMode && (
          <button className="btn" onClick={() => setDrawerOpen(true)}>
            + Add widget
          </button>
        )}
        <button className="btn btn-lg" onClick={() => setEditMode((v) => !v)}>
          {editMode ? "Done" : "Edit Layout"}
        </button>
      </div>
      <div
        ref={containerRef}
        className={`home-grid${editMode ? " edit-mode" : ""}`}
        style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`, gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)` }}
      >
        {editMode &&
          Array.from({ length: GRID_COLS * GRID_ROWS }, (_, i) => {
            const x = i % GRID_COLS;
            const y = Math.floor(i / GRID_COLS);
            const isTarget =
              dragState &&
              x >= dragState.targetX &&
              x < dragState.targetX + dragState.w &&
              y >= dragState.targetY &&
              y < dragState.targetY + dragState.h;
            const cellClass = isTarget ? (dragState!.valid ? " valid" : " invalid") : "";
            return <div key={i} className={`home-grid-cell${cellClass}`} style={{ gridColumn: x + 1, gridRow: y + 1 }} />;
          })}
        {widgets.map((widget) => {
          const variant = resolveVariant(widget);
          if (!variant) return null;
          const isDragging = dragState?.spellName === widget.spellName;
          return (
            <WidgetCard
              key={widget.spellName}
              widget={widget}
              variant={variant}
              editMode={editMode}
              onNavigate={() => openSpell(widget.spellName)}
              onRemove={() => removeWidget(widget.spellName)}
              onCycleSize={() => cycleSize(widget)}
              onStartDrag={(e) => startDrag(widget, e)}
              isDragging={isDragging}
              dragOffset={isDragging && dragState ? { x: dragState.offsetX, y: dragState.offsetY } : undefined}
            />
          );
        })}
      </div>
      {drawerOpen && (
        <WidgetDrawer
          spells={spells}
          placedSpellNames={placedSpellNames}
          onAdd={addWidget}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </div>
  );
}
