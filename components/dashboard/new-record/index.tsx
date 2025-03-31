"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PurchaseForm } from "./purchase-form";
import { UpdateForm } from "./update-form";

export function NewRecord() {
  const handleSuccess = () => {
    // TODO: Handle successful submission (e.g., close dialog, show toast)
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          New Record
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Record</DialogTitle>
          <DialogDescription>
            Add a new transaction, balance or value update.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="purchase">
          <TabsList className="mb-2 w-full">
            <TabsTrigger value="purchase" className="cursor-pointer">
              Purchase
            </TabsTrigger>
            <TabsTrigger value="sell" className="cursor-pointer">
              Sale
            </TabsTrigger>
            <TabsTrigger value="transfer" className="cursor-pointer">
              Transfer
            </TabsTrigger>
            <TabsTrigger value="update" className="cursor-pointer">
              Update
            </TabsTrigger>
          </TabsList>
          <TabsContent value="purchase">
            <PurchaseForm onSuccess={handleSuccess} />
          </TabsContent>
          <TabsContent value="sell">Sell</TabsContent>
          <TabsContent value="transfer">Transfer</TabsContent>
          <TabsContent value="update">
            <UpdateForm onSuccess={handleSuccess} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
