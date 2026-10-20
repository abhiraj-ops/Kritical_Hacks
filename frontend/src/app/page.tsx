import type { Metadata } from "next";

import Workbench from "@/components/workbench/Workbench";

export const metadata: Metadata = {
  title: "ZeroDay-Guard AI — Threat Assessment Workspace",
};

export default function Page() {
  return <Workbench />;
}
