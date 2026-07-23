import { GoogleAccountStatus } from "./googleAccount/GoogleAccountStatus";

export function GoogleAccountSettings() {
  return (
    <div className="settings-panel">
      <p>Shared sign-in used by Family Calendar and Chores.</p>
      <GoogleAccountStatus />
    </div>
  );
}
