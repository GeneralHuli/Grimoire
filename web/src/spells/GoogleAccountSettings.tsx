import { GoogleAccountStatus } from "./googleAccount/GoogleAccountStatus";

export function GoogleAccountSettings() {
  return (
    <div className="settings-panel">
      <h3>Google Account</h3>
      <p>Shared sign-in used by Family Calendar (and future Spells like Chores).</p>
      <GoogleAccountStatus />
    </div>
  );
}
