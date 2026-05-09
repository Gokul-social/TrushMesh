import type { SVGProps } from "react";

export function NodeGraphIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <circle cx="6" cy="7" r="3" fill="currentColor" opacity="0.9" />
      <circle cx="18" cy="7" r="3" fill="currentColor" opacity="0.9" />
      <circle cx="12" cy="18" r="3.5" fill="currentColor" />
      <path
        d="M8.5 8.9 10.7 14M15.5 8.9 13.3 14M9 7h6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function RobotIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <rect x="5" y="7" width="14" height="11" rx="4" fill="currentColor" opacity="0.15" />
      <rect x="6.5" y="8.5" width="11" height="8" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="10" cy="12.5" r="1" fill="currentColor" />
      <circle cx="14" cy="12.5" r="1" fill="currentColor" />
      <path d="M12 4.5v2.3M10 15.5h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function PersonIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6.5 18c1.5-3 3.5-4.5 5.5-4.5s4 1.5 5.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="m6.5 12.5 3.5 3.5 7.5-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function WarningIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M12 4.5 20 18.5H4L12 4.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M12 9v4.5M12 16.5h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function CloseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="m7 7 10 10M17 7 7 17" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

export function ChevronRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DotIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 8 8" fill="currentColor" aria-hidden="true" {...props}>
      <circle cx="4" cy="4" r="4" />
    </svg>
  );
}
