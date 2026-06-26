import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Link,
} from "@react-pdf/renderer";
import type { CoverLetter, TailoredResume } from "../../types";

/**
 * Clean, single-column, ATS-friendly PDF templates for a tailored resume and
 * its matching cover letter. Rendered fully client-side via @react-pdf/renderer
 * — no server PDF generation, so nothing here hits the serverless function cap.
 */

const INK = "#1a1a1a";
const MUTED = "#555555";
const RULE = "#cccccc";
const ACCENT = "#1f3a5f";

const s = StyleSheet.create({
  page: {
    paddingVertical: 40,
    paddingHorizontal: 48,
    fontSize: 10,
    lineHeight: 1.4,
    color: INK,
    fontFamily: "Helvetica",
  },
  name: { fontSize: 22, fontFamily: "Helvetica-Bold", color: ACCENT },
  headline: { fontSize: 11, color: MUTED, marginTop: 2, marginBottom: 6 },
  contactRow: { fontSize: 9, color: MUTED, flexDirection: "row", flexWrap: "wrap" },
  contactItem: { marginRight: 10 },
  link: { color: ACCENT, textDecoration: "none" },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: ACCENT,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 14,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: RULE,
    paddingBottom: 2,
  },
  summary: { marginTop: 2 },
  jobHeader: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  role: { fontFamily: "Helvetica-Bold", fontSize: 10.5 },
  company: { color: MUTED, fontSize: 10 },
  period: { color: MUTED, fontSize: 9 },
  bulletRow: { flexDirection: "row", marginTop: 2, paddingLeft: 4 },
  bulletDot: { width: 10, color: ACCENT },
  bulletText: { flex: 1 },
  skillsWrap: { flexDirection: "row", flexWrap: "wrap", marginTop: 2 },
  // Chip = a View box (sizes to content, no overlap) wrapping the label Text.
  skill: {
    backgroundColor: "#eef2f7",
    borderRadius: 3,
    paddingVertical: 3,
    paddingHorizontal: 7,
    marginRight: 5,
    marginBottom: 5,
  },
  skillText: { fontSize: 9, color: ACCENT },
  eduRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  eduDetail: { color: MUTED, fontSize: 9, marginTop: 1 },
  // Cover letter
  clHeader: { marginBottom: 16 },
  clDate: { fontSize: 9, color: MUTED, marginBottom: 16 },
  clPara: { marginBottom: 10 },
  clClosing: { marginTop: 6 },
  clSignature: { fontFamily: "Helvetica-Bold", marginTop: 18 },
});

export function ResumeDocument({ resume }: { resume: TailoredResume }) {
  const { contact } = resume;
  const contactItems: Array<{ key: string; text: string; href?: string }> = [];
  if (contact.email) contactItems.push({ key: "email", text: contact.email, href: `mailto:${contact.email}` });
  if (contact.phone) contactItems.push({ key: "phone", text: contact.phone });
  if (contact.location) contactItems.push({ key: "loc", text: contact.location });
  for (const url of contact.links) {
    contactItems.push({ key: url, text: url.replace(/^https?:\/\//, ""), href: url });
  }

  return (
    <Document title={`${resume.name} — Resume`} author={resume.name}>
      <Page size="A4" style={s.page}>
        <Text style={s.name}>{resume.name || "Your Name"}</Text>
        {resume.headline ? <Text style={s.headline}>{resume.headline}</Text> : null}
        {contactItems.length > 0 && (
          <View style={s.contactRow}>
            {contactItems.map((c) => (
              <Text key={c.key} style={s.contactItem}>
                {c.href ? (
                  <Link style={s.link} src={c.href}>
                    {c.text}
                  </Link>
                ) : (
                  c.text
                )}
              </Text>
            ))}
          </View>
        )}

        {resume.summary ? (
          <View>
            <Text style={s.sectionTitle}>Summary</Text>
            <Text style={s.summary}>{resume.summary}</Text>
          </View>
        ) : null}

        {resume.skills.length > 0 && (
          <View>
            <Text style={s.sectionTitle}>Skills</Text>
            <View style={s.skillsWrap}>
              {resume.skills.map((sk, i) => (
                <View key={`${sk}-${i}`} style={s.skill}>
                  <Text style={s.skillText}>{sk}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {resume.experience.length > 0 && (
          <View>
            <Text style={s.sectionTitle}>Experience</Text>
            {resume.experience.map((job, i) => (
              <View key={i} wrap={false}>
                {(job.role || job.company || job.period) && (
                  <View style={s.jobHeader}>
                    <View>
                      {job.role ? <Text style={s.role}>{job.role}</Text> : null}
                      {(job.company || job.location) && (
                        <Text style={s.company}>
                          {[job.company, job.location].filter(Boolean).join(" • ")}
                        </Text>
                      )}
                    </View>
                    {job.period ? <Text style={s.period}>{job.period}</Text> : null}
                  </View>
                )}
                {job.bullets.map((b, j) => (
                  <View key={j} style={s.bulletRow}>
                    <Text style={s.bulletDot}>•</Text>
                    <Text style={s.bulletText}>{b}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {resume.education.length > 0 && (
          <View>
            <Text style={s.sectionTitle}>Education</Text>
            {resume.education.map((ed, i) => (
              <View key={i} wrap={false}>
                <View style={s.eduRow}>
                  <View>
                    {ed.degree ? <Text style={s.role}>{ed.degree}</Text> : null}
                    {ed.institution ? <Text style={s.company}>{ed.institution}</Text> : null}
                  </View>
                  {ed.period ? <Text style={s.period}>{ed.period}</Text> : null}
                </View>
                {ed.detail ? <Text style={s.eduDetail}>{ed.detail}</Text> : null}
              </View>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}

export function CoverLetterDocument({
  letter,
  company,
  role,
}: {
  letter: CoverLetter;
  company: string;
  role: string;
}) {
  const today = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return (
    <Document title={`${letter.signature} — Cover Letter`} author={letter.signature}>
      <Page size="A4" style={s.page}>
        <View style={s.clHeader}>
          <Text style={s.name}>{letter.signature || "Your Name"}</Text>
          {(role || company) && (
            <Text style={s.headline}>
              Application for {[role, company].filter(Boolean).join(" — ")}
            </Text>
          )}
        </View>
        <Text style={s.clDate}>{today}</Text>
        <Text style={s.clPara}>{letter.greeting}</Text>
        {letter.body.map((p, i) => (
          <Text key={i} style={s.clPara}>
            {p}
          </Text>
        ))}
        <Text style={s.clClosing}>{letter.closing}</Text>
        <Text style={s.clSignature}>{letter.signature}</Text>
      </Page>
    </Document>
  );
}
