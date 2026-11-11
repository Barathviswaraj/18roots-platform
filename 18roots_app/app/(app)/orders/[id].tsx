import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { Linking, StyleSheet, Text, View } from "react-native";

import { useOrder } from "@/api/queries";
import type { Order } from "@/api/schemas";
import { ProductBox } from "@/components/illustrations";
import { Screen } from "@/components/layout";
import { OrderStepper } from "@/components/OrderStepper";
import { ErrorState, LoadingCards } from "@/components/states";
import { Card, Divider, ListRow, SectionHeader } from "@/components/ui";
import { useLocale, useT } from "@/i18n";
import { env } from "@/lib/env";
import { formatDate, formatMoney, formatTime } from "@/lib/format";
import { colors, fonts, spacing, type } from "@/theme";

export default function OrderScreen() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const order = useOrder(id);

  return (
    <Screen title={t("orders.trackTitle")} onRefresh={() => order.refetch()} refreshing={order.isRefetching}>
      {order.isPending ? (
        <LoadingCards count={2} />
      ) : order.isError ? (
        <ErrorState error={order.error} onRetry={() => order.refetch()} />
      ) : (
        <OrderView order={order.data} />
      )}
    </Screen>
  );
}

function OrderView({ order }: { order: Order }) {
  const t = useT();
  const locale = useLocale();
  return (
    <View>
      <Card>
        <View style={styles.row}>
          <ProductBox size={68} />
          <View style={{ flex: 1 }}>
            <Text style={type.caption}>{t("home.order", { number: order.number })}</Text>
            <Text style={styles.status}>{t(`orders.status.${order.status}`)}</Text>
            {order.expectedAt && order.status !== "delivered" ? (
              <Text style={type.caption}>
                {t("orders.expected", {
                  date: `${formatDate(order.expectedAt, locale, { day: "numeric", month: "short" })}, ${formatTime(order.expectedAt, locale)}`,
                })}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={styles.stepper}>
          <OrderStepper status={order.status} />
        </View>
      </Card>

      <Card style={styles.timeline}>
        {order.timeline.map((entry, index) => {
          const done = !!entry.at;
          return (
            <View key={entry.status} style={styles.event}>
              <View style={styles.rail}>
                <View style={[styles.dot, done && styles.dotDone]}>
                  {done ? <Feather name="check" size={10} color={colors.white} /> : null}
                </View>
                {index < order.timeline.length - 1 ? <View style={[styles.railLine, done && styles.railDone]} /> : null}
              </View>
              <View style={styles.eventText}>
                <Text style={[type.bodyStrong, !done && { color: colors.muted }]}>
                  {t(`orders.status.${entry.status}`)}
                </Text>
                {entry.at ? (
                  <Text style={type.caption}>
                    {formatDate(entry.at, locale, { day: "numeric", month: "short" })}, {formatTime(entry.at, locale)}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </Card>

      <SectionHeader icon="package" title={t("orders.items")} />
      <Card>
        {order.items.map((item) => (
          <View key={item.id} style={styles.item}>
            <Text style={[type.body, { flex: 1 }]}>
              {item.name} × {item.quantity}
            </Text>
            <Text style={type.bodyStrong}>{formatMoney(item.unitPrice * item.quantity, locale)}</Text>
          </View>
        ))}
        <Divider />
        <View style={styles.item}>
          <Text style={type.bodyStrong}>{t("orders.total")}</Text>
          <Text style={styles.total}>{formatMoney(order.total, locale)}</Text>
        </View>
        <Text style={type.caption}>
          {t("orders.payment")}: {order.paymentMethod}
        </Text>
      </Card>

      <SectionHeader icon="map-pin" title={t("orders.deliveryAddress")} />
      <Card>
        <Text style={type.bodyStrong}>{order.address.name}</Text>
        <Text style={type.body}>{order.address.line1}</Text>
        {order.address.line2 ? <Text style={type.body}>{order.address.line2}</Text> : null}
        <Text style={type.body}>
          {order.address.city} {order.address.pincode}
        </Text>
      </Card>

      <Card style={styles.help}>
        <ListRow
          icon="phone"
          title={t("orders.help")}
          subtitle={env.supportPhone}
          onPress={() => Linking.openURL(`tel:${env.supportPhone}`)}
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  status: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  stepper: { marginTop: spacing.lg },
  timeline: { marginTop: spacing.lg },
  event: { flexDirection: "row", gap: spacing.md, minHeight: 52 },
  rail: { alignItems: "center", width: 18 },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  dotDone: { backgroundColor: colors.sage, borderColor: colors.sage },
  railLine: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
  railDone: { backgroundColor: colors.sage },
  eventText: { flex: 1, paddingBottom: spacing.md },
  item: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    gap: spacing.md,
  },
  total: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  help: { marginTop: spacing.xl, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm },
});
