"use client";

import { useId, useState } from "react";
import { Plus, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { TagBadge } from "./tag-badge";
import { TagEditorDialog } from "./tag-editor-dialog";
import { usePositionTags } from "./provider";
import type { PositionTag } from "@/server/position-tags/types";

interface TagPickerProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void | Promise<void>;
  label?: string;
  description: string;
  disabled?: boolean;
  pending?: boolean;
  allowCreate?: boolean;
  compact?: boolean;
  hideSelection?: boolean;
}

export function TagPicker({
  selectedIds,
  onChange,
  label = "Add tags",
  description,
  disabled,
  pending,
  allowCreate = true,
  compact,
  hideSelection,
}: TagPickerProps) {
  const state = usePositionTags();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const tags = state?.data?.tags ?? [];
  const selected = tags.filter((tag) => selectedIds.includes(tag.id));
  const filtered = tags.filter((tag) =>
    tag.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  const isDisabled =
    disabled ||
    pending ||
    !state?.data ||
    state.isRefreshing ||
    Boolean(state.error);
  async function created(tag: PositionTag) {
    await onChange([...selectedIds, tag.id]);
  }
  return (
    <div
      onClick={(event) => event.stopPropagation()}
      className="min-w-0"
      aria-busy={pending}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant={compact ? "ghost" : "outline"}
            size="sm"
            disabled={isDisabled}
            aria-label={label}
            className={cn(
              "max-w-full justify-start",
              // Untagged rows stay quiet until their row is hovered or focused.
              compact &&
                !selected.length &&
                "text-muted-foreground opacity-50 focus-visible:opacity-100 [tr:focus-within_&]:opacity-100 [tr:hover_&]:opacity-100",
            )}
          >
            {pending ? <Spinner /> : <Tags data-icon="inline-start" />}
            {selected.length > 0 && !hideSelection ? (
              <>
                {selected.slice(0, 2).map((tag) => (
                  <TagBadge key={tag.id} tag={tag} />
                ))}
                {selected.length > 2 && <span>+{selected.length - 2}</span>}
              </>
            ) : (
              label
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-80 max-w-[calc(100vw-2rem)]"
          onClick={(event) => event.stopPropagation()}
        >
          <p id={`${id}-description`} className="text-muted-foreground text-sm">
            {description}
          </p>
          <Input
            aria-label="Search tags"
            placeholder="Search tags…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <fieldset
            disabled={isDisabled}
            aria-describedby={`${id}-description`}
            className="flex max-h-60 min-w-0 flex-col gap-1 overflow-y-auto"
          >
            <legend className="sr-only">Tags</legend>
            {filtered.map((tag) => (
              <Label
                key={tag.id}
                htmlFor={`${id}-${tag.id}`}
                className="hover:bg-accent flex cursor-pointer items-center gap-3 rounded-md p-2"
              >
                <Checkbox
                  id={`${id}-${tag.id}`}
                  aria-label={tag.name}
                  checked={selectedIds.includes(tag.id)}
                  disabled={isDisabled}
                  onCheckedChange={(checked) =>
                    void onChange(
                      checked
                        ? [...selectedIds, tag.id]
                        : selectedIds.filter((value) => value !== tag.id),
                    )
                  }
                />
                <TagBadge tag={tag} className="max-w-full min-w-0 shrink" />
              </Label>
            ))}
            {!filtered.length && (
              <p className="text-muted-foreground py-3 text-sm">
                {tags.length
                  ? "No tags match your search."
                  : "No tags yet. Create one to organize your assets."}
              </p>
            )}
          </fieldset>
          {allowCreate && (
            <Button
              type="button"
              variant="outline"
              disabled={isDisabled}
              onClick={() => {
                setOpen(false);
                setCreating(true);
              }}
            >
              <Plus data-icon="inline-start" />
              Create tag
            </Button>
          )}
        </PopoverContent>
      </Popover>
      {creating && (
        <TagEditorDialog
          defaultName={search}
          onClose={() => setCreating(false)}
          onSaved={created}
        />
      )}
    </div>
  );
}
