/** Single place for admin-UI tunables. Mirrors worker/src/constants.ts's roster CSV column names. */

/** Shown as the voter page heading and the browser tab title (see main.tsx). Edit this to change the year/name. */
export const SITE_TITLE = 'Society Election';

export const STANDARD_POSITIONS = [
  'President',
  'Vice-President',
  'Secretary',
  'Joint Secretary',
  'Treasurer',
  'Joint Treasurer',
  'Communications',
];

export const MIN_SEATS_PER_POSITION = 1;
export const MAX_SEATS_PER_POSITION = 5;

export const FLAT_CSV_HEADERS = {
  FLAT_NO: 'flat_no',
} as const;

export const FLAT_CSV_TEMPLATE = `${FLAT_CSV_HEADERS.FLAT_NO}\n`;
