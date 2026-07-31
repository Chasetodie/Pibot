export default function Divider() {
  return (
    <div className="flex items-center justify-center gap-4 py-4" aria-hidden="true">
      <span className="h-px w-24 md:w-40 bg-gradient-to-r from-transparent to-pibot-gold/80" />
      <svg width="26" height="26" viewBox="0 0 28 28" className="text-pibot-gold shrink-0">
        <path
          d="M14 1 L16.5 10.5 L26 13 L16.5 15.5 L14 25 L11.5 15.5 L2 13 L11.5 10.5 Z"
          fill="currentColor"
        />
        <circle
          cx="14" cy="13" r="2.5"
          fill="var(--color-pibot-bg)"
          stroke="currentColor"
          strokeWidth="1"
        />
      </svg>
      <span className="h-px w-24 md:w-40 bg-gradient-to-l from-transparent to-pibot-gold/80" />
    </div>
  );
}