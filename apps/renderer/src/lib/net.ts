import https from 'https';
import http from 'http';

export interface HttpRequestOptions {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: unknown;
}

/**
 * Makes an HTTP/HTTPS request
 * @param options Request options
 * @returns Parsed JSON response
 */
export async function makeRequest<T>(options: HttpRequestOptions): Promise<T> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(options.url);
    const protocol = urlObj.protocol === 'https:' ? https : http;

    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (protocol === https ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    const req = protocol.request(requestOptions, (res) => {
      const chunks: Buffer[] = [];

      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        try {
          const responseText = Buffer.concat(chunks).toString('utf-8');
          const data = JSON.parse(responseText) as T;

          if (res.statusCode && res.statusCode >= 400) {
            reject(
              new Error(
                `HTTP request failed with status ${res.statusCode}: ${responseText}`,
              ),
            );
            return;
          }

          resolve(data);
        } catch (error) {
          reject(
            new Error(
              `Failed to parse response: ${error instanceof Error ? error.message : String(error)}`,
            ),
          );
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

/**
 * Downloads a file from URL to buffer
 * @param url URL to download from
 * @returns Buffer containing the file data
 */
export async function downloadFile(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    protocol
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(
            new Error(`Download failed: HTTP ${response.statusCode}`),
          );
          return;
        }

        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          try {
            const buffer = Buffer.concat(chunks);
            resolve(buffer);
          } catch (error) {
            reject(error);
          }
        });
      })
      .on('error', reject);
  });
}
