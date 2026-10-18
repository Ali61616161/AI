import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconBadge } from "@/components/ui/icon-badge";
import { Chip } from "@/components/ui/chip";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { useIsOnline } from "@/features/offline/use-online";
import { INTERESTS } from "@/features/profile/options";
import { useSessionStore } from "@/stores/session-store";
import { buildPlanOptions, DIETS, PACES, type PlanOptions } from "./plan-options";
import { Radius, Spacing } from "@/theme/tokens";
import { useTheme } from "@/theme/use-theme";

const STEPS = [
  "plan.generating1",
  "plan.generating2",
  "plan.generating3",
] as const;

/** Rota yokken gösterilen kart; üretim sürerken adım adım ilerleme mesajı gösterir. */
export function GenerateCard({
  pending,
  error,
  onGenerate,
}: {
  pending: boolean;
  error: string | null;
  onGenerate: (options: PlanOptions) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [step, setStep] = useState(0);
  const online = useIsOnline();
  // İsteğe bağlı kişiselleştirme: boş bırakılırsa profildeki tercihlerle plan yapılır.
  const profileInterests = useSessionStore((s) => s.preferences.interests);
  const [open, setOpen] = useState(false);
  const [pace, setPace] = useState<PlanOptions["pace"] | null>(null);
  const [diets, setDiets] = useState<string[]>([]);
  const [stepFree, setStepFree] = useState(false);
  const [interests, setInterests] = useState<string[]>(profileInterests);
  const [notes, setNotes] = useState("");
  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  useEffect(() => {
    if (!pending) return;
    const id = setInterval(
      () => setStep((s) => Math.min(s + 1, STEPS.length - 1)),
      6000,
    );
    return () => clearInterval(id);
  }, [pending]);

  return (
    <Card variant="glow" padding={Spacing.xl}>
      <View style={styles.card}>
        {pending ? (
          <View style={[styles.icon, { backgroundColor: colors.surfaceMuted }]}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <IconBadge icon="sparkles" tone="gradient" size={60} />
        )}
        <Text variant="subtitle" style={styles.center}>
          {pending ? t(STEPS[step]) : t("plan.emptyTitle")}
        </Text>
        <Text variant="body" color="textSecondary" style={styles.center}>
          {pending ? t("plan.generatingHint") : t("plan.emptyBody")}
        </Text>
        {error && (
          <Text variant="caption" color="danger" style={styles.center}>
            {error}
          </Text>
        )}
        {!pending && !online && (
          <Text variant="caption" color="warning" style={styles.center}>
            {t("offline.aiUnavailable")}
          </Text>
        )}
        {!pending && (
          <Button
            title={open ? t("plan.customizeHide") : t("plan.customize")}
            variant="ghost"
            icon={open ? "chevron-up" : "options-outline"}
            onPress={() => setOpen((v) => !v)}
            style={styles.button}
          />
        )}
        {!pending && open && (
          <View style={styles.options}>
            <Text variant="caption" color="textMuted">
              {t("plan.customizeHint")}
            </Text>
            <Text variant="overline" color="textMuted">
              {t("plan.pace.title")}
            </Text>
            <View style={styles.chips}>
              {PACES.map((p) => (
                <Chip key={p.value} icon={p.icon} label={t(`plan.pace.${p.value}`)} selected={(pace ?? "balanced") === p.value} onPress={() => setPace(p.value)} />
              ))}
            </View>
            <Text variant="overline" color="textMuted">
              {t("plan.diet.title")}
            </Text>
            <View style={styles.chips}>
              {DIETS.map((d) => (
                <Chip key={d.value} icon={d.icon} label={t(`plan.diet.${d.value}`)} selected={diets.includes(d.value)} onPress={() => setDiets(toggle(diets, d.value))} />
              ))}
              <Chip icon="walk-outline" label={t("plan.stepFree")} selected={stepFree} onPress={() => setStepFree((v) => !v)} />
            </View>
            <Text variant="overline" color="textMuted">
              {t("plan.interestsTitle")}
            </Text>
            <View style={styles.chips}>
              {INTERESTS.map((i) => (
                <Chip key={i.value} icon={i.icon} label={t(`interest.${i.value}` as "interest.art")} selected={interests.includes(i.value)} onPress={() => setInterests(toggle(interests, i.value))} />
              ))}
            </View>
            <TextField
              label={t("plan.notesLabel")}
              placeholder={t("plan.notesPlaceholder")}
              value={notes}
              onChangeText={setNotes}
              multiline
              maxLength={1000}
            />
          </View>
        )}
        {!pending && (
          <Button
            title={t("plan.generate")}
            disabled={!online}
            onPress={() => {
              setStep(0);
              onGenerate(buildPlanOptions({ pace, diets, stepFree, interests, profileInterests, notes }));
            }}
            style={styles.button}
          />
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: "center", gap: Spacing.md },
  icon: {
    width: 64,
    height: 64,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { textAlign: "center" },
  button: { alignSelf: "stretch" },
  options: { alignSelf: "stretch", gap: Spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
});
