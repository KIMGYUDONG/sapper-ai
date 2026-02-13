declare module '@playwright/test' {
  export const test: any
  export const expect: any
  export const devices: Record<string, any>

  export function defineConfig(config: any): any

  export type Page = any
  export type Locator = any
}
