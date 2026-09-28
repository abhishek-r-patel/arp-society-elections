// Small "ⓘ" icon that shows a hint on hover/focus via the native title
// tooltip — used to keep format hints (flat number, phone) out of the form's
// normal flow instead of appearing as a permanent extra line under the input.
export default function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="info-icon" tabIndex={0} title={text} aria-label={text}>
      ℹ
    </span>
  );
}
