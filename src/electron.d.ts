export interface Telemetry {
  cpu: number
  ram: number
  disk: number
  battery: number | null
  netUp: number
  netDown: number
  uptime: number
  host: string
  platform: string
}

export interface Weather {
  city?: string
  country?: string
  temp?: number
  feels?: number
  humidity?: number
  desc?: string
  error?: string
}

declare global {
  interface Window {
    jarvis: {
      sendChat: (messages: unknown[], reqId: string) => void
      on: (channel: string, cb: (payload: any) => void) => () => void
      weather: () => Promise<Weather>
      minimize: () => void
      maximize: () => void
      fullscreen: () => void
      close: () => void
    }
  }
}
export {}
