"use client";

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

export type SettingsDialogTab = "account" | "emails";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestedTab?: SettingsDialogTab;
}

export function SettingsDialog({
  open,
  onOpenChange,
  requestedTab = "account",
}: SettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Update your settings here.</DialogDescription>
        </DialogHeader>
        <Tabs
          key={`${open ? "open" : "closed"}:${requestedTab}`}
          defaultValue={requestedTab}
          className="min-h-0 flex-1 overflow-hidden"
        >
          <TabsList className="mx-6 mb-2 shrink-0">
            <TabsTrigger value="account">
              <Settings /> Account
            </TabsTrigger>
            <TabsTrigger value="emails">
              <Mail /> Email Notifications
            </TabsTrigger>
          </TabsList>
          <TabsContent
            value="account"
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <AccountSettingsForm onSuccess={() => onOpenChange(false)} />
          </TabsContent>
          <TabsContent
            value="emails"
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <EmailSettingsForm onSuccess={() => onOpenChange(false)} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
