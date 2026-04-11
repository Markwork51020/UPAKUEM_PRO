import ExcelJS from 'exceljs';

/**
 * @param {{ lines: Array<{name, qty, unit, unitPrice, total}>, sum: number, discount: number, finalPrice: number }} kpData
 * @returns {Promise<Buffer>}
 */
export async function generateKPExcel(kpData) {
  const { lines, sum, discount, finalPrice } = kpData;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('КП');

  // Column widths
  ws.getColumn('A').width = 40;
  ws.getColumn('B').width = 12;
  ws.getColumn('C').width = 16;
  ws.getColumn('D').width = 16;

  // A1 — title
  ws.mergeCells('A1:D1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'Коммерческое предложение';
  titleCell.font = { bold: true, size: 16 };
  titleCell.alignment = { horizontal: 'center' };

  // A2 — subtitle
  ws.mergeCells('A2:D2');
  const subtitleCell = ws.getCell('A2');
  subtitleCell.value = 'Upakuem.pro — фулфилмент под ключ';
  subtitleCell.font = { size: 12 };
  subtitleCell.alignment = { horizontal: 'center' };

  // A3 — date
  ws.mergeCells('A3:D3');
  const dateCell = ws.getCell('A3');
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  dateCell.value = `Дата: ${dd}.${mm}.${yyyy}`;
  dateCell.font = { size: 11 };
  dateCell.alignment = { horizontal: 'center' };

  // Row 5 — headers
  const headerRow = ws.getRow(5);
  const headers = ['Услуга', 'Кол-во', 'Цена за ед., ₽', 'Сумма, ₽'];
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    cell.border = {
      top: { style: 'thin' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' },
    };
    cell.alignment = { horizontal: 'center' };
  });

  // Data rows starting at row 6
  lines.forEach((l, idx) => {
    const row = ws.getRow(6 + idx);
    const values = [l.name, l.qty, l.unitPrice, l.total];
    values.forEach((v, i) => {
      const cell = row.getCell(i + 1);
      cell.value = v;
      cell.border = {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' },
      };
      if (i >= 1) {
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: 'right' };
      }
    });
  });

  // Summary rows — after data + 1 empty row
  const summaryStart = 6 + lines.length + 1;

  const sumRow = ws.getRow(summaryStart);
  sumRow.getCell(3).value = 'Сумма:';
  sumRow.getCell(3).font = { bold: true };
  sumRow.getCell(4).value = Math.round(sum);
  sumRow.getCell(4).numFmt = '#,##0';
  sumRow.getCell(4).alignment = { horizontal: 'right' };

  const discountRow = ws.getRow(summaryStart + 1);
  discountRow.getCell(3).value = 'Скидка 15%:';
  discountRow.getCell(3).font = { color: { argb: 'FFCC0000' } };
  discountRow.getCell(4).value = -Math.round(discount);
  discountRow.getCell(4).numFmt = '#,##0';
  discountRow.getCell(4).font = { color: { argb: 'FFCC0000' } };
  discountRow.getCell(4).alignment = { horizontal: 'right' };

  const totalRow = ws.getRow(summaryStart + 2);
  ws.mergeCells(`A${summaryStart + 2}:C${summaryStart + 2}`);
  totalRow.getCell(1).value = 'ИТОГО К ОПЛАТЕ:';
  totalRow.getCell(1).font = { bold: true, size: 14 };
  totalRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } };
  totalRow.getCell(4).value = Math.round(finalPrice);
  totalRow.getCell(4).numFmt = '#,##0';
  totalRow.getCell(4).font = { bold: true, size: 14 };
  totalRow.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } };
  totalRow.getCell(4).alignment = { horizontal: 'right' };

  // Contacts
  const contactsStart = summaryStart + 4;
  ws.getCell(`A${contactsStart}`).value = 'Telegram: @Upakuem_pro';
  ws.getCell(`A${contactsStart + 1}`).value = 'Телефон: 8 (966) 161-43-00';

  return wb.xlsx.writeBuffer();
}
