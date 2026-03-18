export interface TestClientResponse<T = any> {
  status: number;
  data: T;
}

export class TestClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:8788') {
    this.baseUrl = baseUrl;
  }

  async post<T = any>(path: string, data: any): Promise<TestClientResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const status = response.status;
    const responseData = await response.json().catch(() => ({}));

    return {
      status,
      data: responseData as T,
    };
  }

  async get<T = any>(path: string, headers: Record<string, string> = {}): Promise<TestClientResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    });

    const status = response.status;
    const responseData = await response.json().catch(() => ({}));

    return {
      status,
      data: responseData as T,
    };
  }
}
