export function ActionIcon({ kind }: { kind: 'palette' | 'eraser' }) {
  return <svg className="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'palette' ? <>
      <path d="M12 3a9 9 0 1 0 0 18h1.2a2.3 2.3 0 0 0 1.7-3.8 1.7 1.7 0 0 1 1.3-2.8H18A3 3 0 0 0 21 11a9 9 0 0 0-9-8Z" />
      <circle cx="7" cy="10" r="1" /><circle cx="10" cy="6.8" r="1" />
      <circle cx="15" cy="7" r="1" /><circle cx="17.5" cy="10.5" r="1" />
    </> : <>
      <path d="m4 13 9-9a2 2 0 0 1 2.8 0l4.2 4.2a2 2 0 0 1 0 2.8l-9 9H7l-3-3a2.8 2.8 0 0 1 0-4Z" />
      <path d="m9 8 7 7M11 20h10" />
    </>}
  </svg>;
}
