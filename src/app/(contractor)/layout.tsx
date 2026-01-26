/**
 * Contractor Portal Layout
 *
 * WHY: Wrapper for contractor portal pages.
 * WHEN: All pages under /contractor route.
 * HOW: Simple wrapper that renders children.
 */

export default function ContractorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
