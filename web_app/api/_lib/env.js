export function getServerConfig() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY

  if (!spreadsheetId || !clientEmail || !privateKey) {
    throw new Error('Missing Google Sheets environment configuration')
  }

  return {
    spreadsheetId,
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, '\n'),
    appSharedToken: process.env.APP_SHARED_TOKEN || '',
  }
}

export function assertAppToken(req, config) {
  if (!config.appSharedToken) {
    return
  }

  const token = req.headers['x-app-token']
  if (token !== config.appSharedToken) {
    const error = new Error('Unauthorized request')
    error.statusCode = 401
    throw error
  }
}
