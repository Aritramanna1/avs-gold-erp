/**
 * Lightweight email document trigger — opens mailto with subject/body.
 * Full branded HTML email shell is reconstructed when print/comm parity wave runs.
 */
export function EmailDocumentButton(props: {
  subject: string;
  body: string;
  label?: string;
  className?: string;
}) {
  const href = `mailto:?subject=${encodeURIComponent(props.subject)}&body=${encodeURIComponent(props.body)}`;
  return (
    <a
      href={href}
      className={
        props.className ??
        "inline-flex h-8 items-center rounded-md border border-input bg-background px-3 text-xs"
      }
    >
      {props.label ?? "Email"}
    </a>
  );
}
