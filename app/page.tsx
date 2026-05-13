import { WorkbenchClient } from "@/components/workbench/WorkbenchClient";
import { getRuntimeConfig } from "@/lib/config/runtime";

export const dynamic = "force-dynamic";

export default function Home() {
  const runtimeConfig = getRuntimeConfig();

  return <WorkbenchClient config={runtimeConfig} />;
}
