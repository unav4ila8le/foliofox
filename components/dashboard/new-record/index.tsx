import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PurchaseForm } from "./purchase-form";
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Record</DialogTitle>
          <DialogDescription>
            Add a new transaction, balance or value update.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="balance">
          <TabsList className="w-full">
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
            <PurchaseForm />
          </TabsContent>
          <TabsContent value="sell">Sell</TabsContent>
          <TabsContent value="transfer">Transfer</TabsContent>
          <TabsContent value="update">
            <UpdateForm />
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" form="new-entry-form">
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
