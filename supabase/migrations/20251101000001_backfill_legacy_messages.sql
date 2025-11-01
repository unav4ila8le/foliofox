-- Backfill migration for legacy messages created before schema change
-- This migration handles existing data that only has content (no parts, no message_order)

-- Step 1: Backfill message_order based on created_at timestamp
-- Assigns sequential order (0, 1, 2...) per conversation, ordered by creation time
WITH ordered_messages AS (
  SELECT
    id,
    conversation_id,
    ROW_NUMBER() OVER (
      PARTITION BY conversation_id
      ORDER BY created_at ASC
    ) - 1 AS new_order
  FROM conversation_messages
  WHERE message_order = 0  -- Only backfill messages with default order
)
UPDATE conversation_messages cm
SET message_order = om.new_order
FROM ordered_messages om
WHERE cm.id = om.id;

-- Step 2: Backfill parts column from content field
-- Converts plain text content into proper parts array format: [{ "type": "text", "text": "..." }]
-- Leaves content field untouched for backward compatibility
UPDATE conversation_messages
SET parts = jsonb_build_array(
  jsonb_build_object(
    'type', 'text',
    'text', content
  )
)
WHERE parts = '[]'::jsonb  -- Only update empty parts (legacy messages)
  AND content IS NOT NULL
  AND content != '';
