"use client";

import { FileText, Sparkles } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { CSVImportForm } from "./csv-form";
import { AIImportForm } from "./ai-form";

export function ImportDialogBody() {
  return (
    <Tabs
      defaultValue="csv-import"
      className="flex min-h-0 flex-1 flex-col gap-4"
    >
      <div className="px-6">
        <TabsList className="w-full">
          <TabsTrigger value="csv-import">
            <FileText className="size-4" /> CSV Import
          </TabsTrigger>
          <TabsTrigger value="ai-import">
            <Sparkles className="size-4" /> AI Import
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent
        value="csv-import"
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <CSVImportForm />
      </TabsContent>
      <TabsContent
        value="ai-import"
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <AIImportForm />
      </TabsContent>
    </Tabs>
  );
}
