export async function triggerMatching(briefId: string): Promise<{ matchingJobId: string }> {
  // TODO(Fase 2): enqueue real Matcher run. No-op stub for Slice 1a.
  void briefId;
  return { matchingJobId: crypto.randomUUID() };
}
