class KeymapRenderer {
  static render(name, version, sections) {
    push();
    fill(0, 220);
    noStroke();
    rect(0, 0, width, height);

    fill(255);
    textAlign(LEFT, TOP);
    const x = 50;
    let y = 50;
    const lh = 26;

    textSize(24);
    text(`${name} ${version} Keymap Reference`, x, y);

    y += 48;
    textSize(14);

    const colW = (width - 100) / 2;

    let col = 0;
    let cx = x;
    let cy = y;

    for (const section of sections) {
      if (cy + (section.entries.length + 2) * lh > height - 30 && col === 0) {
        col = 1;
        cx = x + colW;
        cy = y;
      }

      fill(180, 220, 255);
      textSize(13);
      text(section.title.toUpperCase(), cx, cy);
      cy += lh - 4;

      stroke(255, 40);
      line(cx, cy, cx + colW - 20, cy);
      noStroke();
      cy += 8;

      for (const [k, desc] of section.entries) {
        fill(255);
        textSize(13);
        text(k, cx, cy);
        fill(200);
        text(desc, cx + 130, cy);
        cy += lh;
      }

      cy += 14;
    }

    fill(120);
    textSize(11);
    textAlign(CENTER, BOTTOM);
    text("Press # to close", width / 2, height - 16);

    pop();
  }
}
