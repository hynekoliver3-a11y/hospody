import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Translator } from "@/i18n/translate";
import { ALLERGEN_IDS, groupByCategory } from "@/lib/allergens";
import type { PublicMenu } from "@/lib/supabase/anon";

const s = StyleSheet.create({
  page: { fontFamily: "Noto Sans", fontSize: 9, color: "#0f172a", padding: 28 },
  top: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  title: { fontSize: 18, fontWeight: 700, color: "#0b3b75" },
  muted: { color: "#475569" },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#94a3b8", minHeight: 18, alignItems: "center" },
  head: { flexDirection: "row", borderBottomWidth: 1.2, borderBottomColor: "#0f172a", alignItems: "flex-end", paddingBottom: 3 },
  dish: { flex: 1, paddingRight: 6, paddingVertical: 3 },
  cell: { width: 26, textAlign: "center" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#0f172a" },
  cat: { fontWeight: 700, fontSize: 10, marginTop: 8, paddingVertical: 2, backgroundColor: "#e2e8f0", paddingHorizontal: 4 },
  legend: { flexDirection: "row", flexWrap: "wrap", marginTop: 14, gap: 2 },
  legendItem: { width: "33%", flexDirection: "row" },
});

export function AllergenTable({ menu, t, qrDataUrl, url }: { menu: PublicMenu; t: Translator; qrDataUrl: string; url: string }) {
  return (
    <Document title={`${t("menuPublic.pdfTitle")} – ${menu.location.name}`} author={menu.company.name} language="cs">
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.top}>
          <View>
            <Text style={s.title}>{t("menuPublic.pdfTitle")}</Text>
            <Text style={{ fontSize: 11, fontWeight: 700 }}>{menu.location.name}</Text>
            <Text style={s.muted}>{menu.company.name}</Text>
          </View>
          <View style={{ alignItems: "center" }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={qrDataUrl} style={{ width: 70, height: 70 }} />
            <Text style={[s.muted, { fontSize: 7 }]}>{url}</Text>
          </View>
        </View>

        <View style={s.head} fixed>
          <Text style={[s.dish, { fontWeight: 700 }]}>{t("menuPublic.pdfDish")}</Text>
          {ALLERGEN_IDS.map((id) => (
            <Text key={id} style={[s.cell, { fontWeight: 700 }]}>
              {id}
            </Text>
          ))}
        </View>
        {groupByCategory(menu.items).map(([category, list]) => (
          <View key={category || "-"}>
            {category ? <Text style={s.cat}>{category}</Text> : null}
            {list.map((item, i) => (
              <View key={i} style={s.row} wrap={false}>
                <Text style={s.dish}>{item.name}</Text>
                {ALLERGEN_IDS.map((id) => (
                  // kolečko kreslené tvarem – znak "●" font Noto Sans neobsahuje
                  <View key={id} style={[s.cell, { alignItems: "center" }]}>
                    {item.allergens.includes(id) ? <View style={s.dot} /> : null}
                  </View>
                ))}
              </View>
            ))}
          </View>
        ))}

        <View style={s.legend} wrap={false}>
          {ALLERGEN_IDS.map((id) => (
            <View key={id} style={s.legendItem}>
              <Text style={{ width: 16, fontWeight: 700 }}>{id}</Text>
              <Text>{t(`allergens.${id}`)}</Text>
            </View>
          ))}
        </View>
        <Text style={[s.muted, { marginTop: 10, fontSize: 8 }]}>{t("menuPublic.pdfFooter")}</Text>
      </Page>
    </Document>
  );
}
