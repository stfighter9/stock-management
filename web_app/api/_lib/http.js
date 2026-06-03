export function sendJson(res, statusCode, success, message, data = {}) {
  res.status(statusCode).json({
    success,
    message,
    data,
  })
}

export async function parseJsonBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body
  }

  if (typeof req.body === 'string' && req.body.trim()) {
    return JSON.parse(req.body)
  }

  return {}
}

export function allowMethods(req, res, methods) {
  if (methods.includes(req.method)) {
    return true
  }

  res.setHeader('Allow', methods.join(', '))
  sendJson(res, 405, false, `Method ${req.method} is not allowed`)
  return false
}

export function handleApiError(res, error) {
  const statusCode = error?.statusCode || 500
  const message = error instanceof Error ? error.message : 'Unexpected server error'
  sendJson(res, statusCode, false, message)
}
