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

export function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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

export function RocketIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M13.5 4.5c3.6.3 5.7 2.4 6 6L14 16l-6.5 1.5L9 11 13.5 4.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M8 12 5 15M9.5 17l-2 2M13 7.5h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function TerminalIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="m8 10 2.5 2L8 14.5M12.5 14.5H16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AnalyticsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M4.5 19.5h15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7 16V11M12 16V7.5M17 16v-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="m6 8 4-3 4 2 4-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M6 5.5h9a3 3 0 0 1 3 3v10H9a3 3 0 0 0-3 3V5.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M6 18.5h12M9 9.5h6M9 13h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function ListIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <rect x="5.5" y="5.5" width="13" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 9h6M9 12h6M9 15h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="7.5" cy="9" r=".8" fill="currentColor" />
      <circle cx="7.5" cy="12" r=".8" fill="currentColor" />
      <circle cx="7.5" cy="15" r=".8" fill="currentColor" />
    </svg>
  );
}

export function InfoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 11.5v4M12 8.5h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function SettingsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 4.5v1.7M12 17.8v1.7M19.5 12h-1.7M6.2 12H4.5M17.3 6.7l-1.2 1.2M8 16l-1.3 1.3M17.3 17.3 16 16M8 8 6.7 6.7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SupportIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M9.7 9.5a2.5 2.5 0 1 1 4.6 1.3c-.6.8-1.5 1.2-1.9 2.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M12 16.5h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function ShieldIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M12 4.5 6.5 6.7v4.6c0 3.3 2 6.3 5.5 8.2 3.5-1.9 5.5-4.9 5.5-8.2V6.7L12 4.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="m9.6 12.1 1.7 1.7 3.2-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function FingerprintIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M9 9.5a3 3 0 0 1 6 0v1.5a8.5 8.5 0 0 1-3 6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6.8 10.5A5.2 5.2 0 0 1 17.2 10v1.8a11 11 0 0 1-4.2 8.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 6a6.7 6.7 0 0 1 6.7 6.7v1.4M4.8 12.5A7.2 7.2 0 0 1 12 5.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function LockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <rect x="6.5" y="11" width="11" height="8" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8.5 11V8.5a3.5 3.5 0 1 1 7 0V11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function PlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function ArrowLeftIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="m12 6-6 6 6 6M18 12H7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DownloadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M12 5v9M8.5 11.5 12 15l3.5-3.5M5 18.5h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ShareIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <circle cx="17.5" cy="6.5" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="6.5" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.5" cy="17.5" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m8.8 10.8 6.5-3.1M8.8 13.2l6.5 3.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function VerifiedIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M12 4.8 7.7 6.1 6.4 10.4 7.7 14.7 12 16l4.3-1.3 1.3-4.3-1.3-4.3L12 4.8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="m9.4 10.9 1.8 1.8 3.4-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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
