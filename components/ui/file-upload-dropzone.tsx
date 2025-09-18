"use client";

import { useCallback } from "react";
import {
  useDropzone,
  type FileRejection,
  type DropzoneOptions,
} from "react-dropzone";
import { Upload, FileText, LoaderCircle, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface FileUploadDropzoneProps {
  // File restrictions
  accept: DropzoneOptions["accept"];
  maxSize?: number;
  maxFiles?: number;

  // Processing
  onFileSelect: (file: File, content: string) => Promise<void>;
  disabled?: boolean;

  // UI customization
  icon?: React.ReactNode;
  title?: string;
  description?: string;

  // Current state (controlled)
  selectedFile?: File | null;
  isProcessing?: boolean;
  onReset?: () => void;
}

export function FileUploadDropzone({
  accept,
  maxSize = 5 * 1024 * 1024, // 5MB default
  maxFiles = 1,
  onFileSelect,
  disabled = false,
  icon,
  title,
  description,
  selectedFile,
  isProcessing = false,
  onReset,
}: FileUploadDropzoneProps) {
  // Handle file drop/selection
  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      try {
        // Read file content based on type
        const content = await readFileContent(file);
        await onFileSelect(file, content);
      } catch (error) {
        console.error("Error reading file:", error);
        toast.error("Failed to read file");
      }
    },
    [onFileSelect],
  );

  // Handle file rejection
  const onDropRejected = useCallback(
    (rejectedFiles: FileRejection[]) => {
      const rejection = rejectedFiles[0];
      const errorCode = rejection?.errors?.[0]?.code;

      let message = "Invalid file. Please try again.";

      if (errorCode === "file-too-large") {
        const maxSizeMB = maxSize / (1024 * 1024);
        message = `File is too large. Maximum size is ${maxSizeMB}MB.`;
      } else if (errorCode === "file-invalid-type") {
        message = "Invalid file type. Please select a supported file.";
      }

      toast.error(message);
    },
    [maxSize],
  );

  // Setup dropzone
  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({
      onDrop,
      onDropRejected,
      accept,
      maxSize,
      maxFiles,
      multiple: maxFiles > 1,
      disabled: disabled || isProcessing,
    });

  // Helper function to read file content
  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  // Handle reset
  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    onReset?.();
  };

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          "bg-muted/30 relative rounded-lg border border-dashed p-6 text-center transition-colors",
          "hover:bg-muted hover:border-primary/50",
          isDragActive && "bg-muted border-primary/50",
          isDragReject && "bg-destructive/10 border-destructive",
          (isProcessing || disabled) && "pointer-events-none opacity-50",
        )}
      >
        <input {...getInputProps()} />

        {isProcessing ? (
          <div className="flex items-center justify-center py-4">
            <LoaderCircle className="mr-2 size-4 animate-spin" />
            <span>Processing file...</span>
          </div>
        ) : selectedFile ? (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-1">
              <FileText className="size-4 flex-none" />
              <div className="font-medium">{selectedFile.name}</div>
              {onReset && (
                <button
                  onClick={handleReset}
                  className="text-muted-foreground hover:text-foreground absolute top-2 right-2"
                >
                  <X className="size-4" />
                  <span className="sr-only">Reset</span>
                </button>
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              {(selectedFile.size / 1024).toFixed(1)} KB
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {icon || (
              <Upload className="text-muted-foreground mx-auto size-8" />
            )}
            <div>
              <p className="font-medium">
                {title ||
                  (isDragActive
                    ? "Drop your file here"
                    : "Drag and drop your file here")}
              </p>
              <p className="text-muted-foreground text-sm">
                {description ||
                  `or click to browse (max ${Math.round(maxSize / (1024 * 1024))}MB)`}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
