import ExcelJS from 'exceljs';
import { getMonthlyAttendanceMatrix } from './monthlyService';

export async function generateMonthlyExcel(
  year: number,
  month: number,
  departmentFilter?: string,
  shiftFilter?: string,
  searchQuery?: string
): Promise<Buffer> {
  const data = await getMonthlyAttendanceMatrix(year, month, departmentFilter, shiftFilter, searchQuery);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Centizen IT Services';
  workbook.lastModifiedBy = 'Centizen IT Services';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Colors
  const navyHex = 'FF0A5482';
  const whiteHex = 'FFFFFFFF';
  const amberHex = 'FFFEF3C7';
  const amberHeaderHex = 'FFFDE68A';
  const lightGreyHex = 'FFF1F5F9';
  const borderGrey = 'FFCBD5E1';

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: borderGrey } },
    left: { style: 'thin', color: { argb: borderGrey } },
    bottom: { style: 'thin', color: { argb: borderGrey } },
    right: { style: 'thin', color: { argb: borderGrey } },
  };

  // ----------------------------------------------------
  // SHEET 1: Status Matrix (Muster Roll)
  // ----------------------------------------------------
  const sheet1 = workbook.addWorksheet('Status Matrix', {
    views: [{ state: 'frozen', xSplit: 4, ySplit: 2 }],
  });

  // Title Row
  const headerCols = ['Emp ID', 'Employee Name', 'Department', 'Shift'];
  for (const d of data.days_meta) {
    headerCols.push(`${d.day} (${d.weekday})`);
  }
  headerCols.push('Present', 'Absent', 'WFH', 'Half Day', 'Week Off', 'Attendance %');

  const titleRow = sheet1.addRow([`Centizen IT Services - Monthly Attendance Status Matrix (${data.month_name})`]);
  titleRow.font = { name: 'Arial', size: 14, bold: true, color: { argb: navyHex } };
  sheet1.mergeCells(1, 1, 1, headerCols.length);

  // Column Headers Row
  const headerRow = sheet1.addRow(headerCols);
  headerRow.height = 28;
  headerRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: whiteHex } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: navyHex },
    };
    cell.border = thinBorder;
  });

  // Color weekend headers
  data.days_meta.forEach((d, idx) => {
    if (d.is_weekend) {
      const colNum = 5 + idx;
      const cell = headerRow.getCell(colNum);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: amberHeaderHex },
      };
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF92400E' } };
    }
  });

  // Populate data rows
  data.records.forEach((rec, rIdx) => {
    const rowValues: any[] = [
      rec.emp_code,
      rec.name,
      rec.department,
      rec.shift,
    ];

    for (let d = 1; d <= data.num_days; d++) {
      const dayData = rec.days[String(d)];
      let st = dayData ? dayData.status : 'A';
      if (st === 'HDL') st = '½L';
      rowValues.push(st);
    }

    rowValues.push(
      rec.present_count,
      rec.absent_count,
      rec.wfh_count,
      rec.hdl_count,
      rec.wo_count,
      `${rec.attendance_rate}%`
    );

    const row = sheet1.addRow(rowValues);
    row.height = 22;

    const isEven = rIdx % 2 === 0;
    const bgFill: ExcelJS.FillPattern = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isEven ? whiteHex : lightGreyHex },
    };

    row.eachCell((cell, colNum) => {
      cell.font = { name: 'Arial', size: 9 };
      cell.border = thinBorder;
      cell.alignment = { vertical: 'middle', horizontal: colNum <= 2 ? 'left' : 'center' };
      cell.fill = bgFill;

      // Color coding for status cells
      if (colNum >= 5 && colNum < 5 + data.num_days) {
        const val = String(cell.value || '');
        if (val === 'P') {
          cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF15803D' } }; // Green
        } else if (val === 'A') {
          cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFDC2626' } }; // Red
        } else if (val === 'WFH') {
          cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF2563EB' } }; // Blue
        } else if (val === '½L' || val === 'HDL') {
          cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF7C3AED' } }; // Purple
        } else if (val === 'WO') {
          cell.font = { name: 'Arial', size: 9, color: { argb: 'FFB45309' } }; // Amber
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: amberHex } };
        }
      }
    });
  });

  // Auto-fit columns
  sheet1.columns.forEach((col, idx) => {
    if (idx === 0) col.width = 12;
    else if (idx === 1) col.width = 24;
    else if (idx === 2) col.width = 16;
    else if (idx === 3) col.width = 22;
    else if (idx < 4 + data.num_days) col.width = 7;
    else col.width = 13;
  });

  // ----------------------------------------------------
  // SHEET 2: Daily IN-OUT Times
  // ----------------------------------------------------
  const sheet2 = workbook.addWorksheet('Daily IN-OUT Times', {
    views: [{ state: 'frozen', xSplit: 4, ySplit: 2 }],
  });

  const titleRow2 = sheet2.addRow([`Centizen IT Services - Daily IN-OUT Timings (${data.month_name})`]);
  titleRow2.font = { name: 'Arial', size: 14, bold: true, color: { argb: navyHex } };
  sheet2.mergeCells(1, 1, 1, headerCols.length);

  const headerRow2 = sheet2.addRow(headerCols);
  headerRow2.height = 28;
  headerRow2.eachCell((cell, colNumber) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: whiteHex } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: navyHex },
    };
    cell.border = thinBorder;
  });

  data.days_meta.forEach((d, idx) => {
    if (d.is_weekend) {
      const colNum = 5 + idx;
      const cell = headerRow2.getCell(colNum);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: amberHeaderHex },
      };
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF92400E' } };
    }
  });

  data.records.forEach((rec, rIdx) => {
    const rowValues: any[] = [
      rec.emp_code,
      rec.name,
      rec.department,
      rec.shift,
    ];

    for (let d = 1; d <= data.num_days; d++) {
      const dayData = rec.days[String(d)];
      if (!dayData) {
        rowValues.push('--');
      } else if (dayData.status === 'WO') {
        rowValues.push('WO');
      } else if (dayData.status === 'WFH') {
        rowValues.push('WFH');
      } else if (dayData.first_in) {
        const inStr = dayData.first_in.substring(0, 5);
        const outStr = dayData.last_out ? dayData.last_out.substring(0, 5) : inStr;
        rowValues.push(inStr === outStr ? inStr : `${inStr}\n${outStr}`);
      } else {
        rowValues.push('A');
      }
    }

    rowValues.push(
      rec.present_count,
      rec.absent_count,
      rec.wfh_count,
      rec.hdl_count,
      rec.wo_count,
      `${rec.attendance_rate}%`
    );

    const row = sheet2.addRow(rowValues);
    row.height = 26;

    const isEven = rIdx % 2 === 0;
    const bgFill: ExcelJS.FillPattern = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isEven ? whiteHex : lightGreyHex },
    };

    row.eachCell((cell, colNum) => {
      cell.font = { name: 'Arial', size: 8 };
      cell.border = thinBorder;
      cell.alignment = { vertical: 'middle', horizontal: colNum <= 2 ? 'left' : 'center', wrapText: true };
      cell.fill = bgFill;
    });
  });

  sheet2.columns.forEach((col, idx) => {
    if (idx === 0) col.width = 12;
    else if (idx === 1) col.width = 24;
    else if (idx === 2) col.width = 16;
    else if (idx === 3) col.width = 22;
    else if (idx < 4 + data.num_days) col.width = 9;
    else col.width = 13;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

