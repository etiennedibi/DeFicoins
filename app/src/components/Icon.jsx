/* One inline SVG sprite. Icons inherit currentColor and size from `size`,
   so a single set covers the header, action row and list rows. */

const PATHS = {
  arrowUp:    'M12 19V5M5 12l7-7 7 7',
  arrowDown:  'M12 5v14M19 12l-7 7-7-7',
  swap:       'M7 4 3 8l4 4M3 8h13M17 20l4-4-4-4M21 16H8',
  clock:      'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  plus:       'M12 5v14M5 12h14',
  back:       'M15 19l-7-7 7-7',
  chevron:    'M9 5l7 7-7 7',
  chevronDown:'M6 9l6 6 6-6',
  close:      'M18 6 6 18M6 6l12 12',
  search:     'M21 21l-4.3-4.3M17 11a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z',
  copy:       'M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1ZM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1',
  share:      'M12 3v13M8 7l4-4 4 4M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4',
  check:      'M4 12.5 9 17.5 20 6.5',
  eye:        'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z',
  eyeOff:     'M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.4 5.3A9.9 9.9 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.2 6.2A17 17 0 0 0 2 12s3.6 7 10 7c1.3 0 2.4-.2 3.5-.6',
  refresh:    'M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5',
  bell:       'M18 9a6 6 0 0 0-12 0c0 6-2 7-2 7h16s-2-1-2-7M13.7 20a2 2 0 0 1-3.4 0',
  headset:    'M4 14v-2a8 8 0 0 1 16 0v2M4 14a2 2 0 0 0 2 2h1v-5H6a2 2 0 0 0-2 2Zm16 0a2 2 0 0 1-2 2h-1v-5h1a2 2 0 0 1 2 2Zm-2 4v.5a2.5 2.5 0 0 1-2.5 2.5H13',
  settings:   'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  lock:       'M7 11V8a5 5 0 0 1 10 0v3M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z',
  mail:       'M3 7l9 6 9-6M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  user:       'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0',
  key:        'M15 7a4 4 0 1 1-3.5 5.9L4 20.4V21H2v-3l8.1-8.1A4 4 0 0 1 15 7Z',
  shield:     'M12 3l8 3v6c0 5-3.4 8.2-8 9-4.6-.8-8-4-8-9V6l8-3Z',
  info:       'M12 11v5M12 8h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  warn:       'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  logout:     'M15 17l5-5-5-5M20 12H9M12 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6',
  send:       'M21 3 10.5 13.5M21 3l-6.5 18-4-8-8-4L21 3Z',
  wallet:     'M19 8V6a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6M17 13h.01',
  grid:       'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  users:      'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  chart:      'M3 3v18h18M7 15l4-5 3 3 5-7',
};

/* A couple of icons need a filled dot or extra geometry rather than a stroke. */
const EXTRA = {
  eye: <circle cx="12" cy="12" r="3" />,
  settings: (
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 8.9 19a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 5 8.9a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9.5a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  ),
};

export default function Icon({ name, size = 22, strokeWidth = 1.9, className, ...rest }) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      <path d={d} />
      {EXTRA[name]}
    </svg>
  );
}

/* The brand mark, for the unlock screen and the admin header. */
export function Logo({ size = 64 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="DeFicoins">
      <defs>
        <linearGradient id="dfLogo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22D3EE" />
          <stop offset="55%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#4F46E5" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#dfLogo)" />
      <g fill="#fff">
        <path
          fillRule="evenodd"
          d="M16 12h16a20 20 0 0 1 0 40H16a4 4 0 0 1-4-4V16a4 4 0 0 1 4-4Zm16 9a11 11 0 0 0 0 22 11 11 0 0 0 0-22Z"
        />
        <path d="M32 25.5l5.6 3.25v6.5L32 38.5l-5.6-3.25v-6.5z" />
      </g>
    </svg>
  );
}
