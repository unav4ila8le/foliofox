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
import { SaleForm } from "./sale-form";
import { TransferForm } from "./transfer-form";
import { UpdateForm } from "./update-form";

export function NewRecord() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          New Record
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Record</DialogTitle>
          <DialogDescription>
            Add a new transaction, balance or value update.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="purchase">
          <TabsList className="mb-2 w-full">
            <TabsTrigger value="purchase">Purchase</TabsTrigger>
            <TabsTrigger value="sale">Sale</TabsTrigger>
            <TabsTrigger value="transfer">Transfer</TabsTrigger>
            <TabsTrigger value="update">Update</TabsTrigger>
          </TabsList>
          <TabsContent value="purchase">
            <PurchaseForm />
          </TabsContent>
          <TabsContent value="sale">
            <SaleForm />
          </TabsContent>
          <TabsContent value="transfer">
            <TransferForm />
          </TabsContent>
          <TabsContent value="update">
            <UpdateForm />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
