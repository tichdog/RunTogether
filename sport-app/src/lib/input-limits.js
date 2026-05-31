export const INPUT_LIMITS = Object.freeze({
  login: 254,
  email: 254,
  password: 128,
  firstName: 15,
  lastName: 20,
  phone: 32,
  search: 120,
  reportReason: 120,
  reportDetails: 1000,
  moderatorComment: 500,
  userBlockReason: 300,
  banMaxDays: 3600,
  workoutTitle: 80,
  workoutDescription: 600,
  workoutMeetingName: 120,
  workoutMeetingAddress: 160,
  workoutRouteName: 120,
  workoutCancelReason: 300,
  reviewText: 1000,
  achievementTitle: 32,
  achievementDescription: 300,
  achievementCode: 20,
  achievementIcon: 180,
  achievementConditionValue: 100000,
})

export function trimText(value) {
  return String(value ?? '').trim()
}

export function truncateText(value, maxLength) {
  return trimText(value).slice(0, maxLength)
}
