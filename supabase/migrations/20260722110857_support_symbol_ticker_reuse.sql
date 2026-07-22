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
    where effective_to is null
    group by source, type, value
    having count(*) > 1
  ) duplicates;

  if active_duplicates is not null then
    raise exception 'Active symbol alias duplicates must be retired before migration: %', active_duplicates;
  end if;
end $$;

alter table public.symbols
  drop constraint symbols_ticker_key;

create unique index symbol_aliases_active_source_type_value_key
  on public.symbol_aliases (source, type, value)
  where effective_to is null;

commit;
