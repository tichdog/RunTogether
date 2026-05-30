const ADMIN_ROLES = new Set(['admin', 'super_admin'])

function canViewPrivateContacts(row, viewer) {
  if (!viewer) return false
  return ADMIN_ROLES.has(viewer.role) || Number(row.id) === Number(viewer.id)
}

export function publicUser(row, { viewer } = {}) {
  if (!row) return null
  const hideEmail = Boolean(row.hide_email ?? row.privacy_settings?.hide_email)
  const hidePhone = Boolean(row.hide_phone ?? row.privacy_settings?.hide_phone)
  const revealPrivateContacts = canViewPrivateContacts(row, viewer)
  const initials = (row.full_name || row.email || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return {
    id: row.id,
    email: hideEmail && !revealPrivateContacts ? null : row.email,
    phone: hidePhone && !revealPrivateContacts ? null : row.phone,
    name: row.full_name,
    firstName: row.first_name,
    lastName: row.last_name,
    gender: row.gender,
    initials,
    avatarUrl: row.avatar_url,
    role: row.role,
    status: row.account_status,
    moderation: {
      warnings: Number(row.warning_count || 0),
      blockedUntil: row.blocked_until,
      blockReason: row.block_reason,
    },
    verified: row.verification_status,
    phoneVerified: row.phone_verified,
    emailVerified: row.email_verified,
    privacy: row.privacy_settings || {},
    registered: row.created_at,
    achievements: Array.isArray(row.achievements) ? row.achievements : [],
    stats: {
      organizedWorkouts: Number(row.organized_workouts || 0),
      attendedWorkouts: Number(row.attended_workouts || 0),
      distance: Number(row.total_distance_km || 0),
      rating: row.average_rating ? Number(row.average_rating) : null,
      complaints: Number(row.complaints_count || 0),
    },
  }
}
