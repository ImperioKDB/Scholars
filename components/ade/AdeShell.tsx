import { AdeProvider } from "@/components/ade/AdeProvider";

export function AdeShell({ children }: { children: React.ReactNode }) {
  return <AdeProvider>{children}</AdeProvider>;
}
