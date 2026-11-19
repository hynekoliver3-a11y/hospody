import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Translator } from "@/i18n/translate";

export interface ReportRow {
  time: string;
  task: string;
  result: string;
  who: string;
  note: string;
  kind: "ok" | "deviation" | "missed";
}

export interface ReportDay {
  label: string;
  rows: ReportRow[];
}

export interface ReportData {
  company: { name: string; ico: string | null; address: string | null };
  location: { name: string; address: string | null };
  period: string;
  generated: string;
  summary: { records: number; deviations: number; missed: number };
  days: ReportDay[];
}

const C = { ink: "#0f172a", muted: "#475569", line: "#cbd5e1", brand: "#0b3b75", danger: "#b91c1c", dangerBg: "#fee2e2", warn: "#92400e", warnBg: "#fef3c7" };

const s = StyleSheet.create({
  page: { fontFamily: "Noto Sans", fontSize: 8.5, color: C.ink, paddingTop: 32, paddingBottom: 44, paddingHorizontal: 32 },
  title: { fontSize: 15, fontWeight: 700, color: C.brand, marginBottom: 8 },
  header: { flexDirection: "row", gap: 16, borderBottomWidth: 1.5, borderBottomColor: C.ink, paddingBottom: 8, marginBottom: 8 },
  headerCol: { flex: 1, gap: 2 },
  label: { color: C.muted, fontSize: 7.5 },
  strong: { fontWeight: 700 },
  summary: { flexDirection: "row", gap: 16, marginBottom: 10 },
  summaryBox: { borderWidth: 1, borderColor: C.line, borderRadius: 3, paddingVertical: 4, paddingHorizontal: 8 },
  day: { marginTop: 8 },
  dayTitle: { fontSize: 10, fontWeight: 700, backgroundColor: "#e2e8f0", paddingVertical: 3, paddingHorizontal: 6 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.line, paddingVertical: 3, paddingHorizontal: 6 },
  head: { flexDirection: "row", paddingVertical: 3, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: C.ink },
  cTime: { width: "8%" },
  cTask: { width: "24%", paddingRight: 4 },
  cResult: { width: "22%", paddingRight: 4 },
  cWho: { width: "14%", paddingRight: 4 },
  cNote: { width: "32%" },
  footer: { position: "absolute", bottom: 18, left: 32, right: 32, flexDirection: "row", justifyContent: "space-between", color: C.muted, fontSize: 7 },
  signature: { marginTop: 24, flexDirection: "row", gap: 8 },
  signatureLine: { flex: 1, borderBottomWidth: 0.75, borderBottomColor: C.ink },
});

export function HaccpReport({ data, t }: { data: ReportData; t: Translator }) {
  const p = (k: string, v?: Record<string, string | number>) => t(`export.pdf.${k}`, v);
  return (
    <Document title={`${p("title")} – ${data.location.name} – ${data.period}`} author={data.company.name} language="cs">
      <Page size="A4" style={s.page}>
        <Text style={s.title}>{p("title")}</Text>
        <View style={s.header}>
          <View style={s.headerCol}>
            <Text style={s.label}>{p("company")}</Text>
            <Text style={s.strong}>{data.company.name}</Text>
            {data.company.ico && <Text>{p("ico")}: {data.company.ico}</Text>}
            {data.company.address && <Text>{data.company.address}</Text>}
          </View>
          <View style={s.headerCol}>
            <Text style={s.label}>{p("location")}</Text>
            <Text style={s.strong}>{data.location.name}</Text>
            {data.location.address && <Text>{data.location.address}</Text>}
          </View>
          <View style={s.headerCol}>
            <Text style={s.label}>{p("period")}</Text>
            <Text style={s.strong}>{data.period}</Text>
            <Text style={s.label}>{p("generated", { date: data.generated })}</Text>
          </View>
        </View>

        <View style={s.summary}>
          <Text style={s.summaryBox}>
            {p("records")}: <Text style={s.strong}>{data.summary.records}</Text>
          </Text>
          <Text style={[s.summaryBox, data.summary.deviations ? { borderColor: C.danger, color: C.danger } : {}]}>
            {p("deviations")}: <Text style={s.strong}>{data.summary.deviations}</Text>
          </Text>
          <Text style={[s.summaryBox, data.summary.missed ? { borderColor: C.warn, color: C.warn } : {}]}>
            {p("missed")}: <Text style={s.strong}>{data.summary.missed}</Text>
          </Text>
        </View>

        <View style={s.head} fixed>
          <Text style={[s.cTime, s.strong]}>{p("time")}</Text>
          <Text style={[s.cTask, s.strong]}>{p("task")}</Text>
          <Text style={[s.cResult, s.strong]}>{p("result")}</Text>
          <Text style={[s.cWho, s.strong]}>{p("who")}</Text>
          <Text style={[s.cNote, s.strong]}>{p("note")}</Text>
        </View>

        {data.days.length === 0 && <Text style={{ marginTop: 8 }}>{p("noRecords")}</Text>}
        {data.days.map((day) => (
          <View key={day.label} style={s.day}>
            <Text style={s.dayTitle} minPresenceAhead={40}>
              {day.label}
            </Text>
            {day.rows.map((r, i) => (
              <View
                key={i}
                wrap={false}
                style={[
                  s.row,
                  r.kind === "deviation" ? { backgroundColor: C.dangerBg } : {},
                  r.kind === "missed" ? { backgroundColor: C.warnBg } : {},
                ]}
              >
                <Text style={s.cTime}>{r.time}</Text>
                <Text style={s.cTask}>{r.task}</Text>
                <Text
                  style={[
                    s.cResult,
                    r.kind === "deviation" ? { color: C.danger, fontWeight: 700 } : {},
                    r.kind === "missed" ? { color: C.warn, fontWeight: 700 } : {},
                  ]}
                >
                  {r.result}
                </Text>
                <Text style={s.cWho}>{r.who}</Text>
                <Text style={[s.cNote, r.kind === "deviation" ? { color: C.danger } : {}]}>{r.note}</Text>
              </View>
            ))}
          </View>
        ))}

        <View style={s.signature} wrap={false}>
          <Text>{p("signature")}</Text>
          <View style={s.signatureLine} />
        </View>

        <View style={s.footer} fixed>
          <Text>
            {data.company.name} · {data.location.name}
          </Text>
          <Text render={({ pageNumber, totalPages }) => p("page", { page: pageNumber, total: totalPages })} />
        </View>
      </Page>
    </Document>
  );
}
