import type {
  ApiResponse,
  BootstrapData,
  InboundPayload,
  PickBatchPayload,
  ReturnBatchPayload,
} from '../types'

type MutationResult = Record<string, unknown>

function buildHeaders() {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const token = import.meta.env.VITE_APP_SHARED_TOKEN
  if (token) {
    headers['X-App-Token'] = token
  }
  return headers
}

async function requestJson<T>(input: string, init?: RequestInit) {
  const response = await fetch(input, {
    ...init,
    headers: {
      ...buildHeaders(),
      ...(init?.headers ?? {}),
    },
  })

  let payload: ApiResponse<T>
  try {
    payload = (await response.json()) as ApiResponse<T>
  } catch {
    throw new Error('API trả về dữ liệu không hợp lệ')
  }

  if (!response.ok || !payload.success) {
    throw new Error(payload.message || 'Có lỗi xảy ra khi gọi API')
  }

  return payload.data
}

export function loadBootstrap() {
  return requestJson<BootstrapData>('/api/bootstrap')
}

export function confirmPickBatch(payload: PickBatchPayload) {
  return requestJson<MutationResult>('/api/pick-batch-confirm', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function confirmReturnBatch(payload: ReturnBatchPayload) {
  return requestJson<MutationResult>('/api/return-batch-confirm', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function confirmInbound(payload: InboundPayload) {
  return requestJson<MutationResult>('/api/inbound-confirm', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
