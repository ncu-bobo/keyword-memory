create index if not exists review_logs_user_idx
  on public.review_logs(user_id);

create index if not exists review_logs_knowledge_item_idx
  on public.review_logs(knowledge_item_id);

drop policy if exists "Users can manage own knowledge items" on public.knowledge_items;
create policy "Users can manage own knowledge items"
  on public.knowledge_items
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage own review logs" on public.review_logs;
create policy "Users can manage own review logs"
  on public.review_logs
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage own tags" on public.tags;
create policy "Users can manage own tags"
  on public.tags
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
