/** Keep in sync with styles/_variables.scss */

export const BREAKPOINT_MD = 768
export const BREAKPOINT_MOBILE_MAX = BREAKPOINT_MD - 1

export const MEDIA_MOBILE = `(max-width: ${BREAKPOINT_MOBILE_MAX}px)` as const
