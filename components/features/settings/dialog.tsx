import { Mail, Settings } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/custom/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountSettingsForm } from "./account/form";
import { EmailSettingsForm } from "./emails/form";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Update your settings here.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="account">
          <TabsList className="mx-6 mb-2">
            <TabsTrigger value="account">
              <Settings /> Account
            </TabsTrigger>
            <TabsTrigger value="emails">
              <Mail /> Email Notifications
            </TabsTrigger>
          </TabsList>
          <TabsContent value="account">
            <AccountSettingsForm onSuccess={() => onOpenChange(false)} />
          </TabsContent>
          <TabsContent value="emails">
            <EmailSettingsForm onSuccess={() => onOpenChange(false)} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
