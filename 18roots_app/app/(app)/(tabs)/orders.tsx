import { router } from "expo-router";
import { memo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useOrders } from "@/api/queries";
import type { Order } from "@/api/schemas";
import { ProductBox } from "@/components/illustrations";
import { Screen } from "@/components/layout";
import { OrderStepper } from "@/components/OrderStepper";
import { EmptyState, ErrorState, LoadingCards } from "@/components/states";
import { Card, Chip, StatusPill } from "@/components/ui";
import { useLocale, useT } from "@/i18n";
import { formatDate, formatMoney } from "@/lib/format";
import { colors, fonts, spacing, type } from "@/theme";

type Filter = "all" | "active" | "delivered";

export default function OrdersScreen() {
  const t = useT();
  const [filter, setFilter] = useState<Filter>("all");
  const orders = useOrders(filter);

  return (
    <Screen tab title={t("orders.title")} onRefresh={() => orders.refetch()} refreshing={orders.isRefetching}>
      <View style={styles.filters}>
        {(["all", "active", "delivered"] as const).map((item) => (
          <Chip
            key={item}
            label={t(`orders.filter.${item}`)}
            selected={filter === item}
            onPress={() => setFilter(item)}
          />
        ))}
      </View>
      {orders.isPending ? (
        <LoadingCards count={2} />
      ) : orders.isError ? (
        <ErrorState error={orders.error} onRetry={() => orders.refetch()} />
      ) : orders.data.length === 0 ? (
        <EmptyState icon="shopping-bag" title={t("orders.empty")} />
      ) : (
        orders.data.map((order) => <OrderCard key={order.id} order={order} />)
      )}
    </Screen>
  );
}

const OrderCard = memo(function OrderCard({ order }: { order: Order }) {
  const t = useT();
  const locale = useLocale();
  const count = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const active = !["delivered", "cancelled"].includes(order.status);
  return (
    <Card
      style={styles.card}
      onPress={() => router.push(`/orders/${order.id}`)}
      accessibilityLabel={t("home.order", { number: order.number })}
    >
      <View style={styles.row}>
        <ProductBox size={60} />
        <View style={{ flex: 1 }}>
          <Text style={type.caption}>{t("home.order", { number: order.number })}</Text>
          <Text style={styles.status}>{t(`orders.status.${order.status}`)}</Text>
          <Text style={type.caption}>
            {count === 1 ? t("orders.itemCountOne") : t("orders.itemCount", { count })} ·{" "}
            {formatMoney(order.total, locale)}
          </Text>
        </View>
        <StatusPill
          label={formatDate(order.placedAt, locale, { day: "numeric", month: "short" })}
          tone={active ? "sage" : "muted"}
        />
      </View>
      {active ? (
        <View style={styles.stepper}>
          <OrderStepper status={order.status} />
        </View>
      ) : null}
    </Card>
  );
});

const styles = StyleSheet.create({
  filters: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  card: { marginBottom: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  status: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  stepper: { marginTop: spacing.lg },
});
