class RLECodec {
  static parse(rleString) {
    return this._parseGridRows(rleString, 8192, 8192);
  }

  static decode(rleString, width, height = width) {
    const outWidth = Number(width) > 0 ? Number(width) : 0;
    const outHeight = Number(height) > 0 ? Number(height) : outWidth;
    const total = outWidth * outHeight;
    const decoded = new Float32Array(Math.max(0, total));

    if (!rleString || total <= 0) {
      return decoded;
    }

    const normalised = this._normaliseInput(rleString);
    const rows = this._parseGridRows(normalised, outWidth, outHeight);

    if (!normalised.includes("$") && rows.length > 0) {
      const flat = rows[0];
      for (let i = 0; i < Math.min(flat.length, total); i++) {
        decoded[i] = flat[i];
      }
      return decoded;
    }

    for (let y = 0; y < Math.min(rows.length, outHeight); y++) {
      const row = rows[y] || [];
      for (let x = 0; x < Math.min(row.length, outWidth); x++) {
        decoded[y * outWidth + x] = row[x];
      }
    }

    return decoded;
  }

  static encode(values, width, height = width) {
    const outWidth = Number(width) > 0 ? Number(width) : 0;
    const outHeight = Number(height) > 0 ? Number(height) : outWidth;
    if (!values || outWidth <= 0 || outHeight <= 0) return "!";

    const rows = [];
    for (let y = 0; y < outHeight; y++) {
      let line = "";
      let runCount = 0;
      let runToken = "";

      for (let x = 0; x < outWidth; x++) {
        const idx = y * outWidth + x;
        const raw = Number(values[idx]) || 0;
        const byte = Math.max(0, Math.min(255, Math.round(raw * 255)));
        const token = this._byteToToken(byte);

        if (runCount === 0) {
          runToken = token;
          runCount = 1;
        } else if (token === runToken) {
          runCount++;
        } else {
          line += this._formatRun(runCount, runToken);
          runToken = token;
          runCount = 1;
        }
      }

      if (runCount > 0) {
        line += this._formatRun(runCount, runToken);
      }

      rows.push(line);
    }

    return `${rows.join("$")}!`;
  }

  static parseFraction(str) {
    const parts = String(str).split("/");
    return parts.length === 1
      ? parseFloat(parts[0])
      : parseFloat(parts[0]) / parseFloat(parts[1]);
  }

  static encodeByteArray(bytes) {
    if (!bytes || typeof bytes.length !== "number") return "!";

    let out = "";
    let runToken = "";
    let runCount = 0;

    for (let i = 0; i < bytes.length; i++) {
      const token = this._byteToToken(Number(bytes[i]) & 255);
      if (runCount === 0) {
        runToken = token;
        runCount = 1;
      } else if (token === runToken) {
        runCount++;
      } else {
        out += this._formatRun(runCount, runToken);
        runToken = token;
        runCount = 1;
      }
    }

    if (runCount > 0) out += this._formatRun(runCount, runToken);
    return `${out}!`;
  }

  static decodeByteArray(rleString, expectedLength) {
    const length = Number(expectedLength) || 0;
    const out = new Uint8Array(Math.max(0, length));
    if (!rleString || length <= 0) return out;

    const input = this._normaliseInput(rleString);
    let outIndex = 0;

    for (let i = 0; i < input.length && outIndex < length; ) {
      let count = 0;
      while (i < input.length) {
        const code = input.charCodeAt(i);
        if (code >= 48 && code <= 57) {
          count = count * 10 + (code - 48);
          i++;
          continue;
        }
        break;
      }

      if (i >= input.length) break;
      const ch = input[i];
      if (ch === "!") break;
      if (ch === "$") {
        i++;
        continue;
      }

      const tokenInfo = this._readToken(input, i);
      if (!tokenInfo) {
        i++;
        continue;
      }

      const byte = this._tokenToByte(tokenInfo.token);
      const run = count > 0 ? count : 1;
      for (let k = 0; k < run && outIndex < length; k++) {
        out[outIndex++] = byte;
      }

      i = tokenInfo.nextIndex;
    }

    return out;
  }

  static encodeFloat32Array(values) {
    if (!(values instanceof Float32Array)) {
      throw new Error("[Lenia] encodeFloat32Array expects Float32Array");
    }

    const bytes = new Uint8Array(
      values.buffer,
      values.byteOffset,
      values.byteLength,
    );
    return this.encodeByteArray(bytes);
  }

  static decodeFloat32Array(rleString, floatLength) {
    const length = Number(floatLength) || 0;
    if (length <= 0) return new Float32Array(0);

    const byteLength = length * 4;
    const decoded = this.decodeByteArray(rleString, byteLength);
    const copy = new Uint8Array(byteLength);
    copy.set(decoded);
    return new Float32Array(copy.buffer);
  }

  static _parseGridRows(rleString, maxWidth = Infinity, maxRows = Infinity) {
    const rows = [[]];
    const input = this._normaliseInput(rleString);
    let rowIndex = 0;

    const widthCap =
      Number.isFinite(Number(maxWidth)) && Number(maxWidth) > 0
        ? Math.floor(Number(maxWidth))
        : Infinity;
    const rowCap =
      Number.isFinite(Number(maxRows)) && Number(maxRows) > 0
        ? Math.floor(Number(maxRows))
        : Infinity;

    for (let i = 0; i < input.length; ) {
      let count = 0;
      while (i < input.length) {
        const code = input.charCodeAt(i);
        if (code >= 48 && code <= 57) {
          count = count * 10 + (code - 48);
          i++;
          continue;
        }
        break;
      }

      if (i >= input.length) break;
      const ch = input[i];

      if (ch === "!") break;

      if (ch === "$") {
        const lineBreaks = count > 0 ? count : 1;
        for (let k = 0; k < lineBreaks; k++) {
          if (rows.length >= rowCap) break;
          rows.push([]);
          rowIndex++;
        }
        i++;
        continue;
      }

      const tokenInfo = this._readToken(input, i);
      if (!tokenInfo) {
        i++;
        continue;
      }

      const runCount = count > 0 ? count : 1;
      const value = this._tokenToValue(tokenInfo.token);
      const row = rows[rowIndex];

      const remaining =
        widthCap === Infinity ? runCount : Math.max(0, widthCap - row.length);
      const appendCount = Math.min(runCount, remaining);
      for (let k = 0; k < appendCount; k++) {
        row.push(value);
      }

      i = tokenInfo.nextIndex;
    }

    if (rows.length === 0) return [[]];
    const observedMax = rows.reduce((max, row) => Math.max(max, row.length), 0);
    const maxLen =
      widthCap === Infinity ? observedMax : Math.min(observedMax, widthCap);
    return rows.map((row) => {
      const padded = row.slice();
      if (padded.length > maxLen) {
        padded.length = maxLen;
      }
      while (padded.length < maxLen) padded.push(0);
      return padded;
    });
  }

  static _normaliseInput(rleString) {
    return String(rleString || "")
      .split(/\r?\n/)
      .filter((line) => {
        const trimmed = line.trim();
        if (!trimmed) return false;
        if (trimmed.startsWith("#")) return false;
        if (/^x\s*=/.test(trimmed)) return false;
        return true;
      })
      .join("")
      .replace(/\s+/g, "");
  }

  static _readToken(input, index) {
    const ch = input[index];
    if (ch === "." || ch === "b" || ch === "o" || (ch >= "A" && ch <= "X")) {
      return { token: ch, nextIndex: index + 1 };
    }

    if (ch >= "p" && ch <= "y" && index + 1 < input.length) {
      const next = input[index + 1];
      if (next >= "A" && next <= "X") {
        return { token: ch + next, nextIndex: index + 2 };
      }
    }

    return null;
  }

  static _tokenToValue(token) {
    return this._decodeTokenToByte(token) / 255;
  }

  static _tokenToByte(token) {
    return this._decodeTokenToByte(token);
  }

  static _decodeTokenToByte(token) {
    if (token === "." || token === "b") return 0;
    if (token === "o") return 255;

    let byte = 0;
    if (token.length === 1 && token >= "A" && token <= "X") {
      byte = token.charCodeAt(0) - 65 + 1;
    } else if (token.length === 2) {
      byte = (token.charCodeAt(0) - 112) * 24 + (token.charCodeAt(1) - 65 + 25);
    }

    return Math.max(0, Math.min(255, byte));
  }

  static _byteToToken(byte) {
    if (byte <= 0) return ".";
    if (byte >= 255) return "o";
    if (byte < 25) return String.fromCharCode(65 + byte - 1);

    const offset = byte - 25;
    return (
      String.fromCharCode(112 + Math.floor(offset / 24)) +
      String.fromCharCode(65 + (offset % 24))
    );
  }

  static _formatRun(count, token) {
    return `${count > 1 ? count : ""}${token}`;
  }

  static parseND(rleString) {
    const input = this._normaliseInput(rleString);
    const wParts = input.split("#");

    if (wParts.length === 1) {
      const zParts = input.split("%");
      if (zParts.length === 1) {
        return [{ z: 0, w: 0, grid: this._parseGridRows(input) }];
      }
    }

    const slices = [];

    for (let wi = 0; wi < wParts.length; wi++) {
      const wStr = wParts[wi];
      if (!wStr || wStr === "!") continue;

      const zParts = wStr.split("%");
      for (let zi = 0; zi < zParts.length; zi++) {
        let zStr = zParts[zi];
        if (!zStr) continue;
        if (zStr.endsWith("!")) zStr = zStr.slice(0, -1);
        if (!zStr) continue;

        const grid = this._parseGridRows(zStr);
        if (grid.length > 0 && grid[0].length > 0) {
          slices.push({ z: zi, w: wi, grid });
        }
      }
    }

    if (slices.length === 0) {
      return [{ z: 0, w: 0, grid: this._parseGridRows(input) }];
    }

    return slices;
  }
}
