/**
 * Engram SDK — Core HTTP client for miner communication.
 */

import { EngramError, MinerOfflineError } from "./errors";

const DEFAULT_TIMEOUT = 30_000; // 30 seconds in ms

/**
 * Make a POST request to the miner.
 */
export async function postRequest(
  url: string,
  payload: Record<string, unknown>,
  timeout: number = DEFAULT_TIMEOUT
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new EngramError(
        `HTTP ${response.status} from ${url}: ${text.slice(0, 200)}`
      );
    }

    const data = await response.json();
    return data as Record<string, unknown>;
  } catch (error) {
    if (error instanceof EngramError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new MinerOfflineError(url, new Error("Request timed out"));
    }
    if (error instanceof TypeError) {
      // fetch throws TypeError on network errors
      throw new MinerOfflineError(url, error as Error);
    }
    throw new MinerOfflineError(url, error as Error);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Make a GET request to the miner.
 */
export async function getRequest(
  url: string,
  timeout: number = DEFAULT_TIMEOUT
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { error: "not_found" };
      }
      const text = await response.text().catch(() => "");
      throw new EngramError(
        `HTTP ${response.status} from ${url}: ${text.slice(0, 200)}`
      );
    }

    return (await response.json()) as Record<string, unknown>;
  } catch (error) {
    if (error instanceof EngramError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new MinerOfflineError(url, new Error("Request timed out"));
    }
    if (error instanceof TypeError) {
      throw new MinerOfflineError(url, error as Error);
    }
    throw new MinerOfflineError(url, error as Error);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Make a DELETE request to the miner.
 */
export async function deleteRequest(
  url: string,
  timeout: number = DEFAULT_TIMEOUT
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: "DELETE",
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { deleted: false };
      }
      const text = await response.text().catch(() => "");
      throw new EngramError(
        `HTTP ${response.status} from ${url}: ${text.slice(0, 200)}`
      );
    }

    return (await response.json()) as Record<string, unknown>;
  } catch (error) {
    if (error instanceof EngramError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new MinerOfflineError(url, new Error("Request timed out"));
    }
    if (error instanceof TypeError) {
      throw new MinerOfflineError(url, error as Error);
    }
    throw new MinerOfflineError(url, error as Error);
  } finally {
    clearTimeout(timer);
  }
}
