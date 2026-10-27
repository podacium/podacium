"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function BiOrganizationsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/organizations");
  }, [router]);

  return null;
}
