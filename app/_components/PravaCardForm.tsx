"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PravaSDK } from "@prava-sdk/core";
import type { CardValidationState, PravaError } from "@prava-sdk/core";

const publishableKey = process.env.NEXT_PUBLIC_PRAVA_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_PUBLISHABLE_KEY || "";

type PravaSession = {
  sessionToken: string;
  iframeUrl: string;
  expiresAt?: string;
  orderId?: string;
};

type PravaCardFormProps = {
  session: PravaSession;
  onReady?: () => void;
  onSuccess?: () => void;
  onError?: (error: Error | PravaError) => void;
};

export default function PravaCardForm({ session, onReady, onSuccess, onError }: PravaCardFormProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sdkRef = useRef<PravaSDK | null>(null);
  const hasMounted = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [validationState, setValidationState] = useState<CardValidationState | null>(null);

  const reportError = useCallback(
    (reason: unknown) => {
      const nextError = reason instanceof Error ? reason : new Error("Prava could not load the secure card form.");
      setError(nextError.message);
      setLoading(false);
      onError?.(nextError);
    },
    [onError],
  );

  const mountSdk = useCallback(async () => {
    if (!publishableKey) {
      reportError(new Error("Prava publishable key is missing. Add NEXT_PUBLIC_PRAVA_PUBLISHABLE_KEY to enable the secure card form."));
      return;
    }

    setError("");
    setLoading(true);
    sdkRef.current?.destroy();
    sdkRef.current = null;

    try {
      const sdk = new PravaSDK({ publishableKey });
      sdkRef.current = sdk;

      if (!containerRef.current) return;

      await sdk.collectPAN({
        sessionToken: session.sessionToken,
        iframeUrl: session.iframeUrl,
        container: containerRef.current,
        onReady: () => {
          setLoading(false);
          onReady?.();
        },
        onChange: (state: CardValidationState) => setValidationState(state),
        onSuccess: () => onSuccess?.(),
        onError: (pravaError: PravaError) => reportError(pravaError),
      });
    } catch (reason) {
      reportError(reason);
    }
  }, [onReady, onSuccess, reportError, session.iframeUrl, session.sessionToken]);

  useEffect(() => {
    if (hasMounted.current) return;
    hasMounted.current = true;
    void mountSdk();

    return () => {
      sdkRef.current?.destroy();
      sdkRef.current = null;
      hasMounted.current = false;
    };
  }, [mountSdk]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !loading || error) return;

    const observer = new MutationObserver(() => {
      if (container.querySelector("iframe")) setLoading(false);
    });

    observer.observe(container, { childList: true, subtree: true });
    const timeout = window.setTimeout(() => setLoading(false), 5000);

    return () => {
      observer.disconnect();
      window.clearTimeout(timeout);
    };
  }, [error, loading]);

  return (
    <div className="prava-embed">
      {error && (
        <div className="prava-embed-error">
          <strong>Secure card form unavailable</strong>
          <p>{error}</p>
          <button type="button" onClick={mountSdk}>Try again</button>
        </div>
      )}

      {loading && !error && (
        <div className="prava-embed-loading">
          <span aria-hidden="true" />
          <p>Loading secure Prava checkout...</p>
        </div>
      )}

      {validationState && !error && (
        <div className="prava-validation">
          <span className={validationState.cardNumber.isValid ? "valid" : ""}>Card</span>
          <span className={validationState.expiry.isValid ? "valid" : ""}>Expiry</span>
          <span className={validationState.cvv.isValid ? "valid" : ""}>CVV</span>
        </div>
      )}

      <div ref={containerRef} className="prava-iframe-slot" />
    </div>
  );
}
