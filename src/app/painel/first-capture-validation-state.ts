export type FirstCaptureValidationActionState = {
  status: 'idle' | 'success' | 'error'
  message: string | null
  refreshToken: number
}

export const INITIAL_FIRST_CAPTURE_VALIDATION_ACTION_STATE: FirstCaptureValidationActionState =
  {
    status: 'idle',
    message: null,
    refreshToken: 0,
  }
