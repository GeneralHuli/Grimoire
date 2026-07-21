import { useEffect, useState } from "react";

export function HelloSpell() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/spells/hello-spell")
      .then((res) => res.json())
      .then((data: { message: string }) => setMessage(data.message));
  }, []);

  return (
    <div className="spell-card">
      <h2>Hello Spell</h2>
      <p>{message ?? "Loading…"}</p>
    </div>
  );
}
