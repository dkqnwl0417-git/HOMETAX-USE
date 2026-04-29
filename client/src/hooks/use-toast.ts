import { useState, useEffect } from "react";

export function useToast() {
  const toast = ({ title, description, variant }: { title: string, description?: string, variant?: string }) => {
    console.log("Toast: " + title + " - " + description);
    alert(title + "\n" + (description || ""));
  };
  return { toast };
}
