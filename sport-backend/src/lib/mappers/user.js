export function publicUser(row) {
  if (!row) return null;
  const initials = (row.full_name || row.email || "U")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join("");

  return {
    id: row.id,
    email: row.hide_email ? null : row.email,
    phone: row.hide_phone ? null : row.phone,
    name: row.full_name,
    firstName: row.first_name,
    lastName: row.last_name,
    gender: row.gender,
    initials,
    avatarUrl: row.avatar_url,
    role: row.role,
    status: row.account_status,
    verified: row.verification_status,
    phoneVerified: row.phone_verified,
    emailVerified: row.email_verified,
    privacy: row.privacy_settings || {},
    registered: row.created_at,
    stats: {
      organizedWorkouts: Number(row.organized_workouts || 0),
      attendedWorkouts: Number(row.attended_workouts || 0),
      distance: Number(row.total_distance_km || 0),
      rating: row.average_rating ? Number(row.average_rating) : null,
      complaints: Number(row.complaints_count || 0),
    },
  };
}
