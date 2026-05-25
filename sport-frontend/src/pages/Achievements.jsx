import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { Btn, Card, Input, SectionTitle, Select } from "../components/ui";
import { T } from "../tokens";

const CONDITION_LABELS = {
  completed_workouts: "Завершенные тренировки",
  distance_km: "Суммарная дистанция",
  morning_workouts: "Утренние тренировки",
  organized_workouts: "Организованные тренировки",
};

const CONDITION_UNITS = {
  completed_workouts: "трен.",
  distance_km: "км",
  morning_workouts: "трен.",
  organized_workouts: "трен.",
};

const ICONS = ["medal", "trophy", "route", "sunrise", "star", "zap", "flame", "crown"];

const EMPTY_FORM = {
  code: "",
  title: "",
  description: "",
  icon: "medal",
  conditionType: "completed_workouts",
  conditionValue: 1,
};

export function Achievements() {
  const [achievements, setAchievements] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const editing = useMemo(
    () => achievements.find(item => Number(item.id) === Number(editingId)) || null,
    [achievements, editingId],
  );

  const loadAchievements = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.adminAchievements();
      setAchievements(data.achievements || []);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAchievements();
  }, [loadAchievements]);

  const set = key => event => {
    const value = event.target.type === "number" ? Number(event.target.value) : event.target.value;
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const edit = achievement => {
    setEditingId(achievement.id);
    setMessage("");
    setForm({
      code: achievement.code || "",
      title: achievement.title || "",
      description: achievement.description || "",
      icon: achievement.icon || "medal",
      conditionType: achievement.condition?.type || "completed_workouts",
      conditionValue: achievement.condition?.value || 1,
    });
  };

  const save = async event => {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    const payload = {
      code: form.code.trim() || undefined,
      title: form.title,
      description: form.description,
      icon: form.icon,
      condition: {
        type: form.conditionType,
        value: Number(form.conditionValue),
      },
    };

    try {
      if (editing) {
        await api.updateAchievement(editing.id, payload);
        setMessage("Достижение обновлено");
      } else {
        await api.createAchievement(payload);
        setMessage("Достижение создано");
      }
      resetForm();
      await loadAchievements();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async achievement => {
    setSaving(true);
    setMessage("");
    try {
      await api.deleteAchievement(achievement.id);
      if (Number(editingId) === Number(achievement.id)) resetForm();
      setPendingDelete(null);
      await loadAchievements();
      setMessage("Достижение удалено");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: "32px 36px", flex: 1, overflowY: "auto", minWidth: 0 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: T.text }}>Достижения</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: T.textMuted }}>Создавайте награды и условия автоматического получения</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 380px", gap: 18, alignItems: "start" }}>
        <Card>
          <SectionTitle>Список достижений</SectionTitle>
          {loading && <div style={{ color: T.textMuted, fontSize: 13 }}>Загрузка...</div>}
          {!loading && achievements.map(achievement => (
            <div key={achievement.id} style={achievementRow}>
              <div style={iconBox}>{achievement.icon}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <strong style={{ color: T.text }}>{achievement.title}</strong>
                  <code style={codePill}>{achievement.code}</code>
                </div>
                <div style={{ marginTop: 4, color: T.textMuted, fontSize: 13 }}>{achievement.description}</div>
                <div style={{ marginTop: 8, color: T.textHint, fontSize: 12, fontWeight: 700 }}>
                  {conditionText(achievement.condition)} · получено: {achievement.earned_count || 0}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn onClick={() => edit(achievement)} disabled={saving}>Изменить</Btn>
                <Btn danger onClick={() => setPendingDelete(achievement)} disabled={saving}>Удалить</Btn>
              </div>
            </div>
          ))}
          {!loading && !achievements.length && (
            <div style={{ color: T.textMuted, fontSize: 13 }}>Достижений пока нет.</div>
          )}
        </Card>

        <Card>
          <SectionTitle>{editing ? "Редактирование" : "Новое достижение"}</SectionTitle>
          <form onSubmit={save} style={{ display: "grid", gap: 12 }}>
            <label style={fieldStyle}>
              <span>Название</span>
              <Input value={form.title} onChange={set("title")} required />
            </label>
            <label style={fieldStyle}>
              <span>Описание</span>
              <textarea
                value={form.description}
                onChange={set("description")}
                required
                rows={4}
                style={textareaStyle}
              />
            </label>
            <label style={fieldStyle}>
              <span>Код</span>
              <Input value={form.code} onChange={set("code")} placeholder="first_finish" />
            </label>
            <label style={fieldStyle}>
              <span>Значок</span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 92px", gap: 8 }}>
                <Select value={form.icon} onChange={set("icon")}>
                  {ICONS.map(icon => <option value={icon} key={icon}>{icon}</option>)}
                </Select>
                <Input value={form.icon} onChange={set("icon")} />
              </div>
            </label>
            <label style={fieldStyle}>
              <span>Условие</span>
              <Select value={form.conditionType} onChange={set("conditionType")}>
                {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                  <option value={value} key={value}>{label}</option>
                ))}
              </Select>
            </label>
            <label style={fieldStyle}>
              <span>Значение</span>
              <input
                type="number"
                min="1"
                step={form.conditionType === "distance_km" ? "0.1" : "1"}
                value={form.conditionValue}
                onChange={set("conditionValue")}
                required
                style={inputStyle}
              />
            </label>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <Btn variant="primary" type="submit" disabled={saving}>{editing ? "Сохранить" : "Создать"}</Btn>
              {editing && <Btn onClick={resetForm} disabled={saving}>Отмена</Btn>}
            </div>
          </form>
          {message && (
            <div style={{ marginTop: 12, color: message.includes("создан") || message.includes("обнов") || message.includes("удал") ? T.success : T.danger, fontSize: 13 }}>
              {message}
            </div>
          )}
        </Card>
      </div>

      {pendingDelete && (
        <div style={modalOverlay} role="presentation" onClick={() => !saving && setPendingDelete(null)}>
          <div style={modalCard} role="dialog" aria-modal="true" aria-labelledby="delete-achievement-title" onClick={event => event.stopPropagation()}>
            <div style={modalIcon}>!</div>
            <div>
              <h2 id="delete-achievement-title" style={modalTitle}>Удалить достижение?</h2>
              <p style={modalText}>
                “{pendingDelete.title}” исчезнет из списка и из профилей пользователей, которые уже его получили.
              </p>
            </div>
            <div style={modalActions}>
              <Btn onClick={() => setPendingDelete(null)} disabled={saving}>Отмена</Btn>
              <Btn danger onClick={() => remove(pendingDelete)} disabled={saving}>
                {saving ? "Удаление..." : "Удалить"}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function conditionText(condition = {}) {
  const label = CONDITION_LABELS[condition.type] || condition.type || "Условие";
  const unit = CONDITION_UNITS[condition.type] || "";
  return `${label}: ${condition.value || 0} ${unit}`.trim();
}

const achievementRow = {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  padding: "14px 0",
  borderBottom: `1px solid ${T.border}`,
};

const iconBox = {
  width: 42,
  height: 42,
  borderRadius: T.radius,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  background: T.accentLight,
  color: T.accent,
  border: `1px solid ${T.border}`,
  fontSize: 12,
  fontWeight: 800,
};

const codePill = {
  padding: "2px 6px",
  borderRadius: T.radiusSm,
  background: T.surfaceAlt,
  color: T.textMuted,
  fontSize: 12,
};

const fieldStyle = {
  display: "grid",
  gap: 6,
  fontSize: 13,
  fontWeight: 700,
  color: T.text,
};

const inputStyle = {
  background: T.surface,
  border: `1px solid ${T.border}`,
  borderRadius: T.radiusSm,
  padding: "9px 12px",
  fontSize: 13,
  color: T.text,
  outline: "none",
  fontFamily: "inherit",
};

const textareaStyle = {
  ...inputStyle,
  resize: "vertical",
};

const modalOverlay = {
  position: "fixed",
  inset: 0,
  zIndex: 50,
  display: "grid",
  placeItems: "center",
  padding: 24,
  background: "rgba(26, 25, 21, 0.45)",
};

const modalCard = {
  width: "min(100%, 420px)",
  display: "grid",
  gridTemplateColumns: "44px minmax(0, 1fr)",
  gap: 14,
  padding: 22,
  borderRadius: T.radiusLg,
  border: `1px solid ${T.border}`,
  background: T.surface,
  boxShadow: "0 24px 70px rgba(26, 25, 21, 0.24)",
};

const modalIcon = {
  width: 44,
  height: 44,
  display: "grid",
  placeItems: "center",
  borderRadius: "50%",
  background: T.dangerLight,
  color: T.danger,
  fontSize: 20,
  fontWeight: 900,
};

const modalTitle = {
  margin: 0,
  color: T.text,
  fontSize: 20,
  lineHeight: 1.2,
};

const modalText = {
  margin: "8px 0 0",
  color: T.textMuted,
  fontSize: 13,
  lineHeight: 1.5,
};

const modalActions = {
  gridColumn: "1 / -1",
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  marginTop: 8,
};
