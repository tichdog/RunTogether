export const reportInclude = {
  users_reports_reporter_idTousers: true,
  users_reports_reported_user_idTousers: true,
  users_reports_moderator_idTousers: true,
}

export function mapReport(row) {
  const reporter = row.users_reports_reporter_idTousers
  const reported = row.users_reports_reported_user_idTousers
  const moderator = row.users_reports_moderator_idTousers

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
      id: reporter?.id || row.reporter_id,
      name: reporter?.full_name,
      email: reporter?.email,
    },
    reportedUser: {
      id: reported?.id || row.reported_user_id,
      name: reported?.full_name,
      email: reported?.email,
      role: reported?.role,
      status: reported?.account_status,
      warnings: Number(reported?.warning_count || 0),
      blockedUntil: reported?.blocked_until,
    },
    moderator: row.moderator_id
      ? {
          id: row.moderator_id,
          name: moderator?.full_name,
        }
      : null,
  }
}
