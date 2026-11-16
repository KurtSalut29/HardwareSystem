"use client";

import { useEffect } from "react";
import { startPwa } from "@/lib/pwa";

/** Mounted once in the root layout: install prompt + service worker. Renders nothing. */
export default function PwaSetup() {
  useEffect(() => { startPwa(); }, []);
  return null;
}
