class RLECodec {
  static parse(rleString) {
    return this._parseGridRows(rleString);
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
    const rows = this._parseGridRows(normalised);

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

  static _parseGridRows(rleString) {
    const rows = [[]];
    const input = this._normaliseInput(rleString);
    let rowIndex = 0;

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
      for (let k = 0; k < runCount; k++) {
        row.push(value);
      }

      i = tokenInfo.nextIndex;
    }

    if (rows.length === 0) return [[]];
    const maxLen = rows.reduce((max, row) => Math.max(max, row.length), 0);
    return rows.map((row) => {
      const padded = row.slice();
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
    if (token === "." || token === "b") return 0;
    if (token === "o") return 1;

    let byte = 0;
    if (token.length === 1 && token >= "A" && token <= "X") {
      byte = token.charCodeAt(0) - 65 + 1;
    } else if (token.length === 2) {
      byte = (token.charCodeAt(0) - 112) * 24 + (token.charCodeAt(1) - 65 + 25);
    }

    byte = Math.max(0, Math.min(255, byte));
    return byte / 255;
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
}
