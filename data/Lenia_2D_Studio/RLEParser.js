
/**
 * @file RLEParser.js
 * @author @eanutt1272.v2
 * @version 1.0.0
 */
class RLEParser {
  static parse(rleString) {
    const cleanString = rleString.replace(/!$/, "");
    const grid = [];
    let currentPos = 0;

    while (currentPos < cleanString.length) {
      let lineEnd = cleanString.indexOf('$', currentPos);
      if (lineEnd === -1) lineEnd = cleanString.length;

      const lineContent = cleanString.substring(currentPos, lineEnd);
      const row = this._parseLine(lineContent);
      grid.push(row);

      currentPos = lineEnd + 1;

      while (currentPos < cleanString.length && cleanString[currentPos] === '$') {
        grid.push([]);
        currentPos++;
      }
    }

    return this._normaliseGrid(grid);
  }

  static _parseLine(line) {
    const row = [];
    let count = "";
    let modifier = "";

    for (const ch of line) {
      if (ch >= "0" && ch <= "9") {
        count += ch;
      } else if (ch >= "p" && ch <= "y") {
        modifier = ch;
      } else {
        const val = this._charToValue(modifier + ch);
        const n = count === "" ? 1 : parseInt(count);
        for (let i = 0; i < n; i++) row.push(val);
        modifier = "";
        count = "";
      }
    }
    return row;
  }

  static _charToValue(chars) {
    if (chars === "." || chars === "b" || chars === " .") return 0;
    if (chars === "o") return 1;

    if (chars.length === 1 && chars >= "A" && chars <= "X") {
      return (chars.charCodeAt(0) - "A".charCodeAt(0) + 1) / 255;
    }

    if (chars.length === 2) {
      const v = (chars.charCodeAt(0) - "p".charCodeAt(0)) * 24 +
      (chars.charCodeAt(1) - "A".charCodeAt(0) + 25);
      return v / 255;
    }

    return 0;
  }

  static _normaliseGrid(grid) {
    if (grid.length === 0) return [[]];
    const maxLen = Math.max(...grid.map(r => r.length));
    return grid.map(row => {
      while (row.length < maxLen) row.push(0);
      return row;
    });
  }

  static parseFraction(str) {
    const parts = str.split("/");
    return parts.length === 1 ? parseFloat(parts[0]) : parseFloat(parts[0]) / parseFloat(parts[1]);
  }
}