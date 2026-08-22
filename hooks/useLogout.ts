"use client";

import { useState } from "react";

export function useLogout() {
  const [confirmOpen, setConfirmOpen] = useState(false);

  function requestLogout() {
    setConfirmOpen(true);
  }

  function cancelLogout() {
    setConfirmOpen(false);
  }

  async function confirmLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return { confirmOpen, requestLogout, cancelLogout, confirmLogout };
}
