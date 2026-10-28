/** A confirmation that states what the action will cause, for example how many re-checks. */
export function Toast({ message }: { message: string | null }) {
  if (message === null) return null;
  return (
    <p
      role="status"
      data-testid="toast"
      className="fixed inset-x-4 bottom-4 z-20 rounded-md bg-slate-900 px-4 py-3 text-white shadow-lg"
    >
      {message}
    </p>
  );
}
