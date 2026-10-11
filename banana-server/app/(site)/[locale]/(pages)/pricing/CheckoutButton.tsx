"use client";

/**
 * Opens Paddle Checkout as an overlay with custom_data { userId } (spec section 12,
 * flow step 2). Paddle.js loads from cdn.paddle.com only when a button is pressed.
 * Studio primary button (yellow, owner decision) with the inline spinner and a visible busy label
 * ("Opening checkout…"). It stays enabled (and focused) while it works; a second press is ignored.
 */
import { useState } from "react";
import { ErrorIcon } from "@/components/studio/icons";
import { buildCheckoutOptions, PADDLE_JS_URL, type PaddleEnvironment, type PaddleGlobal } from "@/lib/billing/checkout";

let paddlePromise: Promise<PaddleGlobal> | null = null;
let initializedToken: string | null = null;

function loadPaddle(): Promise<PaddleGlobal> {
  if (window.Paddle) return Promise.resolve(window.Paddle);
  if (!paddlePromise) {
    paddlePromise = new Promise<PaddleGlobal>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = PADDLE_JS_URL;
      script.async = true;
      script.onload = () => (window.Paddle ? resolve(window.Paddle) : reject(new Error("Paddle.js missing")));
      script.onerror = () => {
        paddlePromise = null;
        script.remove();
        reject(new Error("Paddle.js failed to load"));
      };
      document.head.appendChild(script);
    });
  }
  return paddlePromise;
}

export type CheckoutLabels = { action: string; loading: string; loadFailed: string };

type Props = {
  priceId: string;
  userId: string;
  email: string | null;
  clientToken: string;
  environment: PaddleEnvironment;
  locale: string;
  successUrl: string;
  labels: CheckoutLabels;
};

export function CheckoutButton(props: Props) {
  const [state, setState] = useState<"idle" | "loading" | "failed">("idle");

  async function open() {
    if (state === "loading") return;
    setState("loading");
    try {
      const paddle = await loadPaddle();
      if (initializedToken !== props.clientToken) {
        if (props.environment === "sandbox") paddle.Environment.set("sandbox");
        paddle.Initialize({ token: props.clientToken });
        initializedToken = props.clientToken;
      }
      paddle.Checkout.open(
        buildCheckoutOptions({
          priceId: props.priceId,
          userId: props.userId,
          email: props.email,
          locale: props.locale,
          theme: "dark",
          successUrl: props.successUrl,
        }),
      );
      setState("idle");
    } catch {
      setState("failed");
    }
  }

  const loading = state === "loading";
  return (
    <>
      <button
        type="button"
        className="st-btn"
        data-variant="primary"
        data-size="lg"
        data-loading={loading ? "inline" : undefined}
        onClick={open}
        aria-busy={loading || undefined}
      >
        {loading ? props.labels.loading : props.labels.action}
      </button>
      {/* Always mounted so the failure is announced (role="alert" regions must exist before text). */}
      <div role="alert" className="checkout-error">
        {state === "failed" ? (
          <p className="st-alert" data-tone="danger">
            <span className="st-alert-icon">
              <ErrorIcon size={16} />
            </span>
            <span className="st-alert-content">{props.labels.loadFailed}</span>
          </p>
        ) : null}
      </div>
    </>
  );
}
