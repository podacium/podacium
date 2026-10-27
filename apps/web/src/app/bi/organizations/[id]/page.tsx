"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function BiOrganizationDetailRedirectPage() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    if (params?.id) {
      router.replace(`/organizations/${params.id}`);
    } else {
      router.replace("/organizations");
    }
  }, [params?.id, router]);

  return null;
}
