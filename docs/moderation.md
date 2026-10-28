# Reports, blocks and account deletion

Apple requires apps with user content (names, drawn avatars, comments, category ideas,
league names) to let players report content and block players, and the developer to act
on reports **within 24 hours**. It also requires a way to delete your account in the app.

## Where things are in the app

- **Report or block a player**: league screen → Players → **•••** next to their name.
- **Report a comment**: finished round → **Report** next to the comment. After reporting,
  the app offers to block the commenter too.
- **Blocked players**: Settings shows the list, with Unblock.
- **Delete account**: Settings → **Delete account**.

Blocking hides the blocked player's name (shown as "Blocked player"), avatar, comments and
category ideas from you, and hides your comments from them. Their songs stay in the game,
so rounds and scores still work.

Deleting an account removes the profile and everything tied to it. Leagues the player hosts
pass to the player who joined earliest, or are deleted if they were the only player. A round
in progress moves on without them, the same as when someone leaves.

## Get notified about reports

Add yourself as an admin once, and you'll get a push notification on your phone for every
report and block:

1. Supabase dashboard → **Table Editor → profiles**, and copy the `id` of your row (find it by
   your display name).
2. **Table Editor → app_admins → Insert row**, paste it as `user_id`, **Save**.

## Act on a report

1. Supabase dashboard → **Table Editor → reports**. Unresolved reports have an empty
   `resolved_at`. `reported_text` is a copy of the comment, `reported_name` the player's name
   at the time.
2. Decide what to do:
   - **Remove a comment**: **Table Editor → song_comments**, filter `voter_id` = the report's
     `reported_user_id` and `submission_id` = the report's `submission_id`, and delete the row.
   - **Fix an offensive name or avatar**: **profiles**, edit `display_name` or clear
     `avatar_doodle` on their row.
   - **Remove the player**: **Authentication → Users**, find them by the `reported_user_id`,
     then **Delete user**. Their content goes with them.
   - **Nothing wrong**: just resolve it.
3. Fill in `resolved_at` (now) and a short `resolution` such as "comment removed".

Blocks are in **Table Editor → blocks** if you want to see who blocked whom.

## Requests by email

If someone emails asking to delete an account they can't get into, delete them under
**Authentication → Users**. Leagues they host need a new host first: in **groups**, change
`created_by` to another player's id (or delete the league if nobody else is in it).
