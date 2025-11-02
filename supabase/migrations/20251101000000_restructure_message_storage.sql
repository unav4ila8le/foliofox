ALTER TABLE conversation_messages
  ADD COLUMN parts JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;

-- Add index for efficient ordering queries
CREATE INDEX idx_conversation_messages_order
  ON conversation_messages(conversation_id, "order");
