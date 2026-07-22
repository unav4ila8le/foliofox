begin;

do $$
declare
  active_duplicates text;
begin
  select string_agg(
    format('%s/%s/%s (%s rows)', source, type, value, row_count),
    ', '
    order by source, type, value
  )
  into active_duplicates
  from (
    select source, type, value, count(*) as row_count
    from public.symbol_aliases
    where type = 'ticker'
      and effective_to is null
    group by source, type, value
    having count(*) > 1
  ) duplicates;

  if active_duplicates is not null then
    raise exception 'Active ticker alias duplicates must be retired before migration: %', active_duplicates;
  end if;
end $$;

drop index public.symbol_aliases_symbol_type_value_effective_to_idx;

create unique index symbol_aliases_symbol_source_type_value_effective_to_idx
  on public.symbol_aliases (
    symbol_id,
    source,
    type,
    value,
    coalesce(effective_to, 'infinity'::timestamptz)
  );

alter table public.symbols
  drop constraint symbols_ticker_key;

create unique index symbol_aliases_active_ticker_source_value_key
  on public.symbol_aliases (source, value)
  where type = 'ticker'
    and effective_to is null;

commit;
