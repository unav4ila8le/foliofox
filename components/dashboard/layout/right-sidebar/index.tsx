import { Sidebar } from "@/components/ui/sidebar";
import { Chat } from "./chat";

export function RightSidebar() {
  return (
    <Sidebar side="right">
      <Chat />
    </Sidebar>
  );
}
