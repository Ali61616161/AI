import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconBadge } from "@/components/ui/icon-badge";
import { Text } from "@/components/ui/text";
import { useIsOnline } from "@/features/offline/use-online";
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
  onGenerate: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [step, setStep] = useState(0);
  const online = useIsOnline();

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
            title={t("plan.generate")}
            disabled={!online}
            onPress={() => {
              setStep(0);
              onGenerate();
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
});
