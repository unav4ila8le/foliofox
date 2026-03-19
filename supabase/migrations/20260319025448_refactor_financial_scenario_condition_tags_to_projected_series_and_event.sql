BEGIN;

UPDATE public.financial_scenarios
SET
  events = (
    CASE
      WHEN jsonb_typeof(events) <> 'array' THEN events
      ELSE (
        SELECT COALESCE(
          jsonb_agg(
            CASE
              WHEN jsonb_typeof(event_item) <> 'object' THEN event_item
              WHEN jsonb_typeof(event_item -> 'unlockedBy') <> 'array' THEN event_item
              ELSE jsonb_set(
                event_item,
                '{unlockedBy}',
                (
                  SELECT COALESCE(
                    jsonb_agg(
                      CASE
                        WHEN jsonb_typeof(condition_item) <> 'object' THEN condition_item
                        WHEN condition_item ->> 'type' IN ('networth-is-above', 'cash-is-above') THEN
                          jsonb_set(
                            condition_item,
                            '{tag}',
                            to_jsonb('projected-series'::text),
                            false
                          )
                        WHEN condition_item ->> 'type' IN ('event-happened', 'income-is-above') THEN
                          jsonb_set(
                            condition_item,
                            '{tag}',
                            to_jsonb('event'::text),
                            false
                          )
                        ELSE condition_item
                      END
                    ),
                    '[]'::jsonb
                  )
                  FROM jsonb_array_elements(event_item -> 'unlockedBy') AS condition_item
                ),
                false
              )
            END
          ),
          '[]'::jsonb
        )
        FROM jsonb_array_elements(events) AS event_item
      )
    END
  ),
  engine_version = GREATEST(engine_version, 2)
WHERE jsonb_typeof(events) = 'array';

UPDATE public.financial_scenarios
SET engine_version = 2
WHERE
  engine_version < 2
  AND jsonb_typeof(events) IS DISTINCT FROM 'array';

COMMIT;
