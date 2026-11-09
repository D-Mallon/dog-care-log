/**
 * Release 1 free plan: one dog. Premium households are unlimited.
 *
 * `planKnown` is false while billing is still loading (or if it failed). In
 * that case the UI stays permissive; the database RLS policy is the final
 * enforcement point.
 */
export function canAddAnotherDog(
  isEntitled: boolean,
  dogCount: number,
  planKnown = true,
): boolean {
  if (!planKnown) return true;
  return isEntitled || dogCount === 0;
}
