export const REPORT_SELECT = `
  select r.*,
         reporter.id as reporter_user_id,
         reporter.full_name as reporter_name,
         reporter.email as reporter_email,
         reported.id as reported_target_id,
         reported.full_name as reported_user_name,
         reported.email as reported_user_email,
         reported.role as reported_user_role,
         reported.account_status as reported_user_status,
         reported.warning_count as reported_user_warnings,
         reported.blocked_until as reported_user_blocked_until,
         moderator.full_name as moderator_name
    from reports r
    join users reporter on reporter.id = r.reporter_id
    join users reported on reported.id = r.reported_user_id
    left join users moderator on moderator.id = r.moderator_id
`

export function mapReport(row) {
  return {
    id: row.id,
    reason: row.reason,
    details: row.details,
    status: row.status,
    action: row.resolution_action,
    moderatorComment: row.moderator_comment,
    banUntil: row.ban_until,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    reporter: {
      id: row.reporter_user_id || row.reporter_id,
      name: row.reporter_name,
      email: row.reporter_email,
    },
    reportedUser: {
      id: row.reported_target_id || row.reported_user_id,
      name: row.reported_user_name,
      email: row.reported_user_email,
      role: row.reported_user_role,
      status: row.reported_user_status,
      warnings: Number(row.reported_user_warnings || 0),
      blockedUntil: row.reported_user_blocked_until,
    },
    moderator: row.moderator_id
      ? {
          id: row.moderator_id,
          name: row.moderator_name,
        }
      : null,
  }
}
