import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const distDir = path.join(rootDir, 'dist')

const apiHandlers = {
  '/api/bootstrap': '../api/bootstrap.js',
  '/api/pick-batch-confirm': '../api/pick-batch-confirm.js',
  '/api/return-batch-confirm': '../api/return-batch-confirm.js',
  '/api/inbound-confirm': '../api/inbound-confirm.js',
}

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
}

function getArg(name, fallback) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : fallback
}

function loadGoogleCredentialEnv() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
    return
  }

  const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE
  if (!keyFile) {
    return
  }

  const creds = JSON.parse(fs.readFileSync(path.resolve(rootDir, keyFile), 'utf8'))
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = creds.client_email
  process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = creds.private_key
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function createResponseAdapter(res) {
  return {
    setHeader: (...args) => res.setHeader(...args),
    status(code) {
      res.statusCode = code
      return this
    },
    json(payload) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify(payload))
    },
  }
}

async function handleApi(req, res, pathname) {
  const handlerPath = apiHandlers[pathname]
  if (!handlerPath) {
    res.statusCode = 404
    res.end('Not found')
    return
  }

  req.body = await readBody(req)
  const moduleUrl = pathToFileURL(path.resolve(__dirname, handlerPath)).href
  const { default: handler } = await import(moduleUrl)
  await handler(req, createResponseAdapter(res))
}

function serveStatic(res, pathname) {
  const relativePath = pathname === '/' ? '/index.html' : pathname
  const filePath = path.resolve(distDir, `.${relativePath}`)
  const safeFilePath = filePath.startsWith(distDir) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()
    ? filePath
    : path.join(distDir, 'index.html')

  const extension = path.extname(safeFilePath)
  res.setHeader('Content-Type', mimeTypes[extension] || 'application/octet-stream')
  fs.createReadStream(safeFilePath).pipe(res)
}

loadGoogleCredentialEnv()

const port = Number(getArg('--port', process.env.PORT || 4174))
const server = http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
    if (pathname.startsWith('/api/')) {
      await handleApi(req, res, pathname)
      return
    }
    serveStatic(res, pathname)
  } catch (error) {
    res.statusCode = error?.statusCode || 500
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ success: false, message: error instanceof Error ? error.message : 'Unexpected server error' }))
  }
})

server.listen(port, '0.0.0.0', () => {
  console.log(`Local app server: http://localhost:${port}`)
})
