import { pdf } from "@react-pdf/renderer";
import { CoverLetterDocument, ResumeDocument } from "./ResumePdf";
import type { CoverLetter, TailoredResume } from "../../types";

/**
 * PDF rendering lives in its own module so the heavy @react-pdf/renderer bundle
 * (~1.5 MB) is code-split out of the main app chunk. ResumeBuilder pulls this in
 * via dynamic import() only when the user actually downloads or saves — keeping
 * initial page loads light.
 */

export async function buildResumeFile(
  resume: TailoredResume,
  filename: string,
): Promise<File> {
  const blob = await pdf(<ResumeDocument resume={resume} />).toBlob();
  return new File([blob], filename, { type: "application/pdf" });
}

export async function buildCoverLetterFile(
  letter: CoverLetter,
  company: string,
  role: string,
  filename: string,
): Promise<File> {
  const blob = await pdf(
    <CoverLetterDocument letter={letter} company={company} role={role} />,
  ).toBlob();
  return new File([blob], filename, { type: "application/pdf" });
}
