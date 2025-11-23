// frontend/src/printing/pos58Printer.js

// Check if WebUSB is available
export function isWebUsbSupported() {
  return typeof navigator !== "undefined" && "usb" in navigator;
}

// Show all USB devices (adjust with filters when you know vendor/product IDs)
const USB_FILTERS = [{}];

let device = null;
let interfaceNumber = 0;
let endpointNumber = 1;

async function openDevice(selectedDevice) {
  device = selectedDevice;

  if (!device.opened) {
    await device.open();
  }

  if (device.configuration == null) {
    await device.selectConfiguration(1);
  }

  const config = device.configuration;
  console.log("USB configuration:", config);

  // Find a bulk OUT endpoint dynamically
  outer: for (const iface of config.interfaces) {
    for (const alt of iface.alternates) {
      if (!alt.endpoints) continue;
      for (const ep of alt.endpoints) {
        if (ep.direction === "out" && ep.type === "bulk") {
          interfaceNumber = iface.interfaceNumber;
          endpointNumber = ep.endpointNumber;
          break outer;
        }
      }
    }
  }

  console.log("Using interface", interfaceNumber, "endpoint", endpointNumber);

  await device.claimInterface(interfaceNumber);
}

async function sendRaw(data) {
  if (!device) {
    throw new Error("Printer not connected");
  }
  return device.transferOut(endpointNumber, data);
}

// Public: ask user to pick a USB device and connect
export async function connectPrinter() {
  if (!isWebUsbSupported()) {
    throw new Error(
      "WebUSB is not supported. Use Chrome or Edge on desktop over HTTPS/localhost."
    );
  }

  const selectedDevice = await navigator.usb.requestDevice({
    filters: USB_FILTERS,
  });

  console.log("Selected USB device:", {
    productName: selectedDevice.productName,
    manufacturerName: selectedDevice.manufacturerName,
    vendorId: selectedDevice.vendorId.toString(16),
    productId: selectedDevice.productId.toString(16),
  });

  await openDevice(selectedDevice);
  return selectedDevice;
}

// ---------- ESC/POS helpers ----------

function escInit() {
  return Uint8Array.from([0x1b, 0x40]); // ESC @
}

function escNewLine() {
  return Uint8Array.from([0x0a]); // LF
}

function escFullCut() {
  // Many 58mm printers just feed if they don't have a cutter
  return Uint8Array.from([0x1d, 0x56, 0x41, 0x10]); // GS V A n
}

function concatArrays(...arrays) {
  const length = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

function encodeText(text) {
  const safeText = text.replace(/₱/g, "PHP ");
  return new TextEncoder().encode(safeText);
}

// Typical 58mm default font width
const LINE_WIDTH = 32;

function padCenter(text, width = LINE_WIDTH) {
  const len = text.length;
  if (len >= width) return text.slice(0, width);
  const left = Math.floor((width - len) / 2);
  const right = width - len - left;
  return " ".repeat(left) + text + " ".repeat(right);
}

function lineSeparator() {
  return "-".repeat(LINE_WIDTH);
}

// ---------- Receipt builders ----------

export function buildGarmentReceipt(payload) {
  const { date, customerName, course, items = [], total } = payload;

  const lines = [];

  lines.push(padCenter("USTP DISPLAY CENTER"));
  lines.push(padCenter("GARMENT ORDER SLIP"));
  lines.push(lineSeparator());

  lines.push("Document Code: FM-USTP-ED-018");
  if (date) lines.push(`Date: ${date}`);
  lines.push("");

  if (customerName) lines.push(`Name : ${customerName}`);
  if (course) lines.push(`Course: ${course}`);
  lines.push("");
  lines.push("OR#: ________________");

  lines.push(lineSeparator());

  if (items.length > 0) {
    items.forEach((item) => {
      const name = item.name || "";
      const qty = Number(item.qty) || 0;
      const price = Number(item.price) || 0;

      lines.push(name);

      const qtyPart = ` x${qty}`;
      const amountPart = `PHP ${price.toFixed(2)}`;
      const spaces = Math.max(
        LINE_WIDTH - qtyPart.length - amountPart.length,
        1
      );
      lines.push(" ".repeat(spaces) + qtyPart + amountPart);
    });
  }

  lines.push(lineSeparator());

  if (typeof total === "number" && !Number.isNaN(total)) {
    const label = "TOTAL:";
    const value = `PHP ${total.toFixed(2)}`;
    const spaces = Math.max(LINE_WIDTH - label.length - value.length, 1);
    lines.push(label + " ".repeat(spaces) + value);
  }

  lines.push(lineSeparator());
  lines.push(padCenter("Thank you!"));
  lines.push("");
  lines.push("");

  return lines.join("\n");
}

export function buildBookReceipt(payload) {
  const { date, customerName, course, items = [], total } = payload;

  const lines = [];

  lines.push(padCenter("USTP DISPLAY CENTER"));
  lines.push(padCenter("BOOK ORDER SLIP"));
  lines.push(lineSeparator());

  lines.push("Document Code: FM-USTP-ED-001");
  if (date) lines.push(`Date: ${date}`);
  lines.push("");

  if (customerName) lines.push(`Name : ${customerName}`);
  if (course) lines.push(`Course: ${course}`);
  lines.push("");
  lines.push("OR#: ________________");

  lines.push(lineSeparator());

  if (items.length > 0) {
    items.forEach((item) => {
      const name = item.name || "";
      const qty = Number(item.qty) || 0;
      const price = Number(item.price) || 0;

      lines.push(name);

      const qtyPart = ` x${qty}`;
      const amountPart = `PHP ${price.toFixed(2)}`;
      const spaces = Math.max(
        LINE_WIDTH - qtyPart.length - amountPart.length,
        1
      );
      lines.push(" ".repeat(spaces) + qtyPart + amountPart);
    });
  }

  lines.push(lineSeparator());

  if (typeof total === "number" && !Number.isNaN(total)) {
    const label = "TOTAL:";
    const value = `PHP ${total.toFixed(2)}`;
    const spaces = Math.max(LINE_WIDTH - label.length - value.length, 1);
    lines.push(label + " ".repeat(spaces) + value);
  }

  lines.push(lineSeparator());
  lines.push(padCenter("Thank you!"));
  lines.push("");
  lines.push("");

  return lines.join("\n");
}

// ---------- Print helpers ----------

export async function printGarmentReceipt(payload) {
  const text = buildGarmentReceipt(payload);
  const init = escInit();
  const body = encodeText(text);
  const lf = escNewLine();
  const cut = escFullCut();

  const data = concatArrays(init, body, lf, lf, cut);
  console.log("Sending bytes to printer (garment):", data);

  await sendRaw(data);
}

export async function printBookReceipt(payload) {
  const text = buildBookReceipt(payload);
  const init = escInit();
  const body = encodeText(text);
  const lf = escNewLine();
  const cut = escFullCut();

  const data = concatArrays(init, body, lf, lf, cut);
  console.log("Sending bytes to printer (book):", data);

  await sendRaw(data);
}
