import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type { HomeWidgetVariant } from "../spells/homeWidgets/registry";
import type { PlacedWidget } from "./types";

interface WidgetCardProps {
  widget: PlacedWidget;
  variant: HomeWidgetVariant;
  editMode: boolean;
  onNavigate: () => void;
  onRemove: () => void;
  onCycleSize: () => void;
  onStartDrag: (e: ReactPointerEvent) => void;
  isDragging: boolean;
  dragOffset?: { x: number; y: number };
}

export function WidgetCard({
  widget,
  variant,
  editMode,
  onNavigate,
  onRemove,
  onCycleSize,
  onStartDrag,
  isDragging,
  dragOffset,
}: WidgetCardProps) {
  const GlanceComponent = variant.component;

  const style: CSSProperties = {
    gridColumn: `${widget.x + 1} / span ${widget.w}`,
    gridRow: `${widget.y + 1} / span ${widget.h}`,
  };
  if (isDragging && dragOffset) {
    style.transform = `translate(${dragOffset.x}px, ${dragOffset.y}px)`;
    style.zIndex = 20;
  }

  return (
    <div
      className={`widget-card${editMode ? " edit-mode" : ""}${isDragging ? " dragging" : ""}`}
      style={style}
      onClick={editMode ? undefined : onNavigate}
      onPointerDown={editMode ? onStartDrag : undefined}
    >
      {editMode && (
        <div className="widget-card-controls">
          <button
            type="button"
            className="widget-card-cycle"
            onClick={(e) => {
              e.stopPropagation();
              onCycleSize();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={`Change ${widget.spellName} widget size`}
            title="Change size"
          >
            {variant.label}
          </button>
          <button
            type="button"
            className="widget-card-remove"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={`Remove ${widget.spellName} from home`}
          >
            ×
          </button>
        </div>
      )}
      <div className={`widget-card-body${editMode ? " inert" : ""}`}>
        <GlanceComponent />
      </div>
    </div>
  );
}
