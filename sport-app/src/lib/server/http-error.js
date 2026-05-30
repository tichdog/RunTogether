export class HttpError extends Error {
  constructor(status, message, details) {
    super(message)
    this.status = status
    this.details = details
  }
}

export function badRequest(message, details) {
  return new HttpError(400, message, details)
}

export function forbidden(message = 'Недостаточно прав') {
  return new HttpError(403, message)
}

export function notFound(message = 'Не найдено') {
  return new HttpError(404, message)
}
