import * as React from "react"

const MOBILE_BREAKPOINT = 768

const query = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

/**
 * Indica se a viewport está abaixo do breakpoint de mobile.
 *
 * Usa `useSyncExternalStore` em vez de `useState` + effect: o matchMedia é
 * justamente um sistema externo, e a subscription evita o setState
 * síncrono no corpo do effect (e o render extra que ele provoca).
 */
export function useIsMobile(): boolean {
  const subscribe = React.useCallback((onStoreChange: () => void) => {
    if (typeof window === "undefined") return () => {}

    const mql = window.matchMedia(query)
    mql.addEventListener("change", onStoreChange)
    return () => mql.removeEventListener("change", onStoreChange)
  }, [])

  const getSnapshot = React.useCallback(
    () => typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT,
    [],
  )

  // No servidor assumimos desktop, evitando divergência na hidratação.
  const getServerSnapshot = () => false

  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
