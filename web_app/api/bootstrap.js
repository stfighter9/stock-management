import { assertAppToken, getServerConfig } from './_lib/env.js'
import { loadBootstrapData } from './_lib/bootstrap.js'
import { allowMethods, handleApiError, sendJson } from './_lib/http.js'

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET'])) {
    return
  }

  try {
    const config = getServerConfig()
    assertAppToken(req, config)

    const bootstrap = await loadBootstrapData()
    sendJson(res, 200, true, 'ok', {
      products: bootstrap.products,
      shopeeCatalog: bootstrap.shopeeCatalog,
      shopeeMappings: bootstrap.shopeeMappings,
      mappingComponents: bootstrap.mappingComponents,
      mixOptions: bootstrap.mixOptions,
      inventoryReport: bootstrap.inventoryReport,
      dailyInboundReport: bootstrap.dailyInboundReport,
      dailyOutboundReport: bootstrap.dailyOutboundReport,
      recentTransactions: bootstrap.recentTransactions,
    })
  } catch (error) {
    handleApiError(res, error)
  }
}
