import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readConfig } from '../src/config.js'
import { createSyncSpaceServer, type SyncSpaceServerHandle } from '../src/http/app.js'

async function withFrontendServer(run: (baseUrl: string) => Promise<void>): Promise<void> {
  const previousFrontendDistDir = process.env.FRONTEND_DIST_DIR
  const frontendDir = await mkdtemp(join(tmpdir(), 'syncspace-frontend-'))
  let handle: SyncSpaceServerHandle | null = null

  try {
    await mkdir(join(frontendDir, 'assets'))
    await writeFile(
      join(frontendDir, 'index.html'),
      '<!doctype html><html><head><script type="module" src="/assets/app.js"></script></head><body><div id="root"></div></body></html>'
    )
    await writeFile(join(frontendDir, 'assets', 'app.js'), 'console.log("syncspace")')
    process.env.FRONTEND_DIST_DIR = frontendDir

    handle = createSyncSpaceServer({
      config: readConfig({
        NODE_ENV: 'test',
        HOST: '127.0.0.1',
        PORT: '0',
        LOG_LEVEL: 'silent',
        WS_AUTH_MODE: 'off',
        AUTH_SECRET: 'test-auth-secret',
        AGENT_TOKEN_PEPPER: 'test-agent-pepper',
        SYNCSPACE_DOC_PERSISTENCE_MODE: 'file'
      })
    })
    const address = await handle.start()
    await run(`http://127.0.0.1:${address.port}`)
  } finally {
    await handle?.stop()
    if (previousFrontendDistDir === undefined) delete process.env.FRONTEND_DIST_DIR
    else process.env.FRONTEND_DIST_DIR = previousFrontendDistDir
    await rm(frontendDir, { recursive: true, force: true })
  }
}

describe('frontend static serving', () => {
  it('serves the built React app for browser routes without swallowing backend routes', async () => {
    await withFrontendServer(async (baseUrl) => {
      const root = await fetch(`${baseUrl}/`)
      expect(root.status).toBe(200)
      expect(root.headers.get('content-type')).toContain('text/html')
      await expect(root.text()).resolves.toContain('<div id="root"></div>')

      const login = await fetch(`${baseUrl}/auth/login`)
      expect(login.status).toBe(200)
      expect(login.headers.get('content-type')).toContain('text/html')
      await expect(login.text()).resolves.toContain('/assets/app.js')

      const asset = await fetch(`${baseUrl}/assets/app.js`)
      expect(asset.status).toBe(200)
      expect(asset.headers.get('content-type')).toContain('text/javascript')
      expect(asset.headers.get('cache-control')).toContain('immutable')
      await expect(asset.text()).resolves.toContain('syncspace')

      const apiMiss = await fetch(`${baseUrl}/api/nope`)
      expect(apiMiss.status).toBe(404)
      expect(apiMiss.headers.get('content-type')).toContain('application/json')
      await expect(apiMiss.json()).resolves.toMatchObject({ code: 'not_found' })
    })
  })
})
