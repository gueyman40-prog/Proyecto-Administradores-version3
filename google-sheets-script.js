/**
 * =========================================================================
 * REGISTRO AUTOMÁTICO DE CONEXIONES EN GOOGLE SHEETS (EXCEL EN GOOGLE DRIVE)
 * =========================================================================
 * Instrucciones:
 * 1. Abre tu hoja de Google Sheets.
 * 2. En la fila 1 pon los encabezados:
 *    Columna A: FECHA
 *    Columna B: HORA
 *    Columna C: USUARIO
 *    Columna D: ID AGENCIA
 *    Columna E: NOMBRE AGENCIA
 *    Columna F: ROL
 *    Columna G: DISPOSITIVO
 * 
 * 3. En el menú superior de Google Sheets, ve a:
 *    Extensiones -> Apps Script
 * 
 * 4. Borra todo el código que aparezca y pega TODO este archivo.
 * 
 * 5. Haz clic en "Implementar" (botón azul arriba a la derecha) -> "Nueva implementación".
 *    - Tipo: "Aplicación web" (haz clic en el engranaje a la izquierda si no sale).
 *    - Descripción: "Registro Conexiones Agencias"
 *    - Ejecutar como: "Yo" (tu correo)
 *    - Quién tiene acceso: "Cualquier usuario" (Anyone)
 *    - Clic en "Implementar" -> "Autorizar acceso" (con tu cuenta de Google).
 * 
 * 6. Copia la URL de la aplicación web que te da (termina en /exec)
 *    y pégala en la página del sistema o en app.js (DEFAULT_CLOUD_URL).
 * =========================================================================
 */

function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  // Caso 1: Registrar una conexión nueva enviada desde cualquier teléfono o PC
  if (e && e.parameter && e.parameter.action === 'log') {
    var p = e.parameter;
    sheet.appendRow([
      p.date || Utilities.formatDate(new Date(), "GMT-6", "dd/MM/yyyy"),
      p.time || Utilities.formatDate(new Date(), "GMT-6", "HH:mm:ss"),
      p.user || "",
      p.agencyId !== undefined && p.agencyId !== "" ? Number(p.agencyId) : "",
      p.agencyName || "",
      p.role || "",
      p.device || "Teléfono Móvil"
    ]);

    return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Caso 2: Devolver todos los registros a la PC del Administrador
  var data = sheet.getDataRange().getValues();
  if (!data || data.length <= 1) {
    return ContentService.createTextOutput(JSON.stringify([]))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var logs = [];
  // Recorrer filas omitiendo el encabezado
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (row[0] || row[1] || row[2]) {
      logs.unshift({
        id: "LOG-" + i,
        date: String(row[0] || ""),
        time: String(row[1] || ""),
        user: String(row[2] || ""),
        agencyId: row[3] !== "" ? Number(row[3]) : 0,
        agencyName: String(row[4] || ""),
        role: String(row[5] || ""),
        device: String(row[6] || "Conectado"),
        status: "Conectado Exitosamente"
      });
    }
  }

  return ContentService.createTextOutput(JSON.stringify(logs))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var p = {};
  try {
    p = JSON.parse(e.postData.contents);
  } catch (err) {
    p = (e && e.parameter) ? e.parameter : {};
  }

  sheet.appendRow([
    p.date || Utilities.formatDate(new Date(), "GMT-6", "dd/MM/yyyy"),
    p.time || Utilities.formatDate(new Date(), "GMT-6", "HH:mm:ss"),
    p.user || "",
    p.agencyId !== undefined && p.agencyId !== "" ? Number(p.agencyId) : "",
    p.agencyName || "",
    p.role || "",
    p.device || "Teléfono Móvil"
  ]);

  return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
    .setMimeType(ContentService.MimeType.JSON);
}
