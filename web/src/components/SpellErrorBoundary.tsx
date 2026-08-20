import { Component } from "react";
import type { ReactNode } from "react";

/**
 * A Spell is organizational, not process-isolated (see ARCHITECTURE.md) — but a bug in
 * one Spell's render should still never blank the whole dashboard for every other Spell.
 * This is the render-time analog of handleErrors on the backend: contain the failure to
 * the one card/view that threw.
 */
export class SpellErrorBoundary extends Component<{ name: string; children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(`[${this.props.name} Spell]`, error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="spell-card">
          <h2>{this.props.name}</h2>
          <p>This Spell hit an error and couldn't render.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
