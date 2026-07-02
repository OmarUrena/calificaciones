import { DashboardLayout } from "@/components/layout/DashboardLayout";

export default function PrivateLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
