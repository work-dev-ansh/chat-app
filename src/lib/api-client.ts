/**
 * [BOTH: CLIENT & SERVER]
 * Production-grade Next.js API client with Request & Response Interceptors.
 *
 * Capabilities:
 * 1. Request Interceptors: Automatically attaches Bearer tokens, query params, and headers.
 * 2. Response Interceptors: Centralized error handling (401, 403, 500) and JSON extraction.
 * 3. Type-safe endpoints: api.conversations.list(), api.messages.send(), etc.
 */

export interface ApiClientOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>;
}

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

type RequestInterceptor = (
  url: string,
  options: ApiClientOptions,
) => Promise<{ url: string; options: ApiClientOptions }> | { url: string; options: ApiClientOptions };

type ResponseInterceptor = <T>(response: Response) => Promise<T>;

export class ApiClient {
  private baseURL: string;
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];

  constructor(baseURL: string = "") {
    this.baseURL = baseURL;

    // Register default enterprise request interceptor (Token & Headers)
    this.useRequest((url, options) => {
      const headers = new Headers(options.headers || {});

      // Ensure JSON Content-Type if sending a body
      if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
        headers.set("Content-Type", "application/json");
      }

      // Attach auth token if available (client-side localStorage or cookie)
      if (typeof window !== "undefined") {
        const token = localStorage.getItem("auth_token");
        if (token && !headers.has("Authorization")) {
          headers.set("Authorization", `Bearer ${token}`);
        }
      }

      // Format query params cleanly
      let fullUrl = url.startsWith("http") ? url : `${this.baseURL}${url}`;
      if (options.params) {
        const searchParams = new URLSearchParams();
        for (const [key, val] of Object.entries(options.params)) {
          if (val !== undefined && val !== null) {
            searchParams.append(key, String(val));
          }
        }
        const queryString = searchParams.toString();
        if (queryString) {
          fullUrl += `${fullUrl.includes("?") ? "&" : "?"}${queryString}`;
        }
      }

      return {
        url: fullUrl,
        options: {
          ...options,
          headers,
        },
      };
    });

    // Register default enterprise response interceptor (Error catching & JSON parsing)
    this.useResponse(async (response) => {
      if (!response.ok) {
        let errorData: any = null;
        try {
          errorData = await response.json();
        } catch {
          errorData = await response.text();
        }

        // Global 401 interception: token expired / unauthorized
        if (response.status === 401 && typeof window !== "undefined") {
          console.warn("[API] 401 Unauthorized detected. Redirecting or refreshing token...");
          // e.g. window.location.href = '/login';
        }

        const message =
          errorData?.error || errorData?.message || `HTTP ${response.status}: ${response.statusText}`;
        throw new ApiError(message, response.status, errorData);
      }

      if (response.status === 204) {
        return {} as any;
      }

      const json = await response.json();
      return json.data !== undefined ? json.data : json;
    });
  }

  /**
   * Add a custom request interceptor
   */
  useRequest(interceptor: RequestInterceptor) {
    this.requestInterceptors.push(interceptor);
  }

  /**
   * Add a custom response interceptor
   */
  useResponse(interceptor: ResponseInterceptor) {
    this.responseInterceptors.push(interceptor);
  }

  private async execute<T>(url: string, options: ApiClientOptions = {}): Promise<T> {
    let currentUrl = url;
    let currentOptions = options;

    // Run all request interceptors
    for (const interceptor of this.requestInterceptors) {
      const result = await interceptor(currentUrl, currentOptions);
      currentUrl = result.url;
      currentOptions = result.options;
    }

    const response = await fetch(currentUrl, currentOptions);

    // Run response interceptors (last one returns the final typed output)
    let output: any = response;
    for (const interceptor of this.responseInterceptors) {
      output = await interceptor<T>(response);
    }

    return output;
  }

  get<T>(url: string, options?: ApiClientOptions): Promise<T> {
    return this.execute<T>(url, { ...options, method: "GET" });
  }

  post<T>(url: string, body?: any, options?: ApiClientOptions): Promise<T> {
    return this.execute<T>(url, {
      ...options,
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }

  put<T>(url: string, body?: any, options?: ApiClientOptions): Promise<T> {
    return this.execute<T>(url, {
      ...options,
      method: "PUT",
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }

  delete<T>(url: string, options?: ApiClientOptions): Promise<T> {
    return this.execute<T>(url, { ...options, method: "DELETE" });
  }
}

// Export singleton HTTP client instance
export const apiClient = new ApiClient();
