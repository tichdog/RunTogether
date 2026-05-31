function canViewEmail(row, viewer, settings) {
  if (!viewer) return false
  if (Number(row.id) === Number(viewer.id)) return true
  if (viewer.role === 'super_admin') return true
  if (viewer.role === 'admin') return settings?.admins_can_view_user_emails !== false
  return false
}

function canViewPhone(row, viewer, settings) {
  if (!viewer) return false
  if (Number(row.id) === Number(viewer.id)) return true
  if (viewer.role === 'super_admin') return true
  if (viewer.role === 'admin') return settings?.admins_can_view_user_phones !== false
  return false
}

function isRestrictedAdminContact(row, viewer, allowed) {
  return viewer?.role === 'admin' && Number(row.id) !== Number(viewer.id) && !allowed
}

export function publicUser(row, { viewer, settings } = {}) {
  if (!row) return null
  const hideEmail = Boolean(row.hide_email ?? row.privacy_settings?.hide_email)
  const hidePhone = Boolean(row.hide_phone ?? row.privacy_settings?.hide_phone)
  const revealEmail = canViewEmail(row, viewer, settings)
  const revealPhone = canViewPhone(row, viewer, settings)
  const restrictEmailForAdmin = isRestrictedAdminContact(row, viewer, revealEmail)
  const restrictPhoneForAdmin = isRestrictedAdminContact(row, viewer, revealPhone)
  const initials = (row.full_name || row.email || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return {
    id: row.id,
    email: restrictEmailForAdmin || (hideEmail && !revealEmail) ? null : row.email,
    phone: restrictPhoneForAdmin || (hidePhone && !revealPhone) ? null : row.phone,
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
