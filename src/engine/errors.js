/** Typed business error. `code` is stable and meant to be translated by the UI. */
export class EngineError extends Error {
  code;
  details;
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'EngineError';
    this.code = code;
    this.details = details;
  }
}

export const isEngineError = (value) => value instanceof EngineError;
