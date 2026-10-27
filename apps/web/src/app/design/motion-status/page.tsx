import type { Metadata } from "next";
import { PageLayout } from "@/components/PageLayout";
import { MotionStatusPlayground } from "./MotionStatusPlayground";

export const metadata: Metadata = {
  title: "Motion Status — Design System",
  description:
    "Interactive playground for PodaciumMotionStatus: async activity states, variants, RTL and dark-theme previews.",
  robots: { index: false, follow: false },
};

export default function MotionStatusDesignPage() {
  return (
    <PageLayout background="gray">
      <div className="mx-auto max-w-7xl px-4 pb-20 pt-4 sm:px-6 lg:px-8">
        <MotionStatusPlayground />
      </div>
    </PageLayout>
  );
}
