const PATHS: Record<string, string> = {
  hair: 'M5 20c0-6 1-11 7-14 6 3 7 8 7 14M5 20c2-3 2-7 1-10M19 20c-2-3-2-7-1-10M9 20c0-4 1-7 3-9 2 2 3 5 3 9',
  eyebrows: 'M3 10c2-2.5 5-3 8-1.5M21 10c-2-2.5-5-3-8-1.5M5 16c1.5-1 3-1.3 5-.5M19 16c-1.5-1-3-1.3-5-.5',
  body: 'M8 4l4 2 4-2 4 3-2 4-2-1v11H8V10l-2 1-2-4z',
  arms: 'M6 4h5l2 7-2 9H8l-2-9zM11 11h5M9 20v1M13 20v1',
  legs: 'M7 3h10l-1 9 1 9h-4l-1-9-1 9H7l1-9z',
  feet: 'M7 4h6v8l6 3v4H4v-5l3-2z',
  accessory: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6.1L12 16.6 6.6 19.6l1.2-6.1L3.3 9.3l6.1-.7z',
}

export default function SlotIcon({ slotId }: { slotId: string }) {
  const d = PATHS[slotId] ?? 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z'
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}
