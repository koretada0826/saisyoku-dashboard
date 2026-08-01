/** ブラウザ内でCSVを生成しダウンロードする。Excelの文字化け防止にUTF-8 BOMを付与。 */

const UTF8_BOM = "﻿";

function escapeCell(value: string | number): string {
  const s = String(value);
  // カンマ・改行・ダブルクオートを含む場合は引用符で囲む
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildCsv(
  headers: string[],
  rows: (string | number)[][],
): string {
  const lines = [headers, ...rows].map((row) =>
    row.map(escapeCell).join(","),
  );
  return UTF8_BOM + lines.join("\r\n");
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
