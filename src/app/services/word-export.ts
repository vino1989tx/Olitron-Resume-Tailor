import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
  AlignmentType,
  BorderStyle,
  HeadingLevel,
  TableLayoutType,
  LevelFormat,
} from "docx";
import { ResumeData, ResumeJob } from '../data/resume-data';

const DEFAULT_NAVY = "1F4E78";
const LABEL_BG = "F2F2F2";
const DARK = "1A1A1A";

// Accent color that drives every header element. Set per-export so the Word file
// matches the color picked in the app. Defaults to the original navy.
let NAVY = DEFAULT_NAVY;
let HEADER_BG = "D9E2F3";

// Blend a hex color toward white to produce the light section-header background.
function lightTint(hex: string, whiteFactor = 0.82): string {
  const clean = /^[0-9a-fA-F]{6}$/.test(hex) ? hex : DEFAULT_NAVY;
  const channel = (start: number) => {
    const value = parseInt(clean.slice(start, start + 2), 16);
    const mixed = Math.round(value + (255 - value) * whiteFactor);
    return mixed.toString(16).padStart(2, '0');
  };
  return `${channel(0)}${channel(2)}${channel(4)}`.toUpperCase();
}

// Letter page (12240 twips) minus 720-twip (0.5") margins on each side = 10800 usable twips.
const PAGE_MARGIN = 720;
const USABLE_WIDTH = 10800;

const HEADER_LEFT_COL = 7100;
const HEADER_RIGHT_COL = USABLE_WIDTH - HEADER_LEFT_COL;

const SKILLS_LABEL_COL = 2200;
const SKILLS_ITEMS_COL = USABLE_WIDTH - SKILLS_LABEL_COL;

const NO_BORDER = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};

// Zero cell padding so table content (name, skills labels) starts at the same
// left edge as the section headers and bullets — otherwise Word's default
// ~108-twip cell margin shifts table text to the right of everything else.
const ZERO_CELL_MARGINS = { top: 0, bottom: 0, left: 0, right: 0 };

// Bullet indent: marker sits at the left margin (aligned under the "P" of the
// section header) and text hangs a small step to the right.
const BULLET_INDENT = { left: 180, hanging: 180 };

// Custom bullet list so the marker glyph is smaller than the body text
// (default docx bullets scale with the text size and look oversized).
const BULLET_REF = "resume-bullets";
const BULLET_NUMBERING = {
  config: [
    {
      reference: BULLET_REF,
      levels: [
        {
          level: 0,
          format: LevelFormat.BULLET,
          text: "•",
          alignment: AlignmentType.LEFT,
          style: {
            run: { size: 20 },
            paragraph: { indent: BULLET_INDENT },
          },
        },
      ],
    },
  ],
};

// One blank line of separation after a completed section.
function sectionGap() {
  return new Paragraph({ spacing: { after: 0 }, children: [] });
}

function sectionHeader(text: string) {
  return new Paragraph({
    shading: { type: ShadingType.CLEAR, color: "auto", fill: HEADER_BG },
    spacing: { before: 240, after: 240 },
    children: [
      new TextRun({ text: text.toUpperCase(), bold: true, color: NAVY, size: 20 }),
    ],
  });
}

function bulletParagraph(text: string) {
  return new Paragraph({
    numbering: { reference: BULLET_REF, level: 0 },
    indent: BULLET_INDENT,
    spacing: { after: 60 },
    children: [new TextRun({ text, size: 21, color: DARK })],
  });
}

function skillsTable(skills: ResumeData['skills']) {
  return new Table({
    width: { size: USABLE_WIDTH, type: WidthType.DXA },
    columnWidths: [SKILLS_LABEL_COL, SKILLS_ITEMS_COL],
    layout: TableLayoutType.FIXED,
    indent: { size: 0, type: WidthType.DXA },
    rows: skills.map(
      (row) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: SKILLS_LABEL_COL, type: WidthType.DXA },
              shading: { type: ShadingType.CLEAR, color: "auto", fill: LABEL_BG },
              margins: { top: 80, bottom: 80, left: 100, right: 100 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: row.label, bold: true, color: NAVY, size: 20 })],
                }),
              ],
            }),
            new TableCell({
              width: { size: SKILLS_ITEMS_COL, type: WidthType.DXA },
              margins: { top: 80, bottom: 80, left: 100, right: 100 },
              children: [
                new Paragraph({ children: [new TextRun({ text: row.items, size: 20 })] }),
              ],
            }),
          ],
        })
    ),
  });
}

function jobSection(job: ResumeJob) {
  const paragraphs = [
    new Paragraph({
      spacing: { before: 200, after: 20 },
      children: [new TextRun({ text: job.role, bold: true, color: NAVY, size: 22 })],
    }),
    new Paragraph({
      spacing: { after: 100 },
      children: [
        new TextRun({ text: `${job.company} | ${job.duration} | `, bold: true, size: 20 }),
        new TextRun({ text: job.clientsLine, bold: true, underline: {}, size: 20 }),
      ],
    }),
  ];

  job.projects.forEach((project) => {
    paragraphs.push(
      new Paragraph({
        spacing: { before: 100, after: 60 },
        children: [
          new TextRun({
            text: `${project.clientLabel}: `,
            bold: true,
            underline: {},
            size: 20,
          }),
          new TextRun({ text: `(${project.duration})`, bold: true, size: 20 }),
        ],
      })
    );
    project.bullets.forEach((bullet) => paragraphs.push(bulletParagraph(bullet)));
  });

  return paragraphs;
}

function headerTable(resume: ResumeData) {
  return new Table({
    width: { size: USABLE_WIDTH, type: WidthType.DXA },
    columnWidths: [HEADER_LEFT_COL, HEADER_RIGHT_COL],
    layout: TableLayoutType.FIXED,
    borders: NO_BORDER,
    indent: { size: 0, type: WidthType.DXA },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: HEADER_LEFT_COL, type: WidthType.DXA },
            borders: NO_BORDER,
            margins: ZERO_CELL_MARGINS,
            children: [
              new Paragraph({
                heading: HeadingLevel.TITLE,
                spacing: { after: 40 },
                children: [new TextRun({ text: resume.name, bold: true, color: NAVY, size: 40, font: "Calibri" })],
              }),
              new Paragraph({
                spacing: { after: 40 },
                children: [new TextRun({ text: resume.title, bold: true, size: 22 })],
              }),
              new Paragraph({
                children: [new TextRun({ text: `${resume.phone}   |   ${resume.email}`, size: 20 })],
              }),
              ...(resume.leftExtras ?? [])
                .filter((line) => line.trim())
                .map(
                  (line) =>
                    new Paragraph({ children: [new TextRun({ text: line, size: 20 })] }),
                ),
            ],
          }),
          new TableCell({
            width: { size: HEADER_RIGHT_COL, type: WidthType.DXA },
            borders: NO_BORDER,
            margins: ZERO_CELL_MARGINS,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: resume.linkedin, size: 20 })],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: resume.location, size: 20 })],
              }),
              ...(resume.rightExtras ?? [])
                .filter((line) => line.trim())
                .map(
                  (line) =>
                    new Paragraph({
                      alignment: AlignmentType.RIGHT,
                      children: [new TextRun({ text: line, size: 20 })],
                    }),
                ),
            ],
          }),
        ],
      }),
    ],
  });
}

export async function exportResumeToDocx(
  resume: ResumeData,
  filename: string,
  accentHex: string = DEFAULT_NAVY,
): Promise<void> {
  NAVY = /^[0-9a-fA-F]{6}$/.test(accentHex) ? accentHex.toUpperCase() : DEFAULT_NAVY;
  HEADER_BG = lightTint(NAVY);

  const doc = new Document({
    numbering: BULLET_NUMBERING,
    styles: {
      default: {
        document: { run: { font: "Calibri" } },
      },
    },
    sections: [
      {
        properties: {
          page: { margin: { top: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN } },
        },
        children: [
          headerTable(resume),
          sectionGap(),

          sectionHeader("Professional Summary"),
          ...resume.summary.map(bulletParagraph),
          sectionGap(),

          sectionHeader("Core Technical Skills"),
          skillsTable(resume.skills),
          sectionGap(),

          sectionHeader("Professional Experience"),
          ...resume.experience.flatMap(jobSection),
          sectionGap(),

          sectionHeader("Education"),
          new Paragraph({
            children: [new TextRun({ text: resume.education, bold: true, size: 20 })],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
