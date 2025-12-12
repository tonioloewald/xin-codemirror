import * as path from 'path'
import { statSync } from 'fs'
import { watch } from 'chokidar'
import { $ } from 'bun'

const PROJECT_ROOT = import.meta.dir
const DIST_DIR = path.resolve(PROJECT_ROOT, 'dist')
const isSPA = true

async function analyzeBuildProducts(buildResult: any) {
  console.log('Bundle Analysis')

  for (const artifact of buildResult.outputs) {
    // We only care about the JS bundle, not sourcemaps
    if (artifact.kind === 'entry-point' || artifact.path.endsWith('.js')) {
      // 1. Gzip the artifact (using -k to keep original, -f to force overwrite)
      await $`gzip -k -f ${artifact.path}`

      // 2. Read the size of the .gz file
      const gzPath = `${artifact.path}.gz`
      const file = Bun.file(gzPath)
      const size = await file.size

      // 3. Report
      const sizeInKb = (size / 1024).toFixed(2)
      const name = artifact.path.split('/').pop() // Get filename only
      console.log(`📦 ${name} (gzipped): \x1b[32m${sizeInKb} KB\x1b[0m`)

      // 4. Cleanup
      await $`rm ${gzPath}`
    }
  }
}

async function build() {
  console.time('build')
  let output = await $`rm -rf ${DIST_DIR}`.text()
  let result = await Bun.build({
    entrypoints: ['./src/blueprint.ts'],
    outdir: './dist',
    sourcemap: 'linked',
    minify: true,
  })
  if (!result.success) {
    console.error('Build to /build failed')
    for (const message of result.logs) {
      console.error(message)
    }
    return
  }
  console.timeEnd('build')

  await analyzeBuildProducts(result)
}
watch('./src').on('change', build)

build()

function serveFromDir(config: {
  directory: string
  path: string
}): Response | null {
  let basePath = path.join(config.directory, config.path)
  const suffixes = ['', '.html', 'index.html']

  for (const suffix of suffixes) {
    try {
      const pathWithSuffix = path.join(basePath, suffix)
      const stat = statSync(pathWithSuffix)
      if (stat && stat.isFile()) {
        return new Response(Bun.file(pathWithSuffix))
      }
    } catch (err) {}
  }

  return null
}

const server = Bun.serve({
  port: 8021,
  fetch(request) {
    let reqPath = new URL(request.url).pathname
    console.log(request.method, reqPath)
    if (reqPath === '/') reqPath = '/index.html'

    // check public
    const publicResponse = serveFromDir({
      directory: PROJECT_ROOT,
      path: reqPath,
    })
    if (publicResponse) return publicResponse

    // check /.build
    const buildResponse = serveFromDir({
      directory: PROJECT_ROOT,
      path: reqPath,
    })
    if (buildResponse) return buildResponse

    if (isSPA) {
      const spaResponse = serveFromDir({
        directory: PROJECT_ROOT,
        path: '/index.html',
      })
      console.log(spaResponse)
      if (spaResponse) return spaResponse
    }
    return new Response('File not found', {
      status: 404,
    })
  },
})

console.log(`Listening on https://localhost:${server.port}`)
