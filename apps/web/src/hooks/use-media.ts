import * as React from 'react'

export function useMediaQuery(q: string) {
  const [m, setM] = React.useState(() => (typeof window !== 'undefined' ? matchMedia(q).matches : false))
  React.useEffect(() => {
    const mq = matchMedia(q)
    const fn = () => setM(mq.matches)
    fn()
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [q])
  return m
}
/** Phones and small tablets: below the md breakpoint. */
export const useIsMobile = () => useMediaQuery('(max-width: 767px)')
