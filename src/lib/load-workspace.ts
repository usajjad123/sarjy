// Share the initial fetch across React Strict Mode's repeated effect setup.
// It prevents creating two anonymous accounts before the first session cookie arrives.
let pending: Promise<Record<string, unknown>> | null = null;
export function loadWorkspace(timezone: string) {
  return pending ??= fetch(`/api/workspace?timezone=${encodeURIComponent(timezone)}`, { cache: "no-store" }).then(async (response) => {
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Could not load your nutrition records");
    return body;
  }).finally(() => { pending = null; });
}
