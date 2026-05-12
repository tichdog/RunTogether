import { query } from "../config/db.js";

const DEFAULTS = {
  require_verified_to_create_workouts: true,
  require_email_verification: false,
  require_phone_verification: false,
  default_participant_limit: 20,
  auto_block_complaints_count: 10,
};

export async function getSettings() {
  const { rows } = await query("select key, value from system_settings");
  return rows.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, { ...DEFAULTS });
}

export async function upsertSettings(values) {
  const allowed = Object.keys(DEFAULTS);
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      await query(
        `insert into system_settings (key, value)
         values ($1, $2::jsonb)
         on conflict (key) do update set value = excluded.value, updated_at = now()`,
        [key, JSON.stringify(values[key])],
      );
    }
  }
  return getSettings();
}
