export function EmptyThread() {
  return (
    <section
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 8,
        color: 'var(--text-2)',
      }}
    >
      <p style={{ fontSize: '1.1rem' }}>Select a conversation</p>
      <p style={{ fontSize: '0.85rem' }}>
        Choose a chat on the left, or accept a contact request to start a new one.
      </p>
    </section>
  );
}
