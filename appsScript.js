// The Google Apps Script the admin pastes into their Google Sheet (Extensions -> Apps Script).
export const APPS_SCRIPT = `// Receives report data from the Team Hub website and writes it into this spreadsheet.
// 1) Change TOKEN to a long secret of your own (same value goes into Admin Panel -> Google Sheets).
// 2) Deploy -> New deployment -> Web app -> Execute as: Me, Who has access: Anyone.
const TOKEN = 'CHANGE-ME-TO-A-LONG-SECRET';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.token !== TOKEN) return out({ ok: false, error: 'Wrong token' });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    Object.keys(data.tabs).forEach(function (name) {
      const rows = data.tabs[name];
      const title = (data.scope + ' - ' + name).replace(/[\\[\\]\\*\\?:\\/\\\\]/g, '-').substring(0, 95);
      const sheet = ss.getSheetByName(title) || ss.insertSheet(title);
      sheet.clearContents();
      if (rows.length && rows[0].length) {
        sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
        sheet.getRange(1, 1, 1, rows[0].length).setFontWeight('bold');
        sheet.setFrozenRows(1);
      }
    });
    return out({ ok: true, tabs: Object.keys(data.tabs).length });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
`
