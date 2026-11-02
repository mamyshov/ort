"use client";

import Script from "next/script";
import { useEffect } from "react";

declare global { interface Window { fbq?: (...a: unknown[]) => void } }

/** Пиксель Facebook: подключается только на публичных страницах воронки и только если задан NEXT_PUBLIC_FB_PIXEL_ID. */
export function FbPixel({ event, value }: { event?: "Lead" | "InitiateCheckout" | "Purchase"; value?: number }) {
  const id = process.env.NEXT_PUBLIC_FB_PIXEL_ID;
  useEffect(() => {
    if (id && event) window.fbq?.("track", event, value != null ? { value, currency: "USD" } : undefined);
  }, [id, event, value]);
  if (!id) return null;
  return (
    <Script id="fb-pixel" strategy="afterInteractive">{`
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
      fbq('init','${id.replace(/[^0-9]/g, "")}');fbq('track','PageView');`}</Script>
  );
}
