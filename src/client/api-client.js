/** Error raised for any non-2xx answer: carries the RFC 9457 problem. */
export class ApiProblem extends Error {
  status;
  problem;
  constructor(problem) {
    super(problem.title);
    this.status = problem.status;
    this.problem = problem;
  }
}

const TOKEN_KEY = 'qads2:session';

/** The only gateway to the back-end. In demo mode the session token is kept in sessionStorage. */
export class ApiClient {
  mode;
  injection = { latency: 0, fail: {} };
  options;
  constructor(options) {
    this.options = options;
    this.mode = options.mode;
  }
  get token() {
    try {
      return this.options.storage?.getItem(TOKEN_KEY) ?? null;
    } catch {
      return null;
    }
  }
  set token(value) {
    try {
      if (value) this.options.storage?.setItem(TOKEN_KEY, value);
      else this.options.storage?.removeItem(TOKEN_KEY);
    } catch {
      // Storage unavailable (private mode): the session lasts for the page only.
    }
  }
  async request(method, path, body, headers = {}) {
    if (this.injection.latency > 0) {
      await (this.options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))))(
        this.injection.latency,
      );
    }
    const route = path.split('?')[0]?.split('/').filter(Boolean)[0] ?? '';
    const forced = this.injection.fail[route];
    if (forced) {
      throw new ApiProblem({
        type: 'about:blank',
        title: 'Injected failure',
        status: forced,
        code: 'INJECTED_FAILURE',
      });
    }
    const requestHeaders = { 'x-requested-with': 'qads', ...headers };
    if (body !== undefined) requestHeaders['content-type'] = 'application/json';
    if (this.mode === 'demo' && this.token) requestHeaders.authorization = `Bearer ${this.token}`;
    let response;
    try {
      response = await this.options.fetcher(`${this.options.baseUrl}${path}`, {
        method,
        headers: requestHeaders,
        credentials: this.mode === 'server' ? 'include' : 'same-origin',
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new ApiProblem({
        type: 'about:blank',
        title: 'Back-end unreachable',
        status: 0,
        code: 'NETWORK_ERROR',
      });
    }
    const session = response.headers.get('x-session-token');
    if (session !== null) this.token = session || null;
    const text = await response.text();
    const data = text ? JSON.parse(text) : undefined;
    if (!response.ok) {
      const problem = data;
      throw new ApiProblem(
        problem?.code
          ? problem
          : {
              type: 'about:blank',
              title: response.statusText || 'HTTP error',
              status: response.status,
              code: 'INTERNAL_ERROR',
            },
      );
    }
    return data;
  }
  get(path) {
    return this.request('GET', path);
  }
  post(path, body, headers) {
    return this.request('POST', path, body, headers);
  }
  put(path, body) {
    return this.request('PUT', path, body);
  }
  patch(path, body) {
    return this.request('PATCH', path, body);
  }
  delete(path, body) {
    return this.request('DELETE', path, body);
  }
}
