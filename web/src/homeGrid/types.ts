/**
 * A Spell placed on the home grid. w/h are stored redundantly rather than re-derived
 * from HOME_WIDGET_VARIANTS at render time, so a saved layout stays renderable even if a
 * Spell's variant list changes later -- render-time only falls back to the registry's
 * declared size when widgetId no longer matches any variant.
 */
export interface PlacedWidget {
  spellName: string;
  widgetId: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface HomeLayout {
  widgets: PlacedWidget[];
}
