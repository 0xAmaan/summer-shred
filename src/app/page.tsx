import { DashboardScreen } from "@/components/dashboard/screen";

export default function HomePage() {
  // Home always shows the currently active challenge (or the latest one if
  // none is active). Older challenges are accessible at /c{round}.
  return <DashboardScreen round={null} />;
}
