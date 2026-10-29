/** Fills `{name}` placeholders in a UI string; unknown placeholders are left as they are. */
export function format(text: string, params: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (match: string, key: string) => {
    const value = params[key];
    return value === undefined ? match : String(value);
  });
}
