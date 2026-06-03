import { assertAppToken, getServerConfig } from './_lib/env.js'
import { loadBootstrapData } from './_lib/bootstrap.js'
import { confirmReturnBatch } from './_lib/mutations.js'
import { allowMethods, handleApiError, parseJsonBody, sendJson } from './_lib/http.js'

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['POST'])) {
    return
  }

  try {
    const config = getServerConfig()
    assertAppToken(req, config)

    const payload = await parseJsonBody(req)
    const bootstrap = await loadBootstrapData()
    const result = await confirmReturnBatch(payload, bootstrap)

    sendJson(res, 200, true, 'ok', result)
  } catch (error) {
    handleApiError(res, error)
  }
}
