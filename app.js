/**
 * Sistema de Gestión de Órdenes de Servicio - Pago de Viajes a Tercerizados (CDN & CCN)
 * Módulo de Autenticación, Control de Acceso por Agencias y Bitácora de Conexiones
 * SINCRONIZACIÓN EN LA NUBE (MULTI-DISPOSITIVOS: TELÉFONOS Y COMPUTADORAS)
 */

// ========================================================
// ========================================================
// CONFIGURACIÓN DE SINCRONIZACIÓN EN LA NUBE (GOOGLE SHEETS / EXCEL)
// ========================================================
const DEFAULT_CLOUD_URL = "https://script.google.com/macros/s/AKfycbzKFL4M9f51KpTBY-rcGQR2TCboN3dTL7l6WWl6iAXKxAcnqLHWyjjCkcIuEMSb4Kvl/exec";

// Módulo de Comunicación con la Nube (Google Sheets / Firebase)
const CloudSync = {
  getDbUrl() {
    return (localStorage.getItem('cdn_ccn_cloud_db_url') || DEFAULT_CLOUD_URL || '').trim().replace(/\/+$/, '');
  },

  setDbUrl(url) {
    const clean = (url || '').trim().replace(/\/+$/, '');
    localStorage.setItem('cdn_ccn_cloud_db_url', clean);
    return clean;
  },

  // Enviar inicio de sesión a Google Sheets o Firebase
  async sendAuditLog(logEntry) {
    const url = this.getDbUrl();
    if (!url) return false;

    // Método 1: Google Sheets (Google Apps Script Web App)
    if (url.includes('script.google.com')) {
      try {
        const params = new URLSearchParams({
          action: 'log',
          id: logEntry.id || '',
          user: logEntry.user || '',
          agencyId: String(logEntry.agencyId ?? ''),
          agencyName: logEntry.agencyName || '',
          role: logEntry.role || '',
          date: logEntry.date || '',
          time: logEntry.time || '',
          device: logEntry.device || ''
        });

        // Envío por GET (parámetros en URL) con mode no-cors
        fetch(`${url}?${params.toString()}`, { method: 'GET', mode: 'no-cors' }).catch(() => {});

        // Y respaldo por POST con text/plain para máxima compatibilidad
        fetch(url, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(logEntry)
        }).catch(() => {});

        return true;
      } catch (err) {
        console.warn("CloudSync Google Sheets send:", err);
        return false;
      }
    }

    // Método 2: Firebase Realtime Database
    try {
      const res = await fetch(`${url}/audit_logs.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logEntry)
      });
      return res.ok;
    } catch (err) {
      console.warn("CloudSync Firebase send:", err);
      return false;
    }
  },

  // Obtener registros desde Google Sheets o Firebase
  async fetchAuditLogs() {
    const url = this.getDbUrl();
    if (!url) return null;

    // Método 1: Google Sheets
    if (url.includes('script.google.com')) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) return data;
        }
      } catch (err) {
        console.warn("CloudSync Google Sheets fetch:", err);
      }
      return null;
    }

    // Método 2: Firebase
    try {
      const res = await fetch(`${url}/audit_logs.json`);
      if (res.ok) {
        const data = await res.json();
        if (!data) return [];
        return Object.keys(data).map(key => ({
          ...data[key],
          cloudId: key
        })).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      }
    } catch (err) {
      console.warn("CloudSync Firebase fetch:", err);
    }
    return null;
  },

  // Enviar orden a la nube (opcional)
  async sendOrder(order) {
    const url = this.getDbUrl();
    if (!url) return false;
    if (url.includes('script.google.com')) return true;
    try {
      const res = await fetch(`${url}/orders.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order)
      });
      return res.ok;
    } catch (err) {
      return false;
    }
  },

  async fetchOrders() {
    const url = this.getDbUrl();
    if (!url || url.includes('script.google.com')) return null;
    try {
      const res = await fetch(`${url}/orders.json`);
      if (res.ok) {
        const data = await res.json();
        if (!data) return [];
        return Object.keys(data).map(key => ({
          ...data[key],
          cloudId: key
        })).sort((a, b) => new Date(b.dateIso || 0) - new Date(a.dateIso || 0));
      }
    } catch (err) {
      return null;
    }
    return null;
  }
};

// ========================================================
// 1. CATÁLOGO MAESTRO DE AGENCIAS OFICIALES (1 al 24)
// ========================================================
const AGENCIES_CATALOG = [
  { id: 1, name: "1-B.DISTRIBUC.MGA", shortName: "B.DISTRIBUC.MGA", username: "agencia1", pass: "mga123" },
  { id: 2, name: "2-AGENCIA ESTELI", shortName: "AGENCIA ESTELI", username: "agencia2", pass: "esteli123" },
  { id: 3, name: "3-AGENCIA OCOTAL", shortName: "AGENCIA OCOTAL", username: "agencia3", pass: "ocotal123" },
  { id: 4, name: "4-AGENC.OCCIDENTE", shortName: "AGENC.OCCIDENTE", username: "agencia4", pass: "occidente123" },
  { id: 5, name: "5-SERV.HOGAR MGA", shortName: "SERV.HOGAR MGA", username: "agencia5", pass: "hogar123" },
  { id: 6, name: "6-AGENCIA MASAYA", shortName: "AGENCIA MASAYA", username: "agencia6", pass: "masaya123" },
  { id: 7, name: "7-AGEN. STO.TOMAS", shortName: "AGEN. STO.TOMAS", username: "agencia7", pass: "tomas123" },
  { id: 8, name: "8-AGENCIA BOACO", shortName: "AGENCIA BOACO", username: "agencia8", pass: "boaco123" },
  { id: 9, name: "9-AGEN.MATAGALPA", shortName: "AGEN.MATAGALPA", username: "agencia9", pass: "matagalpa123" },
  { id: 10, name: "10-CEDIS SABANA", shortName: "CEDIS SABANA", username: "agencia10", pass: "sabana123" },
  { id: 11, name: "11-CEDIS DISTRIB.", shortName: "CEDIS DISTRIB.", username: "agencia11", pass: "distrib123" },
  { id: 12, name: "12-AGENCIA RIVAS", shortName: "AGENCIA RIVAS", username: "agencia12", pass: "rivas123" },
  { id: 13, name: "13-EVENTOS ESP.MGA", shortName: "EVENTOS ESP.MGA", username: "agencia13", pass: "eventos123" },
  { id: 14, name: "14-CEDI.DISTR.AGEN", shortName: "CEDI.DISTR.AGEN", username: "agencia14", pass: "distragen123" },
  { id: 15, name: "15-CEDIS PRADEXSA", shortName: "CEDIS PRADEXSA", username: "agencia15", pass: "pradexsa123" },
  { id: 20, name: "20-DIST.DET.CDN", shortName: "DIST.DET.CDN", username: "agencia20", pass: "distdet123" },
  { id: 21, name: "21-DEPOSITO INBOND", shortName: "DEPOSITO INBOND", username: "agencia21", pass: "inbond123" },
  { id: 24, name: "24-ALQ. TRANSITO", shortName: "ALQ. TRANSITO", username: "agencia24", pass: "transito123" }
];

// Cuenta de Administrador Central
const ADMIN_ACCOUNT = {
  username: "admin",
  pass: "admin123",
  role: "admin",
  name: "Administrador Central",
  agencyId: 0,
  agencyName: "Dirección General / Administración"
};

// ========================================================
// 2. PROVEEDORES SEGMENTADOS (5 PROVEEDORES ÚNICOS POR AGENCIA)
// ========================================================
const DEFAULT_CLIENTS_BY_AGENCY = [
  // 1-B.DISTRIBUC.MGA
  { id: "10101", name: "Marvin Antonio Morales Guido", agencyId: 1 },
  { id: "10102", name: "Carlos Alberto Centeno Rivas", agencyId: 1 },
  { id: "10103", name: "Lester Manuel Obando Jarquín", agencyId: 1 },
  { id: "10104", name: "Roberto José Gómez Pavón", agencyId: 1 },
  { id: "10105", name: "Francisco Javier Blandón Mairena", agencyId: 1 },

  // 2-AGENCIA ESTELI
  { id: "10201", name: "Denis Noel Castillo Briones", agencyId: 2 },
  { id: "10202", name: "Everth Alexander Rugama Lira", agencyId: 2 },
  { id: "10203", name: "Jader Antonio Valdivia Rayo", agencyId: 2 },
  { id: "10204", name: "Marlon Enrique Gámez Peralta", agencyId: 2 },
  { id: "10205", name: "Wilmer Francisco Zeledón Dávila", agencyId: 2 },

  // 3-AGENCIA OCOTAL
  { id: "10301", name: "Bayardo Ramón Cáceres Bellorín", agencyId: 3 },
  { id: "10302", name: "José Santos Gómez Talavera", agencyId: 3 },
  { id: "10303", name: "Nelson David Ponce Tercero", agencyId: 3 },
  { id: "10304", name: "Walter Ismael López Guillén", agencyId: 3 },
  { id: "10305", name: "Freddy Alberto Pastrana Muñoz", agencyId: 3 },

  // 4-AGENC.OCCIDENTE
  { id: "10401", name: "Donald Enrique Balladares Vivas", agencyId: 4 },
  { id: "10402", name: "Reynaldo José Chevez Mayorga", agencyId: 4 },
  { id: "10403", name: "Silvio Antonio Roa Carrión", agencyId: 4 },
  { id: "10404", name: "Álvaro Javier Juárez Maradiaga", agencyId: 4 },
  { id: "10405", name: "Héctor René Delgado Somarriba", agencyId: 4 },

  // 5-SERV.HOGAR MGA
  { id: "10501", name: "Henry Mauricio Solís Arana", agencyId: 5 },
  { id: "10502", name: "Cristian David Marenco Urbina", agencyId: 5 },
  { id: "10503", name: "Noel Alexander Pineda Ortiz", agencyId: 5 },
  { id: "10504", name: "Walter Antonio Salgado Rocha", agencyId: 5 },
  { id: "10505", name: "Gabriel Ernesto Mendoza Lacayo", agencyId: 5 },

  // 6-AGENCIA MASAYA
  { id: "10601", name: "Bismarck Antonio Putoy Calero", agencyId: 6 },
  { id: "10602", name: "Erick Josué Pavón Cerda", agencyId: 6 },
  { id: "10603", name: "Silvio Danilo Brenes Gaitán", agencyId: 6 },
  { id: "10604", name: "Néstor Fidel Cano Nicaragua", agencyId: 6 },
  { id: "10605", name: "Jaime Ramón Zepeda Noguera", agencyId: 6 },

  // 7-AGEN. STO.TOMAS
  { id: "10701", name: "Ervin Adolfo Báez Oporta", agencyId: 7 },
  { id: "10702", name: "Marlon José Requene Sequeira", agencyId: 7 },
  { id: "10703", name: "Wilmer Antonio Taleno Hurtado", agencyId: 7 },
  { id: "10704", name: "Jaime Enrique Bravo Miranda", agencyId: 7 },
  { id: "10705", name: "Carlos Manuel Duarte Sotelo", agencyId: 7 },

  // 8-AGENCIA BOACO
  { id: "10801", name: "Ronald Antonio Sotelo Sequeira", agencyId: 8 },
  { id: "10802", name: "Javier Ernesto Alvarado Hurtado", agencyId: 8 },
  { id: "10803", name: "Douglas Manuel Granja Amador", agencyId: 8 },
  { id: "10804", name: "Omar José Téllez Valle", agencyId: 8 },
  { id: "10805", name: "Nelson Francisco Mendoza Urbina", agencyId: 8 },

  // 9-AGEN.MATAGALPA
  { id: "10901", name: "Isidro Ramón Zeledón Castro", agencyId: 9 },
  { id: "10902", name: "Maycol Antonio Blandón Montenegro", agencyId: 9 },
  { id: "10903", name: "Jorge Luis Orozco Matamoros", agencyId: 9 },
  { id: "10904", name: "Edwin Noel Soza Altamirano", agencyId: 9 },
  { id: "10905", name: "Holman Francisco Úbeda Cruz", agencyId: 9 },

  // 10-CEDIS SABANA
  { id: "11001", name: "Roger Antonio Quintero Lazo", agencyId: 10 },
  { id: "11002", name: "Danilo José Rizo Gutiérrez", agencyId: 10 },
  { id: "11003", name: "Melvin Ariel Vallejos Cano", agencyId: 10 },
  { id: "11004", name: "Juan Carlos Sevilla Palacios", agencyId: 10 },
  { id: "11005", name: "Byron Alberto Flores Martínez", agencyId: 10 },

  // 11-CEDIS DISTRIB.
  { id: "11101", name: "Jonathan David Parrales Alemán", agencyId: 11 },
  { id: "11102", name: "Mario René Chavarría Silva", agencyId: 11 },
  { id: "11103", name: "Silvio Andrés Morán Obregón", agencyId: 11 },
  { id: "11104", name: "César Augusto Picado Guido", agencyId: 11 },
  { id: "11105", name: "Félix Pedro Aguirre Espinoza", agencyId: 11 },

  // 12-AGENCIA RIVAS
  { id: "11201", name: "Freddy Alberto Condega Vega", agencyId: 12 },
  { id: "11202", name: "Gerald Josué Barrios Novoa", agencyId: 12 },
  { id: "11203", name: "Carlos Manuel Villarreal Rivas", agencyId: 12 },
  { id: "11204", name: "Wilmer Antonio Palma Ruiz", agencyId: 12 },
  { id: "11205", name: "David Enrique Espinoza Chamorro", agencyId: 12 },

  // 13-EVENTOS ESP.MGA
  { id: "11301", name: "Jorge Alberto Cardoza Cruz", agencyId: 13 },
  { id: "11302", name: "Lenin Antonio Mercado Vado", agencyId: 13 },
  { id: "11303", name: "Luis Emilio Fonseca Moncada", agencyId: 13 },
  { id: "11304", name: "Óscar Danilo Vallecillo Silva", agencyId: 13 },
  { id: "11305", name: "Sergio Alejandro Cuadra Reyes", agencyId: 13 },

  // 14-CEDI.DISTR.AGEN
  { id: "11401", name: "Norlan Javier Dávila Arceda", agencyId: 14 },
  { id: "11402", name: "Marcos Antonio Cano Guido", agencyId: 14 },
  { id: "11403", name: "José Santos Rivera Laguna", agencyId: 14 },
  { id: "11404", name: "Eddy Ramón Zamora Centeno", agencyId: 14 },
  { id: "11405", name: "Kevin Josué Salablanca Pérez", agencyId: 14 },

  // 15-CEDIS PRADEXSA
  { id: "11501", name: "Carlos Enrique Toval Rosales", agencyId: 15 },
  { id: "11502", name: "Álvaro René Loáisiga Blanco", agencyId: 15 },
  { id: "11503", name: "Lester David Somoza Estrada", agencyId: 15 },
  { id: "11504", name: "Denis Alberto Picado Tercero", agencyId: 15 },
  { id: "11505", name: "Marlon Antonio Velásquez Blandón", agencyId: 15 },

  // 20-DIST.DET.CDN
  { id: "12001", name: "Norman Alberto Sánchez Brenes", agencyId: 20 },
  { id: "12002", name: "Darwin José Narváez Castillo", agencyId: 20 },
  { id: "12003", name: "Wilmer Antonio García Madriz", agencyId: 20 },
  { id: "12004", name: "Roberto Carlos Meneses Potosme", agencyId: 20 },
  { id: "12005", name: "Franklin Javier Román Ticay", agencyId: 20 },

  // 21-DEPOSITO INBOND
  { id: "12101", name: "Bismarck Antonio Cruz Caldera", agencyId: 21 },
  { id: "12102", name: "Julio César Mendieta Cordero", agencyId: 21 },
  { id: "12103", name: "Ronald David Zeledón Jarquín", agencyId: 21 },
  { id: "12104", name: "Carlos Manuel Solórzano Selva", agencyId: 21 },
  { id: "12105", name: "Álvaro José Blandino Prado", agencyId: 21 },

  // 24-ALQ. TRANSITO
  { id: "12401", name: "Héctor Danilo Carcache Rugama", agencyId: 24 },
  { id: "12402", name: "Silvio Gabriel Mayorga Lezama", agencyId: 24 },
  { id: "12403", name: "Elmer Antonio Téllez Carrero", agencyId: 24 },
  { id: "12404", name: "Francisco Javier Centeno Mora", agencyId: 24 },
  { id: "12405", name: "Marvin Alberto Guadamuz Guido", agencyId: 24 }
];

// Motivos de Viaje (Descripción del Servicio) vinculados a Cuenta Contable
const DEFAULT_REASONS = [
  { reason: "Viaje por entrega de equipo frío", account: "CTA-70101-EQFRIO" },
  { reason: "Viaje por retiro de equipo frío para taller", account: "CTA-70102-RETFRIO" },
  { reason: "Viaje por entrega de botellón", account: "CTA-70201-BOTELLON" },
  { reason: "Viaje por recolección y retorno de botellón vacío", account: "CTA-70202-RECBOT" },
  { reason: "Viaje por traslado de producto entre bodegas", account: "CTA-70301-TRASLADO" },
  { reason: "Viaje por flete foráneo a sucursales", account: "CTA-70302-FORANEO" },
  { reason: "Viaje por distribución en canal tradicional", account: "CTA-70401-CANALTRAD" },
  { reason: "Viaje por entrega a canal moderno (Supermercados)", account: "CTA-70402-SUPERMKT" },
  { reason: "Viaje express por reposición de emergencia", account: "CTA-70501-EXPRESS" },
  { reason: "Viaje por canje y mantenimiento en ruta", account: "CTA-70601-MNTRUTA" }
];

// Supervisores que LIBERAN vinculados a CECO (Centro de Costo numérico)
const DEFAULT_APPROVERS = [
  { name: "Carlos Buchitín", costCenter: "700720056" },
  { name: "Alicia Ramírez", costCenter: "700720057" },
  { name: "José Alejandro", costCenter: "700720058" },
  { name: "Adolfo Jarquín", costCenter: "700720059" },
  { name: "Mario Castillo", costCenter: "700720060" },
  { name: "Alex Flores", costCenter: "700720061" }
];

// ========================================================
// 3. ESTADO GLOBAL DE LA APLICACIÓN
// ========================================================
const AppState = {
  currentScreen: "login", // "login" | "portal" | "main"
  currentSession: null,   // { user, agencyId, agencyName, role: 'agency'|'admin' }
  selectedCompany: null,   // "CDN" | "CCN"
  orders: [],
  clients: [],
  reasons: [],
  approvers: [],
  auditLogs: [],
  theme: "light",
  filterCompany: "all",
  filterAgencyAdmin: "all",
  searchQuery: "",
  auditSearchQuery: "",
  loginMode: "agency",    // "agency" | "admin"
  greetingSimPeriod: null, // null (auto) | 'morning' | 'afternoon' | 'night'
  loginStep: 1             // 1 (selección) | 2 (contraseña)
};

// ========================================================
// 4. REFERENCIAS DEL DOM
// ========================================================
const dom = {
  // Pantallas
  loginScreen: document.getElementById('loginScreen'),
  portalScreen: document.getElementById('portalScreen'),
  mainScreen: document.getElementById('mainScreen'),

  // Login y Bienvenida Dinámica
  tabLoginAgency: document.getElementById('tabLoginAgency'),
  tabLoginAdmin: document.getElementById('tabLoginAdmin'),
  loginForm: document.getElementById('loginForm'),
  groupAgencySelect: document.getElementById('groupAgencySelect'),
  groupAdminUser: document.getElementById('groupAdminUser'),
  loginAgencySelect: document.getElementById('loginAgencySelect'),
  loginUsername: document.getElementById('loginUsername'),
  loginPassword: document.getElementById('loginPassword'),
  loginErrorMsg: document.getElementById('loginErrorMsg'),
  loginBtnToggleTheme: document.getElementById('loginBtnToggleTheme'),
  quickChips: document.querySelectorAll('.quick-chip'),

  // Metadatos y Banner Dinámico
  loginLiveClock: document.getElementById('loginLiveClock'),
  loginLiveDate: document.getElementById('loginLiveDate'),
  loginLiveShift: document.getElementById('loginLiveShift'),
  dynamicWelcomeBanner: document.getElementById('dynamicWelcomeBanner'),
  welcomeTimeIcon: document.getElementById('welcomeTimeIcon'),
  welcomeShiftTag: document.getElementById('welcomeShiftTag'),
  welcomeGreetingTitle: document.getElementById('welcomeGreetingTitle'),
  welcomeGreetingQuote: document.getElementById('welcomeGreetingQuote'),
  welcomeActiveAgencyChip: document.getElementById('welcomeActiveAgencyChip'),
  welcomeActiveAgencyName: document.getElementById('welcomeActiveAgencyName'),
  btnWelcomeChangeAgency: document.getElementById('btnWelcomeChangeAgency'),

  // Pasos del flujo dinámico de Login
  loginStepAgency: document.getElementById('loginStepAgency'),
  loginStepPassword: document.getElementById('loginStepPassword'),
  btnContinueToPassword: document.getElementById('btnContinueToPassword'),
  stepSelectedIcon: document.getElementById('stepSelectedIcon'),
  stepSelectedAgencyName: document.getElementById('stepSelectedAgencyName'),
  btnChangeAgencyStep2: document.getElementById('btnChangeAgencyStep2'),
  btnTogglePasswordVis: document.getElementById('btnTogglePasswordVis'),
  btnBackToStep1: document.getElementById('btnBackToStep1'),
  timeSimPills: document.querySelectorAll('.sim-pill'),

  // Barras de Sesión
  sessionBadgePortal: document.getElementById('sessionBadgePortal'),
  sessionAgencyNamePortal: document.getElementById('sessionAgencyNamePortal'),
  sessionRoleTextPortal: document.getElementById('sessionRoleTextPortal'),
  btnAuditLogsPortal: document.getElementById('btnAuditLogsPortal'),
  btnLogoutPortal: document.getElementById('btnLogoutPortal'),

  sessionBadgeMain: document.getElementById('sessionBadgeMain'),
  sessionAgencyNameMain: document.getElementById('sessionAgencyNameMain'),
  sessionRoleTextMain: document.getElementById('sessionRoleTextMain'),
  btnAuditLogsMain: document.getElementById('btnAuditLogsMain'),
  btnLogoutMain: document.getElementById('btnLogoutMain'),

  // Botones del Portal
  btnSelectCDN: document.getElementById('btnSelectCDN'),
  btnSelectCCN: document.getElementById('btnSelectCCN'),
  portalCdnCount: document.getElementById('portalCdnCount'),
  portalCcnCount: document.getElementById('portalCcnCount'),
  portalBtnToggleTheme: document.getElementById('portalBtnToggleTheme'),
  portalBtnOpenCatalog: document.getElementById('portalBtnOpenCatalog'),

  // Encabezado Pantalla Principal
  btnBackToPortal: document.getElementById('btnBackToPortal'),
  activeCompanyBadge: document.getElementById('activeCompanyBadge'),
  btnToggleTheme: document.getElementById('btnToggleTheme'),
  btnOpenCatalog: document.getElementById('btnOpenCatalog'),

  // Formulario y Campos
  orderForm: document.getElementById('orderForm'),
  clientIdSelect: document.getElementById('clientIdSelect'),
  clientNameSelect: document.getElementById('clientNameSelect'),
  serviceInput: document.getElementById('serviceInput'),
  orderReasonSelect: document.getElementById('orderReasonSelect'),
  accountNumberSelect: document.getElementById('accountNumberSelect'),
  orderConcept: document.getElementById('orderConcept'),
  purchaseGroupInput: document.getElementById('purchaseGroupInput'),
  managementInput: document.getElementById('managementInput'),
  releasedBySelect: document.getElementById('releasedBySelect'),
  costCenterInput: document.getElementById('costCenterInput'),
  orderAmount: document.getElementById('orderAmount'),

  // Botones de acción
  btnSubmit: document.getElementById('btnSubmit'),
  btnGenerateExcel: document.getElementById('btnGenerateExcel'),
  btnClearForm: document.getElementById('btnClearForm'),
  btnClearAllOrders: document.getElementById('btnClearAllOrders'),

  // Estadísticas KPI
  statTotal: document.getElementById('statTotal'),
  statCdn: document.getElementById('statCdn'),
  statCcn: document.getElementById('statCcn'),
  statTotalAmount: document.getElementById('statTotalAmount'),
  tableCountBadge: document.getElementById('tableCountBadge'),

  // Tabla, Búsqueda y Filtros
  ordersTableBody: document.getElementById('ordersTableBody'),
  emptyState: document.getElementById('emptyState'),
  tableSearch: document.getElementById('tableSearch'),
  filterChips: document.querySelectorAll('.filter-chip'),
  adminAgencyFilterWrapper: document.getElementById('adminAgencyFilterWrapper'),
  adminAgencyFilter: document.getElementById('adminAgencyFilter'),

  // Modal Catálogo
  catalogModal: document.getElementById('catalogModal'),
  btnCloseCatalog: document.getElementById('btnCloseCatalog'),
  btnSaveAndCloseCatalog: document.getElementById('btnSaveAndCloseCatalog'),
  catalogClientsTable: document.getElementById('catalogClientsTable'),
  catalogReasonsTable: document.getElementById('catalogReasonsTable'),
  catalogApproversTable: document.getElementById('catalogApproversTable'),
  newClientId: document.getElementById('newClientId'),
  newClientName: document.getElementById('newClientName'),
  newClientAgency: document.getElementById('newClientAgency'),
  catalogAgencyFilter: document.getElementById('catalogAgencyFilter'),
  btnAddClient: document.getElementById('btnAddClient'),
  newReason: document.getElementById('newReason'),
  newAccount: document.getElementById('newAccount'),
  btnAddReason: document.getElementById('btnAddReason'),
  newApproverName: document.getElementById('newApproverName'),
  newApproverCostCenter: document.getElementById('newApproverCostCenter'),
  btnAddApprover: document.getElementById('btnAddApprover'),
  catalogTabs: document.querySelectorAll('.tab-btn'),
  tabClientsContent: document.getElementById('tabClientsContent'),
  tabReasonsContent: document.getElementById('tabReasonsContent'),
  tabApproversContent: document.getElementById('tabApproversContent'),

  // Modal Auditoría de Conexiones
  auditModal: document.getElementById('auditModal'),
  btnCloseAudit: document.getElementById('btnCloseAudit'),
  btnCloseAuditFooter: document.getElementById('btnCloseAuditFooter'),
  auditTableBody: document.getElementById('auditTableBody'),
  auditStatTotal: document.getElementById('auditStatTotal'),
  auditStatToday: document.getElementById('auditStatToday'),
  auditStatAgencies: document.getElementById('auditStatAgencies'),
  auditSearch: document.getElementById('auditSearch'),
  btnClearAuditLogs: document.getElementById('btnClearAuditLogs'),
  btnExportAuditExcel: document.getElementById('btnExportAuditExcel'),

  // Sincronización en la Nube
  cloudStatusBanner: document.getElementById('cloudStatusBanner'),
  cloudStatusDot: document.getElementById('cloudStatusDot'),
  cloudStatusText: document.getElementById('cloudStatusText'),
  btnOpenCloudConfig: document.getElementById('btnOpenCloudConfig'),
  cloudConfigBox: document.getElementById('cloudConfigBox'),
  cloudDbUrlInput: document.getElementById('cloudDbUrlInput'),
  btnSaveCloudDbUrl: document.getElementById('btnSaveCloudDbUrl'),
  btnCancelCloudConfig: document.getElementById('btnCancelCloudConfig'),

  // Notificaciones Toast
  toastContainer: document.getElementById('toastContainer')
};

// ========================================================
// 5. INICIALIZACIÓN DEL SISTEMA
// ========================================================
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  setupAgenciesDropdowns();
  setupEventListeners();
  checkCurrentSession();
  startAdminRealtimeMonitoring();
});

function loadData() {
  // Clientes segmentados
  const savedClients = localStorage.getItem('cdn_ccn_clients_v5_agencies');
  if (savedClients) {
    try {
      const parsed = JSON.parse(savedClients);
      AppState.clients = (Array.isArray(parsed) && parsed.length > 0 && parsed[0].agencyId)
        ? parsed
        : [...DEFAULT_CLIENTS_BY_AGENCY];
    } catch {
      AppState.clients = [...DEFAULT_CLIENTS_BY_AGENCY];
    }
  } else {
    AppState.clients = [...DEFAULT_CLIENTS_BY_AGENCY];
  }
  saveData('clients');

  // Motivos y Cuentas
  const savedReasons = localStorage.getItem('cdn_ccn_reasons_v4');
  AppState.reasons = savedReasons ? JSON.parse(savedReasons) : [...DEFAULT_REASONS];

  // Supervisores y CECO
  const savedApprovers = localStorage.getItem('cdn_ccn_approvers_v5');
  AppState.approvers = savedApprovers ? JSON.parse(savedApprovers) : [...DEFAULT_APPROVERS];

  // Órdenes
  const savedOrders = localStorage.getItem('cdn_ccn_orders_v5_agencies');
  AppState.orders = savedOrders ? JSON.parse(savedOrders) : [];

  // Bitácora de Conexiones
  const savedLogs = localStorage.getItem('cdn_ccn_audit_logs_v1');
  AppState.auditLogs = savedLogs ? JSON.parse(savedLogs) : [];

  // Tema
  const savedTheme = localStorage.getItem('cdn_ccn_theme') || 'light';
  setTheme(savedTheme);
}

function saveData(key) {
  if (key === 'orders') {
    localStorage.setItem('cdn_ccn_orders_v5_agencies', JSON.stringify(AppState.orders));
  } else if (key === 'clients') {
    localStorage.setItem('cdn_ccn_clients_v5_agencies', JSON.stringify(AppState.clients));
  } else if (key === 'reasons') {
    localStorage.setItem('cdn_ccn_reasons_v4', JSON.stringify(AppState.reasons));
  } else if (key === 'approvers') {
    localStorage.setItem('cdn_ccn_approvers_v5', JSON.stringify(AppState.approvers));
  } else if (key === 'auditLogs') {
    localStorage.setItem('cdn_ccn_audit_logs_v1', JSON.stringify(AppState.auditLogs));
  }
}

function setupAgenciesDropdowns() {
  dom.loginAgencySelect.innerHTML = '<option value="" disabled selected>-- Seleccione su Agencia --</option>';
  AGENCIES_CATALOG.forEach(ag => {
    const opt = document.createElement('option');
    opt.value = ag.id;
    opt.textContent = `${ag.name}`;
    dom.loginAgencySelect.appendChild(opt);
  });

  dom.adminAgencyFilter.innerHTML = '<option value="all">Todas las Agencias (1 al 24)</option>';
  AGENCIES_CATALOG.forEach(ag => {
    const opt = document.createElement('option');
    opt.value = ag.id;
    opt.textContent = `${ag.name}`;
    dom.adminAgencyFilter.appendChild(opt);
  });

  if (dom.newClientAgency) {
    dom.newClientAgency.innerHTML = '<option value="" disabled selected>-- Asignar Agencia --</option>';
    AGENCIES_CATALOG.forEach(ag => {
      const opt = document.createElement('option');
      opt.value = ag.id;
      opt.textContent = `${ag.name}`;
      dom.newClientAgency.appendChild(opt);
    });
  }

  if (dom.catalogAgencyFilter) {
    dom.catalogAgencyFilter.innerHTML = '<option value="all">Todas las Agencias (1 al 24)</option>';
    AGENCIES_CATALOG.forEach(ag => {
      const opt = document.createElement('option');
      opt.value = ag.id;
      opt.textContent = `${ag.name}`;
      dom.catalogAgencyFilter.appendChild(opt);
    });
  }

  updateDynamicGreeting();
}

// ========================================================
// 6. SISTEMA DE AUTENTICACIÓN Y CONTROL DE ACCESO CON BIENVENIDA DINÁMICA
// ========================================================

/**
 * Motor de Bienvenida Dinámica
 * Genera el saludo y frase según horario (Mañana, Tarde, Noche) y Agencia/Usuario
 */
function getGreetingInfo(customPeriod = null) {
  const now = new Date();
  const hour = now.getHours();

  // Determinación de turno horario
  let period = customPeriod || AppState.greetingSimPeriod;
  if (!period) {
    if (hour >= 5 && hour < 12) {
      period = 'morning';
    } else if (hour >= 12 && hour < 19) {
      period = 'afternoon';
    } else {
      period = 'night';
    }
  }

  // Identificación del Usuario o Agencia
  let userName = 'Operador';
  if (AppState.loginMode === 'admin') {
    userName = 'Administrador Central';
  } else {
    const selectedAgencyId = parseInt(dom.loginAgencySelect?.value, 10);
    const agency = AGENCIES_CATALOG.find(a => a.id === selectedAgencyId);
    if (agency) {
      userName = agency.name; // Ej: "1-B.DISTRIBUC.MGA" o "2-AGENCIA ESTELI"
    }
  }

  let title = '';
  let quote = '';
  let icon = '🌤️';
  let tag = 'Turno Vespertino';

  // Frases exactas requeridas por turno
  if (period === 'morning') {
    icon = '☀️';
    tag = 'Turno Matutino';
    title = `¡Buenos días, ${userName}!`;
    quote = 'Listo para gestionar las operaciones de hoy.';
  } else if (period === 'afternoon') {
    icon = '🌤️';
    tag = 'Turno Vespertino';
    title = `¡Buenas tardes, ${userName}!`;
    quote = 'Continuemos optimizando el flujo de servicio.';
  } else {
    icon = '🌙';
    tag = 'Turno Nocturno';
    title = `¡Buenas noches, ${userName}!`;
    quote = 'Revisando los reportes finales de la jornada.';
  }

  return {
    period,
    icon,
    tag,
    title,
    quote,
    userName,
    clockTime: now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    dateString: now.toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
  };
}

/**
 * Actualiza en tiempo real los textos, iconos y colores del banner dinámico y reloj
 */
function updateDynamicGreeting() {
  const info = getGreetingInfo();

  if (dom.loginLiveClock) {
    dom.loginLiveClock.textContent = info.clockTime;
  }
  if (dom.loginLiveDate) {
    const capDate = info.dateString.charAt(0).toUpperCase() + info.dateString.slice(1);
    dom.loginLiveDate.textContent = capDate;
  }
  if (dom.loginLiveShift) {
    dom.loginLiveShift.textContent = `${info.icon} ${info.tag}`;
  }

  if (dom.dynamicWelcomeBanner) {
    dom.dynamicWelcomeBanner.dataset.period = info.period;
  }
  if (dom.welcomeTimeIcon) {
    dom.welcomeTimeIcon.textContent = info.icon;
  }
  if (dom.welcomeShiftTag) {
    dom.welcomeShiftTag.textContent = info.tag;
  }
  if (dom.welcomeGreetingTitle) {
    dom.welcomeGreetingTitle.textContent = info.title;
  }
  if (dom.welcomeGreetingQuote) {
    dom.welcomeGreetingQuote.textContent = info.quote;
  }
}

/**
 * Control del flujo en 2 pasos: Selección de Agencia -> Bienvenida + Contraseña
 */
function setLoginStep(step) {
  AppState.loginStep = step;

  if (step === 1) {
    if (dom.loginStepAgency) dom.loginStepAgency.style.display = 'block';
    if (dom.loginStepPassword) dom.loginStepPassword.style.display = 'none';
    if (dom.welcomeActiveAgencyChip) dom.welcomeActiveAgencyChip.style.display = 'none';
    if (dom.loginPassword) dom.loginPassword.value = '';
    if (dom.loginErrorMsg) dom.loginErrorMsg.style.display = 'none';
    updateDynamicGreeting();
  } else if (step === 2) {
    if (AppState.loginMode === 'agency') {
      const agencyId = parseInt(dom.loginAgencySelect.value, 10);
      const agency = AGENCIES_CATALOG.find(a => a.id === agencyId);
      if (!agency) {
        showToast("⚠️ Por favor seleccione su agencia autorizada para continuar.", "warning");
        if (dom.loginAgencySelect) dom.loginAgencySelect.focus();
        return false;
      }
      if (dom.stepSelectedIcon) dom.stepSelectedIcon.textContent = '🏢';
      if (dom.stepSelectedAgencyName) dom.stepSelectedAgencyName.textContent = agency.name;
      if (dom.welcomeActiveAgencyName) dom.welcomeActiveAgencyName.textContent = agency.name;
      if (dom.welcomeActiveAgencyChip) dom.welcomeActiveAgencyChip.style.display = 'inline-flex';
    } else {
      const user = dom.loginUsername ? dom.loginUsername.value.trim() || 'admin' : 'admin';
      if (dom.stepSelectedIcon) dom.stepSelectedIcon.textContent = '👑';
      if (dom.stepSelectedAgencyName) dom.stepSelectedAgencyName.textContent = `Administrador Central (${user})`;
      if (dom.welcomeActiveAgencyName) dom.welcomeActiveAgencyName.textContent = 'Administrador Central';
      if (dom.welcomeActiveAgencyChip) dom.welcomeActiveAgencyChip.style.display = 'inline-flex';
    }

    if (dom.loginStepAgency) dom.loginStepAgency.style.display = 'none';
    if (dom.loginStepPassword) dom.loginStepPassword.style.display = 'block';
    if (dom.loginPassword) dom.loginPassword.value = '';
    if (dom.loginErrorMsg) dom.loginErrorMsg.style.display = 'none';
    updateDynamicGreeting();
    setTimeout(() => {
      if (dom.loginPassword) dom.loginPassword.focus();
    }, 120);
  }
  return true;
}

function checkCurrentSession() {
  const savedSession = sessionStorage.getItem('cdn_ccn_current_session');
  if (savedSession) {
    try {
      AppState.currentSession = JSON.parse(savedSession);
      applySession(AppState.currentSession, false);
      return;
    } catch {
      sessionStorage.removeItem('cdn_ccn_current_session');
    }
  }

  showLoginScreen();
}

function showLoginScreen() {
  AppState.currentScreen = "login";
  dom.loginScreen.style.display = 'flex';
  dom.portalScreen.style.display = 'none';
  dom.mainScreen.style.display = 'none';
  if (dom.loginPassword) dom.loginPassword.value = '';
  if (dom.loginErrorMsg) dom.loginErrorMsg.style.display = 'none';

  // Si el usuario ya usó una agencia anteriormente en este equipo, preseleccionarla
  const rememberedAgencyId = localStorage.getItem('cdn_ccn_last_agency_id');
  if (rememberedAgencyId && AppState.loginMode === 'agency') {
    dom.loginAgencySelect.value = rememberedAgencyId;
    setLoginStep(2);
  } else {
    setLoginStep(1);
  }
  updateDynamicGreeting();
}

function handleLoginSubmit(e) {
  e.preventDefault();
  dom.loginErrorMsg.style.display = 'none';

  const pass = dom.loginPassword.value.trim();

  if (AppState.loginMode === 'admin') {
    const user = dom.loginUsername.value.trim().toLowerCase();
    if (user === ADMIN_ACCOUNT.username && pass === ADMIN_ACCOUNT.pass) {
      const session = {
        user: ADMIN_ACCOUNT.username,
        role: "admin",
        name: ADMIN_ACCOUNT.name,
        agencyId: ADMIN_ACCOUNT.agencyId,
        agencyName: ADMIN_ACCOUNT.agencyName
      };
      authenticate(session);
      return;
    }
  } else {
    const agencyId = parseInt(dom.loginAgencySelect.value, 10);
    const agency = AGENCIES_CATALOG.find(a => a.id === agencyId);

    if (agency && pass === agency.pass) {
      // Recordar agencia para bienvenida personalizada inmediata en futuras visitas
      localStorage.setItem('cdn_ccn_last_agency_id', String(agency.id));

      const session = {
        user: agency.username,
        role: "agency",
        name: agency.name,
        agencyId: agency.id,
        agencyName: agency.name
      };
      authenticate(session);
      return;
    }
  }

  dom.loginErrorMsg.style.display = 'block';
  dom.loginPassword.focus();
  showToast("⚠️ Contraseña o agencia no válida. Verifique e intente de nuevo.", "error");
}

function authenticate(session) {
  AppState.currentSession = session;
  sessionStorage.setItem('cdn_ccn_current_session', JSON.stringify(session));

  recordAuditLog(session);
  applySession(session, true);
}

function recordAuditLog(session) {
  const now = new Date();
  const logEntry = {
    id: `LOG-${Date.now().toString().slice(-6)}`,
    user: session.user,
    agencyId: session.agencyId,
    agencyName: session.agencyName,
    role: session.role === 'admin' ? 'Administrador' : 'Operador Agencia',
    date: now.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    time: now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    device: /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) ? 'Teléfono Móvil' : 'PC / Escritorio',
    status: 'Conectado Exitosamente',
    timestamp: Date.now()
  };

  // Guardar copia local inmediata
  AppState.auditLogs.unshift(logEntry);
  saveData('auditLogs');

  // ENVIAR A LA NUBE (FIREBASE) PARA QUE EL ADMIN LO VEA DESDE SU PC
  CloudSync.sendAuditLog(logEntry).then(ok => {
    if (ok) console.log("Log de inicio de sesión sincronizado con Firebase.");
  });
}

function applySession(session, isNewLogin = false) {
  const isAdmin = session.role === 'admin';

  const badgeText = isAdmin ? '👑 ADMINISTRADOR CENTRAL' : `🏢 ${session.agencyName}`;
  const roleText = isAdmin ? 'Acceso Total & Auditoría' : `Operador Autorizado (ID: ${session.agencyId})`;

  dom.sessionAgencyNamePortal.textContent = badgeText;
  dom.sessionRoleTextPortal.textContent = roleText;
  dom.sessionAgencyNameMain.textContent = badgeText;
  dom.sessionRoleTextMain.textContent = roleText;

  dom.sessionBadgePortal.className = `session-agency-pill ${isAdmin ? 'admin-pill' : ''}`;
  dom.sessionBadgeMain.className = `session-agency-pill ${isAdmin ? 'admin-pill' : ''}`;

  dom.btnAuditLogsPortal.style.display = isAdmin ? 'inline-flex' : 'none';
  dom.btnAuditLogsMain.style.display = isAdmin ? 'inline-flex' : 'none';
  dom.adminAgencyFilterWrapper.style.display = isAdmin ? 'inline-flex' : 'none';
  dom.portalBtnOpenCatalog.style.display = isAdmin ? 'inline-flex' : 'none';
  dom.btnOpenCatalog.style.display = isAdmin ? 'inline-flex' : 'none';

  AppState.currentScreen = "portal";
  dom.loginScreen.style.display = 'none';
  dom.portalScreen.style.display = 'flex';
  dom.mainScreen.style.display = 'none';

  populateDropdowns();
  updatePortalCounts();
  renderStats();
  renderOrdersTable();

  // Sincronizar órdenes desde la nube al entrar
  syncOrdersFromCloud();

  if (isNewLogin) {
    showToast(`👋 Bienvenido: <strong>${session.name}</strong>`, "success");
  }
}

function logout() {
  if (confirm("¿Desea cerrar la sesión actual?")) {
    AppState.currentSession = null;
    sessionStorage.removeItem('cdn_ccn_current_session');
    showLoginScreen();
    showToast("🔒 Sesión finalizada correctamente.", "info");
  }
}

// Sincronizar órdenes guardadas en la nube
async function syncOrdersFromCloud() {
  const cloudOrders = await CloudSync.fetchOrders();
  if (cloudOrders && cloudOrders.length > 0) {
    const existingIds = new Set(AppState.orders.map(o => o.id));
    let added = 0;
    cloudOrders.forEach(co => {
      if (!existingIds.has(co.id)) {
        AppState.orders.push(co);
        added++;
      }
    });
    if (added > 0) {
      saveData('orders');
      renderStats();
      renderOrdersTable();
      updatePortalCounts();
    }
  }
}

// ========================================================
// 7. LLENADO DE LISTAS DESPLEGABLES CON SEGMENTACIÓN
// ========================================================
function populateDropdowns() {
  if (!AppState.currentSession) return;

  const isAdmin = AppState.currentSession.role === 'admin';
  const agencyId = AppState.currentSession.agencyId;

  let availableClients = [];
  if (isAdmin) {
    if (AppState.filterAgencyAdmin !== 'all') {
      const selectedAgId = parseInt(AppState.filterAgencyAdmin, 10);
      availableClients = AppState.clients.filter(c => c.agencyId === selectedAgId);
    } else {
      availableClients = [...AppState.clients];
    }
  } else {
    // Operador de agencia: SOLO ve sus 5 proveedores
    availableClients = AppState.clients.filter(c => c.agencyId === agencyId);
  }

  // 1. Dropdown: PROVEEDOR
  dom.clientIdSelect.innerHTML = '<option value="" disabled selected>-- Seleccione PROVEEDOR (Código) --</option>';
  availableClients.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.id}`;
    dom.clientIdSelect.appendChild(opt);
  });

  // 2. Dropdown: NOMBRE
  dom.clientNameSelect.innerHTML = '<option value="" disabled selected>-- Seleccione NOMBRE --</option>';
  availableClients.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.name;
    opt.textContent = `${c.name}`;
    dom.clientNameSelect.appendChild(opt);
  });

  // 3. Dropdown: DESCRIPCION DEL SERVICIO
  dom.orderReasonSelect.innerHTML = '<option value="" disabled selected>-- Seleccione DESCRIPCION DEL SERVICIO --</option>';
  AppState.reasons.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.reason;
    opt.textContent = r.reason;
    dom.orderReasonSelect.appendChild(opt);
  });

  // 4. Dropdown: CUENTA
  dom.accountNumberSelect.innerHTML = '<option value="" disabled selected>-- Seleccione CUENTA --</option>';
  AppState.reasons.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.account;
    opt.textContent = `${r.account} (${r.reason})`;
    dom.accountNumberSelect.appendChild(opt);
  });

  // 5. Dropdown: LIBERA
  dom.releasedBySelect.innerHTML = '<option value="" disabled selected>-- Seleccione Quién LIBERA --</option>';
  AppState.approvers.forEach(app => {
    const opt = document.createElement('option');
    opt.value = app.name;
    opt.textContent = app.name;
    dom.releasedBySelect.appendChild(opt);
  });

  dom.costCenterInput.value = '';
}

function suggestServiceFromReason(reason) {
  const r = (reason || '').toLowerCase();
  if (r.includes('equipo frío') || r.includes('equipo frio')) {
    return r.includes('retiro') ? 'RETIRO EQUIPO FRIO' : 'ENTREGA EQUIPO FRIO';
  }
  if (r.includes('botellón') || r.includes('botellon')) {
    return (r.includes('retorno') || r.includes('recolección') || r.includes('recoleccion')) ? 'RETORNO BOTELLON' : 'BOTELLON';
  }
  if (r.includes('traslado')) return 'TRASLADO';
  if (r.includes('foráneo') || r.includes('foraneo')) return 'FORANEO';
  if (r.includes('express')) return 'EXPRESS';
  if (r.includes('canje') || r.includes('mantenimiento')) return 'MANTENIMIENTO';
  if (r.includes('distribución') || r.includes('distribucion') || r.includes('canal')) return 'DISTRIBUCION';
  return 'FLETE';
}

// ========================================================
// 8. EVENT LISTENERS
// ========================================================
function setupEventListeners() {
  // Inicializar reloj en vivo continuo
  setInterval(updateDynamicGreeting, 1000);

  // Tabs de Login
  dom.tabLoginAgency.addEventListener('click', () => {
    AppState.loginMode = 'agency';
    dom.tabLoginAgency.classList.add('active');
    dom.tabLoginAdmin.classList.remove('active');
    dom.groupAgencySelect.style.display = 'block';
    dom.groupAdminUser.style.display = 'none';
    dom.loginAgencySelect.required = true;
    dom.loginUsername.required = false;
    dom.loginPassword.value = '';
    dom.loginErrorMsg.style.display = 'none';
    updateDynamicGreeting();
  });

  dom.tabLoginAdmin.addEventListener('click', () => {
    AppState.loginMode = 'admin';
    dom.tabLoginAdmin.classList.add('active');
    dom.tabLoginAgency.classList.remove('active');
    dom.groupAgencySelect.style.display = 'none';
    dom.groupAdminUser.style.display = 'block';
    dom.loginAgencySelect.required = false;
    dom.loginUsername.required = true;
    dom.loginPassword.value = '';
    dom.loginErrorMsg.style.display = 'none';
    updateDynamicGreeting();
  });

  // Cambio en selector de agencia: actualiza saludo y avanza con micro-transición
  dom.loginAgencySelect.addEventListener('change', () => {
    updateDynamicGreeting();
    if (dom.loginAgencySelect.value) {
      setTimeout(() => {
        setLoginStep(2);
      }, 240);
    }
  });

  // Botón Continuar al Login (Paso 1 -> Paso 2)
  if (dom.btnContinueToPassword) {
    dom.btnContinueToPassword.addEventListener('click', () => {
      setLoginStep(2);
    });
  }

  // Botones para volver al Paso 1 (Cambiar Agencia)
  if (dom.btnBackToStep1) {
    dom.btnBackToStep1.addEventListener('click', () => setLoginStep(1));
  }
  if (dom.btnChangeAgencyStep2) {
    dom.btnChangeAgencyStep2.addEventListener('click', () => setLoginStep(1));
  }
  if (dom.btnWelcomeChangeAgency) {
    dom.btnWelcomeChangeAgency.addEventListener('click', () => setLoginStep(1));
  }

  // Toggle de visibilidad de contraseña (ojo)
  if (dom.btnTogglePasswordVis) {
    dom.btnTogglePasswordVis.addEventListener('click', () => {
      const isPass = dom.loginPassword.type === 'password';
      dom.loginPassword.type = isPass ? 'text' : 'password';
      dom.btnTogglePasswordVis.textContent = isPass ? '🔒' : '👁️';
      dom.btnTogglePasswordVis.title = isPass ? 'Ocultar contraseña' : 'Ver contraseña';
    });
  }

  // Simulador de horario (Mañana, Tarde, Noche, Automático)
  if (dom.timeSimPills && dom.timeSimPills.length > 0) {
    dom.timeSimPills.forEach(pill => {
      pill.addEventListener('click', () => {
        dom.timeSimPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const sim = pill.dataset.sim;
        AppState.greetingSimPeriod = sim === 'auto' ? null : sim;
        updateDynamicGreeting();

        // Efecto visual de pulso al cambiar
        if (dom.dynamicWelcomeBanner) {
          dom.dynamicWelcomeBanner.style.transform = 'scale(1.02)';
          setTimeout(() => {
            dom.dynamicWelcomeBanner.style.transform = 'scale(1)';
          }, 180);
        }
      });
    });
  }

  // Envío de Login
  dom.loginForm.addEventListener('submit', handleLoginSubmit);

  // Atajos rápidos de prueba en login
  dom.quickChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const isAdmin = chip.dataset.admin === 'true';
      const pass = chip.dataset.pass;
      if (isAdmin) {
        dom.tabLoginAdmin.click();
        dom.loginUsername.value = 'admin';
        dom.loginPassword.value = pass;
      } else {
        dom.tabLoginAgency.click();
        dom.loginAgencySelect.value = chip.dataset.agency;
        dom.loginPassword.value = pass;
      }
      dom.loginForm.requestSubmit();
    });
  });

  // Cerrar Sesión
  dom.btnLogoutPortal.addEventListener('click', logout);
  dom.btnLogoutMain.addEventListener('click', logout);

  // Modal de Auditoría
  dom.btnAuditLogsPortal.addEventListener('click', openAuditModal);
  dom.btnAuditLogsMain.addEventListener('click', openAuditModal);
  dom.btnCloseAudit.addEventListener('click', closeAuditModal);
  dom.btnCloseAuditFooter.addEventListener('click', closeAuditModal);
  dom.btnClearAuditLogs.addEventListener('click', confirmClearAuditLogs);
  if (dom.btnExportAuditExcel) {
    dom.btnExportAuditExcel.addEventListener('click', exportAuditExcel);
  }
  dom.auditSearch.addEventListener('input', (e) => {
    AppState.auditSearchQuery = e.target.value.toLowerCase();
    renderAuditTable();
  });

  // Configuración de Nube (Google Sheets / Firebase)
  dom.btnOpenCloudConfig.addEventListener('click', () => {
    dom.cloudConfigBox.style.display = dom.cloudConfigBox.style.display === 'none' ? 'block' : 'none';
    dom.cloudDbUrlInput.value = CloudSync.getDbUrl();
    dom.cloudDbUrlInput.focus();
  });
  dom.btnCancelCloudConfig.addEventListener('click', () => {
    dom.cloudConfigBox.style.display = 'none';
  });
  dom.btnSaveCloudDbUrl.addEventListener('click', async () => {
    const newUrl = dom.cloudDbUrlInput.value.trim();
    if (!newUrl) {
      showToast("⚠️ Ingrese la URL de su Google Apps Script o Firebase", "warning");
      return;
    }
    CloudSync.setDbUrl(newUrl);

    if (newUrl.includes('script.google.com')) {
      showToast("⏳ Conectando con Google Sheets...", "info");
      updateCloudStatusUI(true);
      dom.cloudConfigBox.style.display = 'none';
      await refreshAuditFromCloud();
      showToast("🎉 ¡Conexión con Google Sheets guardada! Los registros se guardarán en tu hoja de Excel.", "success");
      return;
    }

    showToast("⏳ Probando conexión...", "info");
    const testLogs = await CloudSync.fetchAuditLogs();
    if (testLogs !== null) {
      showToast("🎉 ¡Conexión exitosa! Sincronización multi-dispositivo activa.", "success");
      dom.cloudConfigBox.style.display = 'none';
      updateCloudStatusUI(true);
      refreshAuditFromCloud();
    } else {
      showToast("⚠️ No se pudo conectar. Verifique que la URL sea válida y esté en modo público/prueba.", "error");
      updateCloudStatusUI(false);
    }
  });

  // Selección de Empresa en Pantalla Inicial
  dom.btnSelectCDN.addEventListener('click', () => enterDashboard('CDN'));
  dom.btnSelectCCN.addEventListener('click', () => enterDashboard('CCN'));

  // Volver a la Pantalla de Selección
  dom.btnBackToPortal.addEventListener('click', returnToPortal);

  // AMARRE 1: PROVEEDOR (Código) <--> NOMBRE (Persona)
  dom.clientIdSelect.addEventListener('change', () => {
    const selectedId = dom.clientIdSelect.value;
    const match = AppState.clients.find(c => c.id === selectedId);
    if (match) {
      dom.clientNameSelect.value = match.name;
      highlightField(dom.clientNameSelect);
    }
  });

  dom.clientNameSelect.addEventListener('change', () => {
    const selectedName = dom.clientNameSelect.value;
    const match = AppState.clients.find(c => c.name === selectedName);
    if (match) {
      dom.clientIdSelect.value = match.id;
      highlightField(dom.clientIdSelect);
    }
  });

  // AMARRE 2: DESCRIPCION DEL SERVICIO <--> CUENTA
  dom.orderReasonSelect.addEventListener('change', () => {
    const selectedReason = dom.orderReasonSelect.value;
    const match = AppState.reasons.find(r => r.reason === selectedReason);
    if (match) {
      dom.accountNumberSelect.value = match.account;
      highlightField(dom.accountNumberSelect);
      if (!dom.serviceInput.value.trim()) {
        dom.serviceInput.value = suggestServiceFromReason(selectedReason);
        highlightField(dom.serviceInput);
      }
    }
  });

  dom.accountNumberSelect.addEventListener('change', () => {
    const selectedAccount = dom.accountNumberSelect.value;
    const match = AppState.reasons.find(r => r.account === selectedAccount);
    if (match) {
      dom.orderReasonSelect.value = match.reason;
      highlightField(dom.orderReasonSelect);
      if (!dom.serviceInput.value.trim()) {
        dom.serviceInput.value = suggestServiceFromReason(match.reason);
        highlightField(dom.serviceInput);
      }
    }
  });

  // AMARRE 3: LIBERA -> CECO
  const syncCostCenter = () => {
    const selectedName = dom.releasedBySelect.value;
    const match = AppState.approvers.find(a => a.name === selectedName);
    if (match) {
      dom.costCenterInput.value = match.costCenter;
      highlightField(dom.costCenterInput);
    } else {
      dom.costCenterInput.value = '';
    }
  };
  dom.releasedBySelect.addEventListener('change', syncCostCenter);
  dom.releasedBySelect.addEventListener('input', syncCostCenter);

  // Envío del Formulario
  dom.orderForm.addEventListener('submit', handleFormSubmit);

  // Limpiar campos del formulario
  dom.btnClearForm.addEventListener('click', () => clearForm(false));

  // Generar Excel
  dom.btnGenerateExcel.addEventListener('click', generateExcel);

  // Vaciar registros
  dom.btnClearAllOrders.addEventListener('click', confirmClearAllOrders);

  // Buscador y Filtros de Tabla
  dom.tableSearch.addEventListener('input', (e) => {
    AppState.searchQuery = e.target.value.toLowerCase();
    renderOrdersTable();
  });

  dom.filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      dom.filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      AppState.filterCompany = chip.dataset.filter;
      renderOrdersTable();
    });
  });

  // Filtro de Agencia exclusivo para Administrador
  dom.adminAgencyFilter.addEventListener('change', (e) => {
    AppState.filterAgencyAdmin = e.target.value;
    populateDropdowns();
    renderOrdersTable();
  });

  // Tema
  dom.btnToggleTheme.addEventListener('click', toggleTheme);
  dom.portalBtnToggleTheme.addEventListener('click', toggleTheme);
  dom.loginBtnToggleTheme.addEventListener('click', toggleTheme);

  // Modal de Catálogo
  dom.btnOpenCatalog.addEventListener('click', openCatalogModal);
  dom.portalBtnOpenCatalog.addEventListener('click', openCatalogModal);
  dom.btnCloseCatalog.addEventListener('click', closeCatalogModal);
  dom.btnSaveAndCloseCatalog.addEventListener('click', closeCatalogModal);
  dom.catalogModal.addEventListener('click', (e) => {
    if (e.target === dom.catalogModal) closeCatalogModal();
  });

  // Tabs del Catálogo
  dom.catalogTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      dom.catalogTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      dom.tabClientsContent.style.display = tab.dataset.tab === 'clients' ? 'block' : 'none';
      dom.tabReasonsContent.style.display = tab.dataset.tab === 'reasons' ? 'block' : 'none';
      dom.tabApproversContent.style.display = tab.dataset.tab === 'approvers' ? 'block' : 'none';
    });
  });

  // Acciones en Catálogo
  dom.btnAddClient.addEventListener('click', addClientToCatalog);
  dom.btnAddReason.addEventListener('click', addReasonToCatalog);
  dom.btnAddApprover.addEventListener('click', addApproverToCatalog);
  if (dom.catalogAgencyFilter) {
    dom.catalogAgencyFilter.addEventListener('change', renderCatalogTables);
  }
}

function highlightField(element) {
  element.style.borderColor = "var(--accent-green)";
  element.style.boxShadow = "0 0 10px rgba(16, 185, 129, 0.4)";
  setTimeout(() => {
    element.style.borderColor = "";
    element.style.boxShadow = "";
  }, 1000);
}

// ========================================================
// 9. LOGOS VECTORIALES OFICIALES
// ========================================================
const LOGO_SVGS = {
  CDN: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" width="70" height="38" class="header-logo-svg">
    <g transform="translate(10, 10)">
      <path d="M 125,50 C 122,25 105,10 82,10 C 55,10 38,32 38,62 C 38,92 55,114 82,114 C 105,114 122,99 125,74 L 98,74 C 95,84 89,91 80,91 C 67,91 59,79 59,62 C 59,45 67,33 80,33 C 89,33 95,40 98,50 Z" fill="#1d4ed8" />
      <path d="M 105,38 L 132,38 C 152,38 166,51 166,73 C 166,95 152,108 132,108 L 105,108 Z M 123,54 L 123,92 L 131,92 C 141,92 148,84 148,73 C 148,62 141,54 131,54 Z" fill="#1d4ed8" />
      <path d="M 172,58 L 187,58 L 187,68 C 192,60 200,56 211,56 C 226,56 235,66 235,82 L 235,108 L 217,108 L 217,85 C 217,76 212,71 204,71 C 196,71 190,76 190,85 L 190,108 L 172,108 Z" fill="#16a34a" />
      <path d="M 32,108 C 80,138 180,140 248,96 C 220,126 100,128 32,108 Z" fill="#16a34a" />
      <text x="150" y="142" text-anchor="middle" font-family="'Arial Black', 'Montserrat', sans-serif" font-size="15" font-weight="900" font-style="italic" letter-spacing="1.2" fill="#1d4ed8">COMPAÑÍA DISTRIBUIDORA</text>
      <text x="150" y="160" text-anchor="middle" font-family="'Arial Black', 'Montserrat', sans-serif" font-size="14" font-weight="900" font-style="italic" letter-spacing="1.8" fill="#1d4ed8">DE NICARAGUA S.A.</text>
    </g>
  </svg>`,
  CCN: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" width="70" height="38" class="header-logo-svg">
    <g transform="translate(10, 10)">
      <path d="M 175,34 C 172,14 158,2 136,2 C 114,2 99,17 97,37 L 118,37 C 120,27 126,20 136,20 C 146,20 152,26 154,34 Z" fill="#15803d" />
      <path d="M 148,68 C 145,46 130,32 108,32 C 84,32 68,52 68,80 C 68,108 84,128 108,128 C 130,128 145,114 148,92 L 126,92 C 123,103 117,110 108,110 C 96,110 89,97 89,80 C 89,63 96,50 108,50 C 117,50 123,57 126,68 Z" fill="#15803d" />
      <path d="M 144,48 L 165,48 L 195,96 L 195,48 L 214,48 L 214,124 L 193,124 L 163,76 L 163,124 L 144,124 Z" fill="#15803d" />
      <path d="M 210,105 C 225,85 248,50 282,18" stroke="#d97706" stroke-width="3.5" stroke-linecap="round" fill="none" />
      <path d="M 276,16 C 286,20 288,32 278,35 C 268,32 268,22 276,16 Z" fill="#d97706" />
      <path d="M 264,28 C 274,32 276,44 266,47 C 256,44 256,34 264,28 Z" fill="#d97706" />
      <path d="M 250,42 C 260,46 262,58 252,61 C 242,58 242,48 250,42 Z" fill="#d97706" />
      <path d="M 236,56 C 246,60 248,72 238,75 C 228,72 228,62 236,56 Z" fill="#d97706" />
      <path d="M 222,70 C 232,74 234,86 224,89 C 214,86 214,76 222,70 Z" fill="#d97706" />
      <path d="M 24,106 C 75,136 185,138 255,92 C 225,124 95,126 24,106 Z" fill="#d97706" />
      <text x="150" y="146" text-anchor="middle" font-family="'Arial Black', 'Montserrat', sans-serif" font-size="15" font-weight="900" letter-spacing="1.2" fill="#15803d">COMPAÑÍA CERVECERA</text>
      <text x="150" y="164" text-anchor="middle" font-family="'Arial Black', 'Montserrat', sans-serif" font-size="14" font-weight="900" letter-spacing="1.8" fill="#15803d">DE NICARAGUA S.A.</text>
    </g>
  </svg>`
};

// ========================================================
// 10. TRANSICIONES DE PANTALLA
// ========================================================
function enterDashboard(company) {
  AppState.selectedCompany = company;
  AppState.currentScreen = "main";

  const companyFullName = company === 'CDN'
    ? 'Compañía Distribuidora de Nicaragua S.A.'
    : 'Compañía Cervecera de Nicaragua S.A.';

  const appHeader = document.querySelector('.app-header');
  if (appHeader) {
    appHeader.className = `app-header ${company.toLowerCase()}`;
  }

  dom.activeCompanyBadge.className = `active-company-pill ${company.toLowerCase()}`;
  dom.activeCompanyBadge.innerHTML = `
    <div class="header-logo-badge">
      ${LOGO_SVGS[company]}
    </div>
    <div class="header-company-info">
      <span class="active-company-name">${companyFullName}</span>
    </div>
  `;

  dom.portalScreen.style.display = 'none';
  dom.mainScreen.style.display = 'block';

  dom.filterChips.forEach(chip => {
    const isCompany = chip.dataset.filter === company;
    chip.classList.toggle('active', isCompany);
  });
  AppState.filterCompany = company;

  renderStats();
  renderOrdersTable();
  clearForm(false);

  showToast(`🏢 Módulo activo: <strong>${companyFullName}</strong>`, "info");
}

function returnToPortal() {
  AppState.currentScreen = "portal";
  dom.mainScreen.style.display = 'none';
  dom.portalScreen.style.display = 'flex';
  updatePortalCounts();
}

function updatePortalCounts() {
  const visible = getVisibleOrders();
  const cdnCount = visible.filter(o => o.company === 'CDN').length;
  const ccnCount = visible.filter(o => o.company === 'CCN').length;
  dom.portalCdnCount.textContent = cdnCount;
  dom.portalCcnCount.textContent = ccnCount;
}

function getVisibleOrders() {
  if (!AppState.currentSession) return [];

  if (AppState.currentSession.role === 'admin') {
    if (AppState.filterAgencyAdmin !== 'all') {
      const targetAgencyId = parseInt(AppState.filterAgencyAdmin, 10);
      return AppState.orders.filter(o => o.agencyId === targetAgencyId);
    }
    return [...AppState.orders];
  }

  return AppState.orders.filter(o => o.agencyId === AppState.currentSession.agencyId);
}

// ========================================================
// 11. REGISTRO DE ÓRDENES
// ========================================================
function handleFormSubmit(e) {
  e.preventDefault();

  if (!AppState.selectedCompany) {
    showToast("⚠️ Empresa no seleccionada. Regrese al menú inicial.", "error");
    return;
  }

  if (!AppState.currentSession) {
    showToast("⚠️ Sesión expirada. Inicie sesión nuevamente.", "error");
    showLoginScreen();
    return;
  }

  const provider = dom.clientIdSelect.value;
  const name = dom.clientNameSelect.value;
  const service = dom.serviceInput.value.trim().toUpperCase();
  const serviceDescription = dom.orderReasonSelect.value;
  const concept = dom.orderConcept.value.trim();
  const account = dom.accountNumberSelect.value;
  const purchaseGroup = dom.purchaseGroupInput.value.trim().toUpperCase();
  const management = dom.managementInput.value.trim();
  const releasedBy = dom.releasedBySelect.value;
  const ceco = dom.costCenterInput.value.trim();
  const rawTotal = parseFloat(dom.orderAmount.value);

  if (!provider || !name) {
    showToast("⚠️ Debe seleccionar el PROVEEDOR (Código y Nombre)", "warning");
    dom.clientIdSelect.focus();
    return;
  }

  if (!service) {
    showToast("⚠️ Ingrese o seleccione el SERVICIO", "warning");
    dom.serviceInput.focus();
    return;
  }

  if (!serviceDescription || !account) {
    showToast("⚠️ Debe seleccionar la DESCRIPCION DEL SERVICIO y CUENTA", "warning");
    dom.orderReasonSelect.focus();
    return;
  }

  if (!concept) {
    showToast("⚠️ Ingrese el CONCEPTO del servicio o ruta", "warning");
    dom.orderConcept.focus();
    return;
  }

  if (!purchaseGroup) {
    showToast("⚠️ Ingrese el GRUPO DE COMPRA", "warning");
    dom.purchaseGroupInput.focus();
    return;
  }

  if (!management) {
    showToast("⚠️ Ingrese la GERENCIA correspondiente", "warning");
    dom.managementInput.focus();
    return;
  }

  if (!releasedBy) {
    showToast("⚠️ Seleccione quién LIBERA la orden", "warning");
    dom.releasedBySelect.focus();
    return;
  }

  if (!ceco) {
    showToast("⚠️ No se ha determinado el CECO del supervisor", "warning");
    dom.releasedBySelect.focus();
    return;
  }

  if (isNaN(rawTotal) || rawTotal < 0) {
    showToast("⚠️ Ingrese un TOTAL válido para la liquidación", "warning");
    dom.orderAmount.focus();
    return;
  }

  const now = new Date();
  const newOrder = {
    id: `ORD-${Date.now().toString().slice(-6)}`,
    company: AppState.selectedCompany,
    agencyId: AppState.currentSession.agencyId,
    agencyName: AppState.currentSession.agencyName,
    loggedUser: AppState.currentSession.user,
    provider,
    clientId: provider,
    name,
    clientName: name,
    service,
    serviceDescription,
    orderReason: serviceDescription,
    concept,
    orderConcept: concept,
    account,
    accountNumber: account,
    purchaseGroup,
    management,
    releasedBy,
    ceco,
    costCenter: ceco,
    total: rawTotal,
    amount: rawTotal,
    formattedTotal: `C$ ${rawTotal.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    formattedAmount: `C$ ${rawTotal.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    dateIso: now.toISOString(),
    formattedDate: now.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    formattedTime: now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  };

  AppState.orders.unshift(newOrder);
  saveData('orders');

  // Enviar a Firebase para sincronización con el Admin
  CloudSync.sendOrder(newOrder);

  renderStats();
  renderOrdersTable();
  updatePortalCounts();
  clearForm(false);

  showToast(`✅ Orden <strong>${newOrder.id}</strong> registrada para <strong>${newOrder.agencyName}</strong>`, "success");

  dom.clientIdSelect.focus();
}

function clearForm(clearAll = false) {
  dom.clientIdSelect.selectedIndex = 0;
  dom.clientNameSelect.selectedIndex = 0;
  if (dom.serviceInput) dom.serviceInput.value = '';
  dom.orderReasonSelect.selectedIndex = 0;
  dom.accountNumberSelect.selectedIndex = 0;
  dom.orderConcept.value = '';
  if (dom.purchaseGroupInput) dom.purchaseGroupInput.value = 'GC01';
  if (dom.managementInput) {
    dom.managementInput.value = AppState.selectedCompany === 'CDN' ? 'Gerencia de Distribución' : 'Gerencia de Operaciones';
  }
  dom.orderAmount.value = '';
  dom.releasedBySelect.selectedIndex = 0;
  dom.costCenterInput.value = '';
}

// ========================================================
// 12. TABLA DE REGISTROS Y ESTADÍSTICAS
// ========================================================
function renderStats() {
  const visible = getVisibleOrders();
  const total = visible.length;
  const cdn = visible.filter(o => o.company === 'CDN').length;
  const ccn = visible.filter(o => o.company === 'CCN').length;

  const totalAmountSum = visible.reduce((acc, curr) => acc + (curr.total || curr.amount || 0), 0);

  dom.statTotal.textContent = total;
  dom.statCdn.textContent = cdn;
  dom.statCcn.textContent = ccn;
  dom.statTotalAmount.textContent = `C$ ${totalAmountSum.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  dom.tableCountBadge.textContent = `${total} Registros`;
}

function renderOrdersTable() {
  let list = getVisibleOrders();

  if (AppState.filterCompany !== 'all') {
    list = list.filter(o => o.company === AppState.filterCompany);
  }

  if (AppState.searchQuery) {
    const q = AppState.searchQuery;
    list = list.filter(o => 
      (o.id && o.id.toLowerCase().includes(q)) ||
      ((o.provider || o.clientId) && (o.provider || o.clientId).toLowerCase().includes(q)) ||
      ((o.name || o.clientName) && (o.name || o.clientName).toLowerCase().includes(q)) ||
      (o.service && o.service.toLowerCase().includes(q)) ||
      ((o.serviceDescription || o.orderReason) && (o.serviceDescription || o.orderReason).toLowerCase().includes(q)) ||
      ((o.concept || o.orderConcept) && (o.concept || o.orderConcept).toLowerCase().includes(q)) ||
      ((o.account || o.accountNumber) && (o.account || o.accountNumber).toLowerCase().includes(q)) ||
      (o.purchaseGroup && o.purchaseGroup.toLowerCase().includes(q)) ||
      (o.management && o.management.toLowerCase().includes(q)) ||
      (o.releasedBy && o.releasedBy.toLowerCase().includes(q)) ||
      ((o.ceco || o.costCenter) && (o.ceco || o.costCenter).toLowerCase().includes(q)) ||
      (o.agencyName && o.agencyName.toLowerCase().includes(q)) ||
      ((o.formattedTotal || o.formattedAmount) && (o.formattedTotal || o.formattedAmount).toLowerCase().includes(q))
    );
  }

  if (list.length === 0) {
    dom.ordersTableBody.innerHTML = '';
    dom.emptyState.style.display = 'block';
    return;
  }

  dom.emptyState.style.display = 'none';

  dom.ordersTableBody.innerHTML = list.map(order => `
    <tr>
      <td>
        <span style="font-family: monospace; font-weight: 700; color: var(--text-muted);">${order.id}</span>
      </td>
      <td>
        <span class="badge-corp ${order.company.toLowerCase()}">${order.company}</span>
      </td>
      <td>
        <strong style="color: #60a5fa; font-family: monospace; font-size: 0.95rem;">${escapeHtml(order.provider || order.clientId)}</strong>
      </td>
      <td>
        <span style="font-weight: 600;">${escapeHtml(order.name || order.clientName)}</span>
      </td>
      <td>
        <span class="badge-service">${escapeHtml(order.service || 'SERVICIO')}</span>
      </td>
      <td>${escapeHtml(order.serviceDescription || order.orderReason)}</td>
      <td class="cell-concept" title="${escapeHtml(order.concept || order.orderConcept)}">
        ${escapeHtml(order.concept || order.orderConcept)}
      </td>
      <td>
        <span style="font-family: monospace; background: rgba(255,255,255,0.06); padding: 3px 8px; border-radius: 4px;">
          ${escapeHtml(order.account || order.accountNumber)}
        </span>
      </td>
      <td>
        <span style="font-family: monospace; font-weight: 700; color: #f59e0b; background: rgba(245, 158, 11, 0.1); padding: 3px 8px; border-radius: 4px;">
          ${escapeHtml(order.purchaseGroup || '-')}
        </span>
      </td>
      <td style="font-size: 0.82rem; color: var(--text-muted);">
        ${escapeHtml(order.management || '-')}
      </td>
      <td>
        <span style="color: #a78bfa; font-weight: 600;">${escapeHtml(order.releasedBy)}</span>
      </td>
      <td>
        <span style="font-family: monospace; font-weight: 700; color: #60a5fa; background: rgba(59, 130, 246, 0.1); padding: 3px 8px; border-radius: 4px;">
          ${escapeHtml(order.ceco || order.costCenter || '')}
        </span>
      </td>
      <td>
        <strong style="color: #10b981; font-family: monospace; font-size: 0.92rem;">
          ${order.formattedTotal || order.formattedAmount || ('C$ ' + (order.total || order.amount || 0).toFixed(2))}
        </strong>
      </td>
      <td style="font-size: 0.76rem; color: var(--text-dim);">
        ${order.formattedDate} <br/>
        <span style="opacity:0.8">${order.formattedTime}</span>
      </td>
      <td style="text-align: center;">
        <button class="btn btn-outline btn-sm" onclick="deleteOrder('${order.id}')" title="Eliminar orden" style="color: #f43f5e; padding: 4px 8px;">
          ✕
        </button>
      </td>
    </tr>
  `).join('');
}

window.deleteOrder = function(orderId) {
  if (confirm(`¿Está seguro de eliminar la orden ${orderId}?`)) {
    AppState.orders = AppState.orders.filter(o => o.id !== orderId);
    saveData('orders');
    renderStats();
    renderOrdersTable();
    updatePortalCounts();
    showToast(`Orden eliminada`, "info");
  }
};

function confirmClearAllOrders() {
  const visible = getVisibleOrders();
  if (visible.length === 0) {
    showToast("No hay órdenes registradas para eliminar", "info");
    return;
  }
  if (confirm(`⚠️ ¿Desea eliminar las ${visible.length} órdenes visibles? Esta acción no se puede deshacer.`)) {
    const visibleIds = new Set(visible.map(o => o.id));
    AppState.orders = AppState.orders.filter(o => !visibleIds.has(o.id));
    saveData('orders');
    renderStats();
    renderOrdersTable();
    updatePortalCounts();
    showToast("Órdenes eliminadas con éxito", "warning");
  }
}

// ========================================================
// 13. GENERACIÓN DE EXCEL OFICIAL (.xlsx)
// ========================================================
function generateExcel() {
  const visible = getVisibleOrders();
  if (visible.length === 0) {
    showToast("⚠️ No hay órdenes registradas para exportar en esta agencia.", "warning");
    return;
  }

  showToast("⏳ Generando archivo oficial de Excel...", "info");

  const headers = [
    "PROVEEDOR",
    "NOMBRE",
    "SERVICIO",
    "DESCRIPCION DEL SERVICIO",
    "CONCEPTO",
    "CUENTA",
    "GRUPO DE COMPRA",
    "GERENCIA",
    "LIBERA",
    "CECO",
    "TOTAL"
  ];

  const rows = visible.map(order => [
    order.provider || order.clientId || "",
    order.name || order.clientName || "",
    order.service || "",
    order.serviceDescription || order.orderReason || "",
    order.concept || order.orderConcept || "",
    order.account || order.accountNumber || "",
    order.purchaseGroup || "",
    order.management || "",
    order.releasedBy || "",
    order.ceco || order.costCenter || "",
    order.total !== undefined ? order.total : (order.amount || 0)
  ]);

  const data = [headers, ...rows];
  const timestamp = new Date().toISOString().slice(0, 10);
  const agencyTag = AppState.currentSession ? `Agencia_${AppState.currentSession.agencyId}` : 'General';
  const companyTag = AppState.selectedCompany || 'General';
  const filename = `Reporte_${agencyTag}_${companyTag}_${timestamp}.xlsx`;

  if (typeof XLSX !== 'undefined') {
    try {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(data);

      const colWidths = headers.map((header, colIdx) => {
        let maxLen = header.length;
        rows.forEach(row => {
          const val = row[colIdx] ? String(row[colIdx]) : "";
          if (val.length > maxLen) maxLen = val.length;
        });
        return { wch: Math.min(Math.max(maxLen + 4, 14), 50) };
      });
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, "Órdenes de Servicio");
      XLSX.writeFile(wb, filename);

      const exportedCount = visible.length;
      const visibleIds = new Set(visible.map(o => o.id));

      AppState.orders = AppState.orders.filter(o => !visibleIds.has(o.id));
      saveData('orders');
      renderStats();
      renderOrdersTable();
      updatePortalCounts();

      showToast(`🎉 ¡Excel descargado con éxito! Se exportaron y limpiaron ${exportedCount} registros.`, "success");
      return;
    } catch (err) {
      console.warn("Fallo en XLSX, usando contingencia CSV:", err);
    }
  }

  fallbackExportCsv(data, visible);
}

function fallbackExportCsv(data, visible) {
  let csvContent = "\uFEFF";
  data.forEach(row => {
    const formattedRow = row.map(item => {
      const str = String(item ?? "").replace(/"/g, '""');
      return `"${str}"`;
    });
    csvContent += formattedRow.join(";") + "\r\n";
  });

  const exportedCount = visible.length;
  const visibleIds = new Set(visible.map(o => o.id));
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const timestamp = new Date().toISOString().slice(0, 10);
  const agencyTag = AppState.currentSession ? `Agencia_${AppState.currentSession.agencyId}` : 'General';
  const companyTag = AppState.selectedCompany || 'General';
  a.href = url;
  a.download = `Reporte_${agencyTag}_${companyTag}_${timestamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  AppState.orders = AppState.orders.filter(o => !visibleIds.has(o.id));
  saveData('orders');
  renderStats();
  renderOrdersTable();
  updatePortalCounts();

  showToast(`📁 Archivo CSV descargado (${exportedCount} registros).`, "success");
}

// ========================================================
// 14. MODAL DE AUDITORÍA DE CONEXIONES (ADMIN)
// ========================================================
async function openAuditModal() {
  dom.auditModal.classList.add('open');
  renderAuditTable();
  await refreshAuditFromCloud();
}

function closeAuditModal() {
  dom.auditModal.classList.remove('open');
}

async function refreshAuditFromCloud() {
  const cloudLogs = await CloudSync.fetchAuditLogs();
  if (cloudLogs !== null) {
    updateCloudStatusUI(true);
    if (cloudLogs.length > 0) {
      AppState.auditLogs = [...cloudLogs];
      saveData('auditLogs');
      renderAuditTable();
    }
  } else {
    updateCloudStatusUI(false);
  }
}

function updateCloudStatusUI(isConnected) {
  if (!dom.cloudStatusDot) return;
  const currentUrl = CloudSync.getDbUrl();
  const isGoogle = currentUrl.includes('script.google.com');

  if (isConnected || (currentUrl && isGoogle)) {
    dom.cloudStatusDot.textContent = '🟢';
    dom.cloudStatusText.textContent = isGoogle
      ? 'Sincronización Activa: Hoja de Excel (Google Sheets)'
      : 'Sincronización en la Nube Activa';
    dom.cloudStatusBanner.style.background = 'rgba(16, 185, 129, 0.1)';
    dom.cloudStatusBanner.style.borderColor = 'rgba(16, 185, 129, 0.3)';
  } else {
    dom.cloudStatusDot.textContent = '🟡';
    dom.cloudStatusText.textContent = 'Modo Local (Conecta Google Sheets para registrar conexiones de teléfonos)';
    dom.cloudStatusBanner.style.background = 'rgba(245, 158, 11, 0.1)';
    dom.cloudStatusBanner.style.borderColor = 'rgba(245, 158, 11, 0.3)';
  }
}

function exportAuditExcel() {
  if (AppState.auditLogs.length === 0) {
    showToast("⚠️ No hay registros de conexiones para exportar a Excel.", "warning");
    return;
  }

  showToast("⏳ Generando archivo oficial de Excel con el registro de conexiones...", "info");

  const headers = [
    "#",
    "USUARIO",
    "ID AGENCIA",
    "NOMBRE DE AGENCIA",
    "ROL",
    "FECHA DE CONEXION",
    "HORA DE CONEXION",
    "DISPOSITIVO",
    "ESTADO"
  ];

  const rows = AppState.auditLogs.map((log, index) => [
    AppState.auditLogs.length - index,
    log.user || "",
    log.agencyId !== undefined ? log.agencyId : "",
    log.agencyName || "",
    log.role || "",
    log.date || "",
    log.time || "",
    log.device || "Conectado",
    log.status || "Conectado Exitosamente"
  ]);

  const data = [headers, ...rows];
  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `Registro_Conexiones_${timestamp}.xlsx`;

  if (typeof XLSX !== 'undefined') {
    try {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!cols'] = [
        { wch: 6 },
        { wch: 18 },
        { wch: 14 },
        { wch: 28 },
        { wch: 20 },
        { wch: 18 },
        { wch: 16 },
        { wch: 20 },
        { wch: 24 }
      ];
      XLSX.utils.book_append_sheet(wb, ws, "Conexiones Agencias");
      XLSX.writeFile(wb, filename);
      showToast(`🎉 ¡Excel de conexiones descargado con éxito! (${rows.length} registros)`, "success");
      return;
    } catch (err) {
      console.warn("Fallo en XLSX, usando contingencia CSV:", err);
    }
  }

  // Contingencia CSV
  let csvContent = "\uFEFF";
  data.forEach(row => {
    const formattedRow = row.map(item => `"${String(item ?? "").replace(/"/g, '""')}"`);
    csvContent += formattedRow.join(";") + "\r\n";
  });
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Registro_Conexiones_${timestamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`📁 Registro de conexiones descargado como CSV (${rows.length} registros).`, "success");
}

function renderAuditTable() {
  let logs = [...AppState.auditLogs];

  if (AppState.auditSearchQuery) {
    const q = AppState.auditSearchQuery;
    logs = logs.filter(l => 
      l.user.toLowerCase().includes(q) ||
      l.agencyName.toLowerCase().includes(q) ||
      String(l.agencyId).includes(q) ||
      l.role.toLowerCase().includes(q) ||
      l.date.includes(q) ||
      l.time.includes(q)
    );
  }

  const todayStr = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const totalLogs = AppState.auditLogs.length;
  const todayLogs = AppState.auditLogs.filter(l => l.date === todayStr).length;
  const uniqueAgencies = new Set(AppState.auditLogs.map(l => l.agencyId)).size;

  dom.auditStatTotal.textContent = totalLogs;
  dom.auditStatToday.textContent = todayLogs;
  dom.auditStatAgencies.textContent = uniqueAgencies;

  if (logs.length === 0) {
    dom.auditTableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 24px;">No hay registros de conexión.</td></tr>`;
    return;
  }

  dom.auditTableBody.innerHTML = logs.map((log, index) => `
    <tr>
      <td><span style="font-family: monospace; color: var(--text-dim);">${logs.length - index}</span></td>
      <td><strong>${escapeHtml(log.user)}</strong></td>
      <td><span style="font-family: monospace; font-weight: 700; color: #60a5fa;">${log.agencyId === 0 ? '-' : log.agencyId}</span></td>
      <td>${escapeHtml(log.agencyName)}</td>
      <td><span class="badge-corp ${log.role.includes('Admin') ? 'ccn' : 'cdn'}">${escapeHtml(log.role)}</span></td>
      <td>${log.date}</td>
      <td><strong style="color: #10b981; font-family: monospace;">${log.time}</strong></td>
      <td><span style="font-size: 0.74rem; color: #10b981;">🟢 ${escapeHtml(log.device || 'Conectado')}</span></td>
    </tr>
  `).join('');
}

function confirmClearAuditLogs() {
  if (AppState.auditLogs.length === 0) {
    showToast("La bitácora ya está vacía", "info");
    return;
  }
  if (confirm("¿Desea vaciar la bitácora de conexiones?")) {
    AppState.auditLogs = [];
    saveData('auditLogs');
    renderAuditTable();
    showToast("Bitácora de conexiones vaciada.", "warning");
  }
}

// Monitoreo en tiempo real para el Administrador (Detecta cuando un teléfono entra)
let realtimeAdminTimer = null;
function startAdminRealtimeMonitoring() {
  if (realtimeAdminTimer) clearInterval(realtimeAdminTimer);
  realtimeAdminTimer = setInterval(async () => {
    if (AppState.currentSession && AppState.currentSession.role === 'admin') {
      const cloudLogs = await CloudSync.fetchAuditLogs();
      if (cloudLogs && cloudLogs.length > 0) {
        const prevCount = AppState.auditLogs.length;
        if (cloudLogs.length > prevCount) {
          const newest = cloudLogs[0];
          AppState.auditLogs = [...cloudLogs];
          saveData('auditLogs');
          renderAuditTable();
          showToast(`🔔 <strong>Nueva conexión detectada:</strong> ${newest.agencyName} (${newest.device}) a las ${newest.time}`, "info");
        }
      }
    }
  }, 7000);
}

// ========================================================
// 15. GESTOR DE CATÁLOGOS
// ========================================================
// 15. GESTOR DE CATÁLOGOS (EXCLUSIVO ADMINISTRADOR)
// ========================================================
function openCatalogModal() {
  if (!AppState.currentSession || AppState.currentSession.role !== 'admin') {
    showToast("⛔ Acceso restringido: Solo el Administrador Central puede gestionar los catálogos.", "error");
    return;
  }
  renderCatalogTables();
  dom.catalogModal.classList.add('open');
}

function closeCatalogModal() {
  dom.catalogModal.classList.remove('open');
  populateDropdowns();
}

function renderCatalogTables() {
  if (!AppState.currentSession || AppState.currentSession.role !== 'admin') return;

  const filterAg = dom.catalogAgencyFilter ? dom.catalogAgencyFilter.value : 'all';

  let displayClients = [...AppState.clients];
  if (filterAg !== 'all') {
    const agId = parseInt(filterAg, 10);
    displayClients = displayClients.filter(c => c.agencyId === agId);
  }

  dom.catalogClientsTable.innerHTML = displayClients.map(c => {
    const agObj = AGENCIES_CATALOG.find(a => a.id === c.agencyId);
    const agName = agObj ? agObj.name : `Agencia ${c.agencyId}`;
    return `
      <tr>
        <td><strong style="color:#60a5fa; font-family: monospace;">${escapeHtml(c.id)}</strong></td>
        <td>${escapeHtml(c.name)}</td>
        <td><span style="font-size:0.78rem; font-weight:600; color:#10b981; background:rgba(16,185,129,0.1); padding:2px 8px; border-radius:4px;">🏢 ${escapeHtml(agName)}</span></td>
        <td style="text-align:right">
          <button class="btn btn-outline btn-sm" onclick="removeClientFromCatalog('${escapeHtml(c.id)}', ${c.agencyId})" style="color:#f43f5e; padding:2px 8px;" title="Eliminar proveedor">✕</button>
        </td>
      </tr>
    `;
  }).join('');

  dom.catalogReasonsTable.innerHTML = AppState.reasons.map((r, i) => `
    <tr>
      <td>${escapeHtml(r.reason)}</td>
      <td><strong style="font-family:monospace">${escapeHtml(r.account)}</strong></td>
      <td style="text-align:right">
        <button class="btn btn-outline btn-sm" onclick="removeReasonFromCatalog(${i})" style="color:#f43f5e; padding:2px 8px;" title="Eliminar servicio">✕</button>
      </td>
    </tr>
  `).join('');

  dom.catalogApproversTable.innerHTML = AppState.approvers.map((app, i) => `
    <tr>
      <td><span style="color:#a78bfa; font-weight:600;">${escapeHtml(app.name)}</span></td>
      <td><strong style="color:#60a5fa; font-family: monospace;">${escapeHtml(app.costCenter || '')}</strong></td>
      <td style="text-align:right">
        <button class="btn btn-outline btn-sm" onclick="removeApproverFromCatalog(${i})" style="color:#f43f5e; padding:2px 8px;" title="Eliminar liberador">✕</button>
      </td>
    </tr>
  `).join('');
}

function addClientToCatalog() {
  if (!AppState.currentSession || AppState.currentSession.role !== 'admin') {
    showToast("⛔ Solo el Administrador puede agregar y asignar proveedores.", "error");
    return;
  }

  const id = dom.newClientId.value.trim();
  const name = dom.newClientName.value.trim();
  const agencyId = dom.newClientAgency ? parseInt(dom.newClientAgency.value, 10) : NaN;

  if (!id || !name) {
    showToast("⚠️ Ingrese el código de PROVEEDOR y su NOMBRE", "warning");
    return;
  }

  if (isNaN(agencyId)) {
    showToast("⚠️ Seleccione a qué Agencia desea asignar este proveedor", "warning");
    if (dom.newClientAgency) dom.newClientAgency.focus();
    return;
  }

  const exists = AppState.clients.some(c => String(c.id) === id && c.agencyId === agencyId);
  if (exists) {
    showToast(`⚠️ El proveedor con código ${id} ya existe asignado a esa agencia`, "warning");
    return;
  }

  const agObj = AGENCIES_CATALOG.find(a => a.id === agencyId);
  const agName = agObj ? agObj.name : `Agencia ${agencyId}`;

  AppState.clients.push({ id, name, agencyId });
  saveData('clients');
  dom.newClientId.value = '';
  dom.newClientName.value = '';
  if (dom.newClientAgency) dom.newClientAgency.selectedIndex = 0;

  renderCatalogTables();
  populateDropdowns();
  showToast(`🎉 Proveedor <strong>${id} - ${escapeHtml(name)}</strong> asignado a <strong>${escapeHtml(agName)}</strong>`, "success");
}

window.removeClientFromCatalog = function(clientId, agencyId) {
  if (!AppState.currentSession || AppState.currentSession.role !== 'admin') {
    showToast("⛔ Solo el Administrador puede eliminar proveedores.", "error");
    return;
  }
  const index = AppState.clients.findIndex(c => String(c.id) === String(clientId) && c.agencyId === Number(agencyId));
  if (index !== -1) {
    AppState.clients.splice(index, 1);
    saveData('clients');
    renderCatalogTables();
    populateDropdowns();
    showToast("Proveedor eliminado del catálogo de la agencia.", "info");
  }
};

function addReasonToCatalog() {
  if (!AppState.currentSession || AppState.currentSession.role !== 'admin') {
    showToast("⛔ Solo el Administrador puede modificar los servicios.", "error");
    return;
  }
  const reason = dom.newReason.value.trim();
  const account = dom.newAccount.value.trim().toUpperCase();
  if (!reason || !account) {
    showToast("Ingrese la DESCRIPCION DEL SERVICIO y la CUENTA contable", "warning");
    return;
  }
  AppState.reasons.push({ reason, account });
  saveData('reasons');
  dom.newReason.value = '';
  dom.newAccount.value = '';
  renderCatalogTables();
  populateDropdowns();
  showToast("Servicio y Cuenta agregados al catálogo", "success");
}

window.removeReasonFromCatalog = function(index) {
  if (!AppState.currentSession || AppState.currentSession.role !== 'admin') {
    showToast("⛔ Solo el Administrador puede eliminar servicios.", "error");
    return;
  }
  AppState.reasons.splice(index, 1);
  saveData('reasons');
  renderCatalogTables();
  populateDropdowns();
  showToast("Servicio eliminado del catálogo", "info");
};

function addApproverToCatalog() {
  if (!AppState.currentSession || AppState.currentSession.role !== 'admin') {
    showToast("⛔ Solo el Administrador puede agregar supervisores.", "error");
    return;
  }
  const name = dom.newApproverName.value.trim();
  const costCenter = dom.newApproverCostCenter.value.trim();
  if (!name || !costCenter) {
    showToast("Ingrese el nombre de quien LIBERA y su CECO (solo números)", "warning");
    return;
  }
  if (!/^\d+$/.test(costCenter)) {
    showToast("El CECO debe contener solo números (ej: 700720056)", "warning");
    return;
  }
  AppState.approvers.push({ name, costCenter });
  saveData('approvers');
  dom.newApproverName.value = '';
  dom.newApproverCostCenter.value = '';
  renderCatalogTables();
  populateDropdowns();
  showToast("Liberador y CECO agregados al catálogo", "success");
}

window.removeApproverFromCatalog = function(index) {
  if (!AppState.currentSession || AppState.currentSession.role !== 'admin') {
    showToast("⛔ Solo el Administrador puede eliminar supervisores.", "error");
    return;
  }
  AppState.approvers.splice(index, 1);
  saveData('approvers');
  renderCatalogTables();
  populateDropdowns();
  showToast("Liberador eliminado de la lista", "info");
};

// ========================================================
// 16. TEMA Y UTILIDADES
// ========================================================
function setTheme(theme) {
  AppState.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('cdn_ccn_theme', theme);
  const label = theme === 'dark' ? '☀️ Modo Claro' : '🌙 Modo Oscuro';
  dom.btnToggleTheme.textContent = label;
  dom.portalBtnToggleTheme.textContent = label;
  dom.loginBtnToggleTheme.textContent = label;
}

function toggleTheme() {
  const nextTheme = AppState.theme === 'dark' ? 'light' : 'dark';
  setTheme(nextTheme);
}

function showToast(message, type = "info") {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = message;
  dom.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
