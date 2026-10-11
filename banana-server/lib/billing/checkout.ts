/**
 * Paddle.js overlay checkout (browser side). Pure helpers plus the minimal
 * Paddle.js v2 types we use. Script: https://cdn.paddle.com/paddle/v2/paddle.js
 * Docs: developer.paddle.com/paddle-js (Paddle.Environment.set, Paddle.Initialize, Paddle.Checkout.open).
 */

export const PADDLE_JS_URL = "https://cdn.paddle.com/paddle/v2/paddle.js";

export type PaddleEnvironment = "sandbox" | "production";

export type CheckoutConfig = {
  /** Client-side token from Paddle > Developer tools > Authentication (PADDLE_CLIENT_TOKEN). Safe to expose. */
  clientToken: string | null;
  environment: PaddleEnvironment;
};

export type CheckoutOpenOptions = {
  items: { priceId: string; quantity: number }[];
  customData: { userId: string };
  customer?: { email: string };
  settings: {
    displayMode: "overlay";
    theme: "light" | "dark";
    locale: string;
    successUrl?: string;
    allowLogout?: boolean;
  };
};

export type PaddleGlobal = {
  Environment: { set(env: "sandbox"): void };
  Initialize(options: { token: string; eventCallback?: (event: { name?: string }) => void }): void;
  Checkout: { open(options: CheckoutOpenOptions): void };
};

declare global {
  interface Window {
    Paddle?: PaddleGlobal;
  }
}

export function readCheckoutConfig(env: Record<string, string | undefined> = process.env): CheckoutConfig {
  const token = env.PADDLE_CLIENT_TOKEN?.trim() || null;
  return {
    clientToken: token,
    environment: env.PADDLE_ENV?.trim() === "sandbox" || token?.startsWith("test_") ? "sandbox" : "production",
  };
}

export function buildCheckoutOptions(input: {
  priceId: string;
  userId: string;
  email?: string | null;
  locale: string;
  theme?: "light" | "dark";
  successUrl?: string;
}): CheckoutOpenOptions {
  return {
    items: [{ priceId: input.priceId, quantity: 1 }],
    customData: { userId: input.userId },
    ...(input.email ? { customer: { email: input.email } } : {}),
    settings: {
      displayMode: "overlay",
      theme: input.theme ?? "light",
      locale: input.locale,
      ...(input.successUrl ? { successUrl: input.successUrl } : {}),
      // The account email is fixed to the signed-in user.
      allowLogout: false,
    },
  };
}
