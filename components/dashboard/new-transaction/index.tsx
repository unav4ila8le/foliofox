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
import { Purchase } from "./purchase";

export function NewTransaction() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          New Transaction
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Transaction</DialogTitle>
          <DialogDescription>Add a new transaction here.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="purchase">
          <TabsList className="w-full">
            <TabsTrigger value="purchase" className="cursor-pointer">
              Purchase
            </TabsTrigger>
            <TabsTrigger value="sell" className="cursor-pointer">
              Sell
            </TabsTrigger>
            <TabsTrigger value="transfer" className="cursor-pointer">
              Transfer
            </TabsTrigger>
          </TabsList>
          <TabsContent value="purchase">
            <Purchase />
          </TabsContent>
          <TabsContent value="sell">Sell</TabsContent>
          <TabsContent value="transfer">Transfer</TabsContent>
        </Tabs>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" form="new-transaction-form">
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
