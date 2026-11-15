/**
 * SaleSphere CRM — Google Apps Script Drive & PDF Storage Microservice
 * 
 * Deploy this script as a Web App in Google Apps Script (https://script.google.com):
 * 1. Click "New Project" and paste this code into Code.gs
 * 2. Click "Deploy" > "New deployment"
 * 3. Select type: "Web app"
 * 4. Execute as: "Me" (your Google account)
 * 5. Who has access: "Anyone" (secured with SHARED_SECRET header/token)
 * 6. Copy the Web App URL and set it in SaleSphere backend environment:
 *    GOOGLE_APPSCRIPT_URL="https://script.google.com/macros/s/.../exec"
 *    GOOGLE_APPSCRIPT_SECRET="your-strong-random-key"
 */

// Configure your shared secret key for authenticating API requests
var CONFIG = {
  SHARED_SECRET: "SaleSphere_Drive_Secret_2026",
  ROOT_FOLDER_NAME: "SaleSphere CRM Files",
  SUBFOLDERS: {
    quotes: "Quotations",
    invoices: "Invoices",
    payments: "Payment Receipts",
    leads: "Lead Attachments",
    customers: "Customer KYC & Docs"
  }
};

/**
 * Handles incoming POST requests from SaleSphere API
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ status: "error", message: "Missing request payload" }, 400);
    }

    var payload = JSON.parse(e.postData.contents);

    // Authentication check
    if (payload.secret !== CONFIG.SHARED_SECRET) {
      return jsonResponse({ status: "error", message: "Unauthorized access" }, 401);
    }

    var action = payload.action;

    switch (action) {
      case "uploadFile":
        return handleUploadFile(payload);

      case "generatePdf":
        return handleGeneratePdf(payload);

      case "deleteFile":
        return handleDeleteFile(payload);

      case "ping":
        return jsonResponse({ status: "ok", time: new Date().toISOString() });

      default:
        return jsonResponse({ status: "error", message: "Unknown action: " + action }, 400);
    }
  } catch (err) {
    return jsonResponse({
      status: "error",
      message: err.toString(),
      stack: err.stack
    }, 500);
  }
}

/**
 * Handles incoming GET health check
 */
function doGet(e) {
  return ContentService.createTextOutput("SaleSphere Google Apps Script Drive Microservice Active")
    .setMimeType(ContentService.MimeType.TEXT);
}

/**
 * Uploads a base64 encoded file into organized Google Drive folder
 * Payload:
 * {
 *   action: "uploadFile",
 *   folderType: "quotes" | "invoices" | "payments" | "leads" | "customers",
 *   fileName: "QT-2026-0001.pdf",
 *   mimeType: "application/pdf" | "image/jpeg" | "image/png",
 *   base64Data: "...",
 *   makePublic: false
 * }
 */
function handleUploadFile(payload) {
  var folder = getOrCreateFolder(payload.folderType);
  var bytes = Utilities.base64Decode(payload.base64Data);
  var blob = Utilities.newBlob(bytes, payload.mimeType || "application/octet-stream", payload.fileName);

  var file = folder.createFile(blob);
  
  if (payload.makePublic) {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  }

  return jsonResponse({
    status: "ok",
    fileId: file.getId(),
    fileName: file.getName(),
    sizeBytes: file.getSize(),
    mimeType: file.getMimeType(),
    viewUrl: file.getUrl(),
    downloadUrl: "https://drive.google.com/uc?export=download&id=" + file.getId()
  });
}

/**
 * Converts raw HTML into a styled PDF directly in Google Drive
 * Payload:
 * {
 *   action: "generatePdf",
 *   folderType: "quotes" | "invoices",
 *   fileName: "Quote_QT-0001.pdf",
 *   htmlContent: "<html>...</html>",
 *   makePublic: false
 * }
 */
function handleGeneratePdf(payload) {
  var folder = getOrCreateFolder(payload.folderType);
  var htmlBlob = Utilities.newBlob(payload.htmlContent, "text/html", "temp.html");
  var pdfBlob = htmlBlob.getAs("application/pdf").setName(payload.fileName || "document.pdf");

  var file = folder.createFile(pdfBlob);

  if (payload.makePublic) {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  }

  return jsonResponse({
    status: "ok",
    fileId: file.getId(),
    fileName: file.getName(),
    sizeBytes: file.getSize(),
    mimeType: "application/pdf",
    viewUrl: file.getUrl(),
    downloadUrl: "https://drive.google.com/uc?export=download&id=" + file.getId()
  });
}

/**
 * Deletes or trashes a file in Google Drive
 */
function handleDeleteFile(payload) {
  if (!payload.fileId) {
    return jsonResponse({ status: "error", message: "fileId required" }, 400);
  }

  var file = DriveApp.getFileById(payload.fileId);
  file.setTrashed(true);

  return jsonResponse({
    status: "ok",
    message: "File moved to trash",
    fileId: payload.fileId
  });
}

/**
 * Helper to get or create root and category folders
 */
function getOrCreateFolder(categoryKey) {
  var rootIterator = DriveApp.getFoldersByName(CONFIG.ROOT_FOLDER_NAME);
  var rootFolder;

  if (rootIterator.hasNext()) {
    rootFolder = rootIterator.next();
  } else {
    rootFolder = DriveApp.createFolder(CONFIG.ROOT_FOLDER_NAME);
  }

  var subName = CONFIG.SUBFOLDERS[categoryKey] || "General Attachments";
  var subIterator = rootFolder.getFoldersByName(subName);

  if (subIterator.hasNext()) {
    return subIterator.next();
  } else {
    return rootFolder.createFolder(subName);
  }
}

/**
 * Returns formatted JSON response
 */
function jsonResponse(data, statusCode) {
  var output = ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

