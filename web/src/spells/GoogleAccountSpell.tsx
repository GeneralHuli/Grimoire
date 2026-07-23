import { GoogleAccountStatus } from "./googleAccount/GoogleAccountStatus";

export function GoogleAccountSpell() {
  return (
    <div className="spell-card">
      <h2>Google Account</h2>
      <GoogleAccountStatus />
    </div>
  );
}
