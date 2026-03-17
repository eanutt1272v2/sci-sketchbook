// @file  Neural_Network.pde
// @author @eanutt1272.v2
// @version 7.0.0
//
// v7 CHANGES
//  ─ Bento-box layout: grid+controls top-left | network diagram top-right
//    bottom strip split into Prediction | Statistics | Log panels
//  ─ Deduplication: each training sample is hashed; duplicate grids are
//    rejected at input time with a log warning
//  ─ Export filename stamped with date-time: nn_weights_YYYYMMDD_HHMMSS.json
//  ─ Prediction results, statistics, and log each in their own labelled box

import java.util.concurrent.*;
import java.util.HashSet;

// ─────────────────────────────────────────────────────────────
//  LAYOUT CONSTANTS  (all set in setup())
// ─────────────────────────────────────────────────────────────
int GRID_SIZE, CELL_SIZE;
int GRID_X, GRID_Y, GRID_PX;

// Left panel (controls column)
int LP_X, LP_W;

// Network diagram area
int NET_X0, NET_X1, NET_Y0, NET_Y1;

// Bottom strip
int BOT_Y, BOT_H;
int PRED_X, PRED_W;
int STATS_X, STATS_W;
int LOG_X, LOG_W;

int W, H;

// ─────────────────────────────────────────────────────────────
//  GLOBALS
// ─────────────────────────────────────────────────────────────
NeuralNetwork   nn;
Trainer         trainer;
Renderer        renderer;
UIState         ui;
AppLog          appLog;
Stats           stats;
ExecutorService executor;
float[][]       gridData;

// ─────────────────────────────────────────────────────────────
//  SETUP
// ─────────────────────────────────────────────────────────────
void setup() {
  size(1360, 900, P2D);
  frameRate(120);

  W = width; H = height;

  GRID_SIZE = 28;
  CELL_SIZE = 13;
  GRID_X    = 18;
  GRID_Y    = 52;
  GRID_PX   = GRID_SIZE * CELL_SIZE;   // 364

  LP_X = GRID_X;
  LP_W = GRID_PX;                      // 364

  // Network fills the space to the right of the left panel
  // down to the bottom strip
  int NET_MARGIN = 14;
  BOT_H  = 240;
  BOT_Y  = H - BOT_H - 10;

  NET_X0 = LP_X + LP_W + NET_MARGIN;
  NET_X1 = W - 12;
  NET_Y0 = 30;
  NET_Y1 = BOT_Y - 8;

  // Bottom strip: three equal panels
  int STRIP_X   = 10;
  int STRIP_W   = W - 20;
  int PANEL_GAP = 10;
  int panelW    = (STRIP_W - 2 * PANEL_GAP) / 3;

  PRED_X  = STRIP_X;
  PRED_W  = panelW;
  STATS_X = STRIP_X + panelW + PANEL_GAP;
  STATS_W = panelW;
  LOG_X   = STRIP_X + 2 * (panelW + PANEL_GAP);
  LOG_W   = STRIP_W - 2 * (panelW + PANEL_GAP);

  gridData = new float[GRID_SIZE][GRID_SIZE];
  executor = Executors.newSingleThreadExecutor();
  appLog   = new AppLog(12);
  stats    = new Stats();

  nn      = new NeuralNetwork(new int[]{GRID_SIZE * GRID_SIZE, 128, 64, 10}, 0.05);
  trainer = new Trainer(nn, 1000);
  ui      = new UIState();
  renderer = new Renderer();

  clearGrid();
  appLog.info("Ready — architecture 784→128→64→10");
}

// ─────────────────────────────────────────────────────────────
//  DRAW
// ─────────────────────────────────────────────────────────────
void draw() {
  background(15, 18, 24);
  trainer.poll(ui, appLog, stats);
  try { renderer.drawAll(); }
  catch (Exception e) { appLog.error("Render: " + e.getMessage()); }
}

// ─────────────────────────────────────────────────────────────
//  INPUT
// ─────────────────────────────────────────────────────────────
void mouseDragged() { if (!ui.busy) paintGrid(mouseX, mouseY); }
void mousePressed() { if (mouseButton == LEFT) handleClick(); }

void handleClick() {
  if (ui.predictBtn.hit()) { doPredict(); return; }
  if (ui.trainBtn.hit())   { doTrain();   return; }
  if (ui.clearBtn.hit())   { clearGrid(); appLog.info("Grid cleared."); return; }
  if (ui.cleanBtn.hit())   { doClean();   return; }
  if (ui.exportBtn.hit())  { doExport();  return; }
  if (ui.importBtn.hit())  { doImport();  return; }

  for (int d = 0; d < 10; d++) {
    if (ui.dBtn[d].hit()) {
      if (ui.busy) { appLog.warn("Cannot label while training."); return; }
      addSample(d);
      return;
    }
  }

  if (ui.lrMinus.hit()) { nn.lr = constrain(nn.lr - 0.005, 0.001, 1.0); return; }
  if (ui.lrPlus.hit())  { nn.lr = constrain(nn.lr + 0.005, 0.001, 1.0); return; }
  if (ui.epMinus.hit()) { trainer.epochs = constrain(trainer.epochs - 10, 10, 500); return; }
  if (ui.epPlus.hit())  { trainer.epochs = constrain(trainer.epochs + 10, 10, 500); return; }

  if (!ui.busy) paintGrid(mouseX, mouseY);
}

void keyPressed() {
  if      (key=='c'||key=='C') { clearGrid(); appLog.info("Grid cleared."); }
  else if (key=='p'||key=='P') doPredict();
  else if (key=='t'||key=='T') doTrain();
  else if (key=='e'||key=='E') doExport();
  else if (key=='i'||key=='I') doImport();
  else if (key=='x'||key=='X') doClean();
  else if (key>='0'&&key<='9') {
    if (ui.busy) { appLog.warn("Cannot label while training."); return; }
    addSample(key - '0');
  }
}

// ─────────────────────────────────────────────────────────────
//  SAMPLE ADDITION WITH DEDUPLICATION
// ─────────────────────────────────────────────────────────────
void addSample(int label) {
  float[] vec = gridToVec();
  String  key = hashVec(vec, label);
  if (trainer.isDuplicate(key)) {
    appLog.warn("Duplicate sample ignored (label " + label + ").");
    return;
  }
  trainer.add(vec, label, key);
  stats.recordSample(label);
  ui.activeLabel = label;
  appLog.info("Label " + label + " added — total " + trainer.count());
}

// Simple but effective hash: round each float to 1 dp, concatenate with label
String hashVec(float[] v, int label) {
  StringBuilder sb = new StringBuilder();
  sb.append(label).append(':');
  for (float f : v) {
    // Only encode non-zero cells to keep the string compact
    if (f > 0.05) { sb.append((int)(f * 10)); }
    sb.append(',');
  }
  return sb.toString();
}

// ─────────────────────────────────────────────────────────────
//  ACTIONS
// ─────────────────────────────────────────────────────────────
void doPredict() {
  if (ui.busy) { appLog.warn("Cannot predict while training."); return; }
  float[] out = nn.forward(gridToVec());
  ui.predResult = argmax(out);
  ui.predOut    = out.clone();
  ui.showPred   = true;
  stats.recordPrediction(ui.predResult, out[ui.predResult]);
  appLog.info("Predicted: " + ui.predResult +
              "  conf=" + nf(out[ui.predResult]*100, 1, 1) + "%");
}

void doTrain() {
  if (ui.busy)              { appLog.warn("Already training."); return; }
  if (trainer.count() == 0) { appLog.warn("No training data."); return; }
  appLog.info("Training: " + trainer.count() + " samples, " + trainer.epochs + " epochs.");
  ui.busy = true; ui.showPred = false;
  trainer.trainAsync(executor, ui, appLog, stats);
}

void doClean() {
  if (ui.busy) { appLog.warn("Cannot clean while training."); return; }
  int removed = trainer.removeDuplicates();
  appLog.info("Clean: removed " + removed + " duplicates — " + trainer.count() + " remain.");
  stats.rebuildFromTrainer(trainer);
}

void doExport() {
  if (ui.busy) { appLog.warn("Cannot export while training."); return; }
  try {
    String ts = nf(year(),4) + nf(month(),2) + nf(day(),2) +
                "_" + nf(hour(),2) + nf(minute(),2) + nf(second(),2);
    String fname = "data/nn_weights_" + ts + ".json";

    JSONObject root = new JSONObject();
    JSONArray la = new JSONArray();
    for (int i = 0; i < nn.L.length; i++) la.setInt(i, nn.L[i]);
    root.setJSONArray("layers", la);

    JSONArray wArr = new JSONArray();
    for (int l = 0; l < nn.W.length; l++) {
      JSONArray wj = new JSONArray();
      for (int j = 0; j < nn.W[l].length; j++) {
        JSONArray wi = new JSONArray();
        for (int i = 0; i < nn.W[l][j].length; i++) wi.setFloat(i, nn.W[l][j][i]);
        wj.setJSONArray(j, wi);
      }
      wArr.setJSONArray(l, wj);
    }
    root.setJSONArray("weights", wArr);

    JSONArray bArr = new JSONArray();
    for (int l = 0; l < nn.B.length; l++) {
      JSONArray bj = new JSONArray();
      for (int j = 0; j < nn.B[l].length; j++) bj.setFloat(j, nn.B[l][j]);
      bArr.setJSONArray(l, bj);
    }
    root.setJSONArray("biases", bArr);

    saveJSONObject(root, fname);
    appLog.info("Exported → " + fname);
  } catch (Exception e) { appLog.error("Export: " + e.getMessage()); }
}

void doImport() {
  if (ui.busy) { appLog.warn("Cannot import while training."); return; }
  selectInput("Select weights JSON:", "onImportFile");
}

void onImportFile(File f) {
  if (f == null) { appLog.info("Import cancelled."); return; }
  try {
    JSONObject root = loadJSONObject(f.getAbsolutePath());
    if (!root.hasKey("layers")||!root.hasKey("weights")||!root.hasKey("biases")) {
      appLog.error("Import: missing keys."); return;
    }
    JSONArray la = root.getJSONArray("layers");
    int[] dims = new int[la.size()];
    for (int i = 0; i < la.size(); i++) dims[i] = la.getInt(i);
    if (dims.length < 2) { appLog.error("Import: need ≥2 layers."); return; }
    NeuralNetwork loaded = new NeuralNetwork(dims, nn.lr);
    JSONArray wArr = root.getJSONArray("weights");
    for (int l = 0; l < wArr.size(); l++) {
      JSONArray wj = wArr.getJSONArray(l);
      for (int j = 0; j < wj.size(); j++) {
        JSONArray wi = wj.getJSONArray(j);
        for (int i = 0; i < wi.size(); i++) loaded.W[l][j][i] = wi.getFloat(i);
      }
    }
    JSONArray bArr = root.getJSONArray("biases");
    for (int l = 0; l < bArr.size(); l++) {
      JSONArray bj = bArr.getJSONArray(l);
      for (int j = 0; j < bj.size(); j++) loaded.B[l][j] = bj.getFloat(j);
    }
    nn = loaded; trainer.nn = nn; ui.trained = true;
    appLog.info("Imported: " + f.getName());
  } catch (Exception e) { appLog.error("Import: " + e.getMessage()); }
}

// ─────────────────────────────────────────────────────────────
//  GRID UTILITIES
// ─────────────────────────────────────────────────────────────
void paintGrid(int mx, int my) {
  int c = (mx - GRID_X) / CELL_SIZE, r = (my - GRID_Y) / CELL_SIZE;
  if (c<0||c>=GRID_SIZE||r<0||r>=GRID_SIZE) return;
  gridData[r][c] = 1.0;
  for (int dr=-1;dr<=1;dr++) for (int dc=-1;dc<=1;dc++) {
    if (dr==0&&dc==0) continue;
    int nr=constrain(r+dr,0,GRID_SIZE-1), nc=constrain(c+dc,0,GRID_SIZE-1);
    gridData[nr][nc] = max(gridData[nr][nc], 0.38);
  }
}

void clearGrid() {
  for (int r=0;r<GRID_SIZE;r++) for (int c=0;c<GRID_SIZE;c++) gridData[r][c]=0;
  ui.showPred = false;
}

float[] gridToVec() {
  float[] v = new float[GRID_SIZE*GRID_SIZE]; int k=0;
  for (int r=0;r<GRID_SIZE;r++) for (int c=0;c<GRID_SIZE;c++) v[k++]=gridData[r][c];
  return v;
}

int argmax(float[] a) { int b=0; for(int i=1;i<a.length;i++) if(a[i]>a[b]) b=i; return b; }

// ─────────────────────────────────────────────────────────────
//  STATISTICS
// ─────────────────────────────────────────────────────────────
class Stats {
  int[]  samplesPerLabel = new int[10];
  int    totalPredictions = 0;
  float  lastConfidence   = 0;
  int    lastPrediction   = -1;
  float  lastLoss         = 0;
  int    trainRuns        = 0;
  int    totalDuplicatesRejected = 0;

  void recordSample(int label) { samplesPerLabel[label]++; }
  void recordPrediction(int pred, float conf) {
    totalPredictions++; lastPrediction = pred; lastConfidence = conf;
  }
  void recordTrainComplete(float loss) { trainRuns++; lastLoss = loss; }
  void recordDuplicateRejected()       { totalDuplicatesRejected++; }

  void rebuildFromTrainer(Trainer t) {
    for (int i=0;i<10;i++) samplesPerLabel[i] = 0;
    for (float[] tgt : t.targets) {
      for (int d=0;d<10;d++) if(tgt[d]>0.5){ samplesPerLabel[d]++; break; }
    }
  }

  void drawInBox(int bx, int by, int bw, int bh) {
    // Box
    fill(11,15,21); stroke(52,63,78); strokeWeight(1); rect(bx,by,bw,bh,4);
    // Pill label
    noStroke(); fill(48,68,92); rect(bx+1,by+1,70,15,3);
    fill(135); textSize(10); textAlign(LEFT,CENTER); text("STATISTICS",bx+6,by+8);

    int px=bx+8, py=by+24, lh=15;
    textSize(11);

    // Helper closures can't exist in Processing; use inline draws
    drawStatRow(px,py,bx+bw-8,"Total samples",""+trainer.count()); py+=lh;
    drawStatRow(px,py,bx+bw-8,"Training runs",""+trainRuns); py+=lh;
    if (ui.trained) {
      drawStatRow(px,py,bx+bw-8,"Last loss", nf(lastLoss,1,5)); py+=lh;
    }
    drawStatRow(px,py,bx+bw-8,"Predictions",""+totalPredictions); py+=lh;
    drawStatRow(px,py,bx+bw-8,"Duplicates rejected",""+totalDuplicatesRejected); py+=lh;

    if (totalPredictions>0) {
      fill(85); textAlign(LEFT,BASELINE); text("Last confidence",px,py);
      color cc = lastConfidence>0.7?color(60,205,90):lastConfidence>0.4?color(225,170,40):color(210,65,65);
      fill(cc); textAlign(RIGHT,BASELINE); text(nf(lastConfidence*100,1,1)+"%",bx+bw-8,py);
      py+=lh;
    }

    py += 4;
    // Per-digit bar chart
    fill(82); textAlign(LEFT,BASELINE); text("Samples per digit:",px,py); py+=lh;
    int chartW = bw - 16;
    int maxC = 1;
    for (int c : samplesPerLabel) if(c>maxC) maxC=c;
    for (int d=0;d<10;d++) {
      int barW = samplesPerLabel[d]>0 ? max(2,(int)map(samplesPerLabel[d],0,maxC,0,chartW-24)) : 0;
      int ry = py - 10;
      fill(28,38,55); noStroke(); rect(px+16, ry, chartW-24, 11, 2);
      fill(55,105,170); if(barW>0) rect(px+16, ry, barW, 11, 2);
      fill(120); textSize(10); textAlign(LEFT,BASELINE); text(""+d,px,py);
      fill(90);  textAlign(RIGHT,BASELINE); text(""+samplesPerLabel[d],bx+bw-8,py);
      py+=13;
    }
    textAlign(LEFT,BASELINE);
  }

  void drawStatRow(int lx, int y, int rx, String label, String val) {
    fill(85); textAlign(LEFT,BASELINE); text(label,lx,y);
    fill(195); textAlign(RIGHT,BASELINE); text(val,rx,y);
  }
}

// ─────────────────────────────────────────────────────────────
//  SEQUENTIAL LAYOUT HELPER
// ─────────────────────────────────────────────────────────────
class Layout {
  int x, w, cursor, gap;
  Layout(int x, int startY, int w, int gap) {
    this.x=x; cursor=startY; this.w=w; this.gap=gap;
  }
  int next(int h) { int y=cursor; cursor+=h+gap; return y; }
  void skip(int px) { cursor+=px; }
  int peek() { return cursor; }
}

// ─────────────────────────────────────────────────────────────
//  LOGGER
// ─────────────────────────────────────────────────────────────
class AppLog {
  int CAP; String[] msgs; int[] lvl; int head=0, cnt=0;
  AppLog(int cap) { CAP=cap; msgs=new String[cap]; lvl=new int[cap]; }

  synchronized void write(int l, String m) {
    println((l==2?"[ERR] ":l==1?"[WRN] ":"[INF] ")+m);
    msgs[head]=m; lvl[head]=l; head=(head+1)%CAP; if(cnt<CAP)cnt++;
  }
  void info (String m) { write(0,m); }
  void warn (String m) { write(1,m); }
  void error(String m) { write(2,m); }

  void drawInBox(int bx, int by, int bw, int bh) {
    int lineH=15, pad=7;
    int maxLines = max(1,(bh-pad*2-18)/lineH);

    fill(11,15,21); stroke(52,63,78); strokeWeight(1); rect(bx,by,bw,bh,4);
    noStroke(); fill(48,68,92); rect(bx+1,by+1,30,15,3);
    fill(135); textSize(10); textAlign(LEFT,CENTER); text("LOG",bx+6,by+8);

    int tot=min(cnt,CAP); textSize(11); textAlign(LEFT,BASELINE); int drawn=0;
    for (int k=tot-1; k>=0&&drawn<maxLines; k--) {
      int idx=((head-tot+k)+CAP*2)%CAP;
      fill(lvl[idx]==2?color(228,70,70):lvl[idx]==1?color(225,165,45):color(88,118,145));
      text((lvl[idx]==2?"ERR  ":lvl[idx]==1?"WRN  ":"INFO ")+msgs[idx], bx+pad, by+22+drawn*lineH);
      drawn++;
    }
    textAlign(LEFT,BASELINE);
  }
}

// ─────────────────────────────────────────────────────────────
//  UI STATE
// ─────────────────────────────────────────────────────────────
class UIState {
  Btn predictBtn, trainBtn, clearBtn, cleanBtn, exportBtn, importBtn;
  Btn[] dBtn = new Btn[10];
  Btn lrMinus, lrPlus, epMinus, epPlus;

  boolean busy=false, trained=false, showPred=false;
  int     activeLabel=-1, predResult=-1;
  float[] predOut = new float[10];
  float   lastLoss=0;
  volatile String progress="";

  UIState() { buildLayout(); }

  void buildLayout() {
    int gap=7;
    Layout L = new Layout(LP_X, GRID_Y + GRID_PX + 12, LP_W, gap);

    // Action buttons: 3 per row, two rows
    int bh=32, bgap=6;
    int bw3 = (LP_W - 2*bgap) / 3;
    int bw2 = (LP_W - bgap) / 2;

    int rowA = L.next(bh);
    predictBtn = new Btn(LP_X,                rowA, bw3, bh, "Predict [P]");
    trainBtn   = new Btn(LP_X + bw3+bgap,     rowA, bw3, bh, "Train [T]");
    clearBtn   = new Btn(LP_X + 2*(bw3+bgap), rowA, bw3, bh, "Clear [C]");

    int rowB = L.next(bh);
    exportBtn = new Btn(LP_X,          rowB, bw3, bh, "Export [E]");
    importBtn = new Btn(LP_X+bw3+bgap, rowB, bw3, bh, "Import [I]");
    cleanBtn  = new Btn(LP_X+2*(bw3+bgap), rowB, bw3, bh, "Clean [X]");

    // Digit buttons
    int dw = (LP_W - 4*bgap) / 5, dh=30;
    int dr1 = L.next(dh), dr2 = L.next(dh);
    for (int d=0;d<5;d++)  dBtn[d]   = new Btn(LP_X+d*(dw+bgap),     dr1, dw, dh, ""+d);
    for (int d=5;d<10;d++) dBtn[d]   = new Btn(LP_X+(d-5)*(dw+bgap), dr2, dw, dh, ""+d);

    // Spinner rows: [Label ......  −  val  +]
    int sh=28, sbw=26, sval=42;
    int trio = sbw + 4 + sval + 4 + sbw;
    int right = LP_X + LP_W;

    int lrY = L.next(sh);
    int epY = L.next(sh);
    lrMinus = new Btn(right-trio,  lrY, sbw, sh, "−");
    lrPlus  = new Btn(right-sbw,   lrY, sbw, sh, "+");
    epMinus = new Btn(right-trio,  epY, sbw, sh, "−");
    epPlus  = new Btn(right-sbw,   epY, sbw, sh, "+");
  }

  void draw() {
    // Buttons
    predictBtn.draw(false); trainBtn.draw(busy); clearBtn.draw(false);
    exportBtn.draw(false);  importBtn.draw(false); cleanBtn.draw(false);

    // Digit buttons
    for (int d=0;d<10;d++) {
      dBtn[d].draw(false);
      if (d==activeLabel) {
        noFill(); stroke(255,205,50); strokeWeight(2);
        rect(dBtn[d].x,dBtn[d].y,dBtn[d].w,dBtn[d].h,4); noStroke();
      }
    }

    // Spinners
    lrMinus.draw(false); lrPlus.draw(false);
    epMinus.draw(false); epPlus.draw(false);

    int sbw=26, sval=42, sh=28;
    int trio=sbw+4+sval+4+sbw, right=LP_X+LP_W;
    int valCx = right - sbw - 4 - sval/2;

    textSize(11); textAlign(LEFT,CENTER);
    fill(130); text("Learning Rate", LP_X, (int)lrMinus.y+sh/2);
    fill(255,215,50); textAlign(CENTER,CENTER);
    text(nf(nn.lr,1,3), valCx, (int)lrMinus.y+sh/2);

    fill(130); textAlign(LEFT,CENTER);
    text("Epochs", LP_X, (int)epMinus.y+sh/2);
    fill(255,215,50); textAlign(CENTER,CENTER);
    text(""+trainer.epochs, valCx, (int)epMinus.y+sh/2);

    // Training progress bar (shows during training)
    if (busy) {
      int py = (int)epMinus.y + sh + 8;
      fill(255,145,30); textSize(11); textAlign(LEFT,BASELINE);
      text(progress, LP_X, py);
    }

    // Bottom strip panels
    drawPredPanel(PRED_X, BOT_Y, PRED_W, BOT_H);
    stats.drawInBox(STATS_X, BOT_Y, STATS_W, BOT_H);
    appLog.drawInBox(LOG_X, BOT_Y, LOG_W, BOT_H);

    textAlign(LEFT,BASELINE);
  }

  void drawPredPanel(int bx, int by, int bw, int bh) {
    fill(11,15,21); stroke(52,63,78); strokeWeight(1); rect(bx,by,bw,bh,4);
    noStroke(); fill(48,68,92); rect(bx+1,by+1,76,15,3);
    fill(135); textSize(10); textAlign(LEFT,CENTER); text("PREDICTION",bx+6,by+8);

    if (!showPred || busy) {
      fill(65); textSize(12); textAlign(CENTER,CENTER);
      text("Draw a digit and press Predict [P]", bx+bw/2, by+bh/2);
      textAlign(LEFT,BASELINE);
      return;
    }

    // Large digit display
    fill(60,215,100); textSize(52); textAlign(LEFT,BASELINE);
    text(""+predResult, bx+16, by+72);

    // Confidence label
    float conf = predOut[predResult];
    color confCol = conf>0.7?color(60,205,90):conf>0.4?color(225,170,40):color(210,65,65);
    fill(confCol); textSize(13); textAlign(LEFT,BASELINE);
    text(nf(conf*100,1,1)+"% confident", bx+16, by+90);

    // Bar chart for all 10 digits
    int barPad = 8;
    int chartW  = bw - 2*barPad;
    int barGap  = 2;
    int barW    = (chartW - 9*barGap) / 10;
    int chartY  = by + 104;
    int maxBarH = bh - chartY + by - 32;

    for (int i=0;i<10;i++) {
      float c = predOut[i];
      int bxi = bx + barPad + i*(barW+barGap);
      int bhi = max(2,(int)(c * maxBarH));
      int byi = chartY + (maxBarH - bhi);
      fill(i==predResult?color(55,185,85):color(35,52,75)); noStroke();
      rect(bxi, byi, barW, bhi, 2);
      // digit label below
      fill(i==predResult?color(55,185,85):color(100));
      textSize(10); textAlign(CENTER,TOP);
      text(""+i, bxi+barW/2, chartY+maxBarH+3);
      // percent above bar
      if (c>0.02) {
        fill(i==predResult?color(60,215,100):color(95));
        textSize(9); textAlign(CENTER,BASELINE);
        text(nf(c*100,1,0)+"%", bxi+barW/2, byi-1);
      }
    }
    textAlign(LEFT,BASELINE);
  }
}

// ─────────────────────────────────────────────────────────────
//  TRAINER  (with deduplication)
// ─────────────────────────────────────────────────────────────
class Trainer {
  NeuralNetwork       nn;
  ArrayList<float[]>  inputs   = new ArrayList<float[]>();
  ArrayList<float[]>  targets  = new ArrayList<float[]>();
  HashSet<String>     keySet   = new HashSet<String>();
  int maxSamples, epochs=50;
  volatile boolean done=false;
  volatile float   doneLoss=0;

  Trainer(NeuralNetwork nn, int max) { this.nn=nn; maxSamples=max; }
  int count() { return inputs.size(); }

  boolean isDuplicate(String key) { return keySet.contains(key); }

  synchronized void add(float[] inp, int label, String key) {
    float[] t=new float[10]; t[label]=1.0;
    if (inputs.size()>=maxSamples) {
      // Remove oldest — also remove its key (we don't store keys per-entry,
      // so oldest removal just evicts from list; keySet retains the key,
      // which is conservative: duplicate of an evicted sample is still blocked.
      // This is intentional to prevent re-adding the same drawing.)
      inputs.remove(0); targets.remove(0);
    }
    inputs.add(inp.clone()); targets.add(t); keySet.add(key);
  }

  // Post-hoc duplicate removal: rebuilds lists keeping only first occurrence
  // of each (vec, label) pair.
  synchronized int removeDuplicates() {
    HashSet<String> seen = new HashSet<String>();
    ArrayList<float[]> newIn  = new ArrayList<float[]>();
    ArrayList<float[]> newTgt = new ArrayList<float[]>();
    int removed = 0;
    for (int i=0;i<inputs.size();i++) {
      float[] v=inputs.get(i); float[] t=targets.get(i);
      int lbl=0; for(int d=0;d<10;d++) if(t[d]>0.5){lbl=d;break;}
      String k=hashVec(v,lbl);
      if (!seen.contains(k)) { seen.add(k); newIn.add(v); newTgt.add(t); }
      else removed++;
    }
    inputs=newIn; targets=newTgt; keySet=seen;
    return removed;
  }

  synchronized float[][] snapI() { return inputs.toArray(new float[0][]); }
  synchronized float[][] snapT() { return targets.toArray(new float[0][]); }

  void trainAsync(ExecutorService ex, final UIState ui, final AppLog log, final Stats st) {
    final float[][] inp=snapI(), tgt=snapT();
    final int ep=epochs; final NeuralNetwork net=nn;
    ex.submit(new Runnable() { public void run() {
      int n=inp.length; int[] idx=new int[n]; for(int i=0;i<n;i++) idx[i]=i;
      float loss=0;
      for(int e=0;e<ep;e++){
        for(int i=n-1;i>0;i--){int j=(int)(Math.random()*(i+1));int tmp=idx[i];idx[i]=idx[j];idx[j]=tmp;}
        loss=0;
        for(int k:idx){
          float[] out=net.train(inp[k],tgt[k]);
          for(int i=0;i<out.length;i++) if(tgt[k][i]>0) loss-=(float)Math.log(Math.max(out[i],1e-7f));
        }
        ui.progress="Epoch "+(e+1)+"/"+ep+"  loss="+nf(loss/n,1,5);
      }
      doneLoss=loss/n; done=true;
    }});
  }

  void poll(UIState ui, AppLog log, Stats st) {
    if(done){ done=false; ui.busy=false; ui.trained=true; ui.lastLoss=doneLoss;
      st.recordTrainComplete(doneLoss);
      log.info("Training done. Loss: "+nf(doneLoss,1,5));
    }
  }
}

// ─────────────────────────────────────────────────────────────
//  RENDERER
// ─────────────────────────────────────────────────────────────
class Renderer {
  PVector[][] pos; int cachedHash=0;

  void drawAll() {
    drawHint(); drawGridLabel(); drawGrid(); drawNetwork(); ui.draw();
  }

  void drawHint() {
    fill(55); textSize(10); textAlign(RIGHT,TOP);
    text("0–9: label   P: predict   T: train   C: clear   X: clean dupes   E: export   I: import",
         W-10, 6);
  }

  void drawGridLabel() {
    fill(180); textSize(13); textAlign(LEFT,BASELINE); text("Input Grid",GRID_X,GRID_Y-11);
  }

  void drawGrid() {
    noFill(); stroke(48); strokeWeight(1);
    rect(GRID_X-1, GRID_Y-1, GRID_PX+2, GRID_PX+2);
    for (int r=0;r<GRID_SIZE;r++) for (int c=0;c<GRID_SIZE;c++) {
      float v=gridData[r][c];
      fill(v*255);
      stroke(42); strokeWeight(0.5);           // thin grey grid lines always visible
      rect(GRID_X+c*CELL_SIZE, GRID_Y+r*CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }
  }

  PVector[][] neuronPositions() {
    int nL=nn.L.length; int h=0; for(int l=0;l<nL;l++) h=h*31+nn.L[l];
    if(pos==null||h!=cachedHash){
      cachedHash=h; pos=new PVector[nL][];
      float netH=NET_Y1-NET_Y0;
      for(int l=0;l<nL;l++){
        float cx=map(l,0,nL-1,NET_X0,NET_X1);
        int dispN=(l==nL-1)?nn.L[l]:min(nn.L[l],28);
        pos[l]=new PVector[dispN];
        float yStep=netH/(dispN+1);
        for(int i=0;i<dispN;i++) pos[l][i]=new PVector(cx, NET_Y0+(i+1)*yStep);
      }
    }
    return pos;
  }

  void drawNetwork() {
    PVector[][] p=neuronPositions(); int nL=nn.L.length;

    // Edges
    strokeWeight(0.6);
    for(int l=0;l<nL-1;l++){
      int sn=p[l].length, dn=p[l+1].length;
      for(int i=0;i<sn;i++) for(int j=0;j<dn;j++){
        int wi=sn>1?(int)map(i,0,sn-1,0,nn.L[l]-1):0;
        int wj=dn>1?(int)map(j,0,dn-1,0,nn.L[l+1]-1):0;
        float w=nn.W[l][wj][wi];
        float alpha=constrain(map(abs(w),0,2,40,200),40,200);
        stroke(w>0?color(205,65,65,alpha):color(65,105,235,alpha));
        line(p[l][i].x,p[l][i].y,p[l+1][j].x,p[l+1][j].y);
      }
    }

    // Neurons
    for(int l=0;l<nL;l++) for(int i=0;i<p[l].length;i++){
      int ai=p[l].length>1?(int)map(i,0,p[l].length-1,0,nn.L[l]-1):0;
      float act=nn.A[l][ai];
      fill(map(act,0,1,22,255)); stroke(82); strokeWeight(0.5);
      ellipse(p[l][i].x,p[l][i].y,9,9);
    }

    // Output labels
    int outL=nL-1;
    float lx=p[outL][0].x+12; textSize(12); textAlign(LEFT,CENTER);
    for(int i=0;i<nn.L[outL];i++){
      float act=nn.A[outL][i];
      fill((ui.showPred&&i==ui.predResult)?color(65,220,100):color(155));
      text(i+"  "+nf(act*100,1,1)+"%", lx, p[outL][i].y);
    }

    // Layer labels: 32px above first neuron of each column
    String[] names={"Input","Hidden 1","Hidden 2","Output"};
    textAlign(CENTER,BASELINE);
    for(int l=0;l<nL;l++){
      float cx=p[l][0].x, ly=p[l][0].y-32;
      String nm=l<names.length?names[l]:"Layer "+l;
      fill(145); textSize(12); text(nm,cx,ly);
      fill(68);  textSize(10); text(nn.L[l]+"n",cx,ly+13);
    }
    textAlign(LEFT,BASELINE);
  }
}

// ─────────────────────────────────────────────────────────────
//  NEURAL NETWORK
// ─────────────────────────────────────────────────────────────
class NeuralNetwork {
  int[] L; float[][] A,B,E; float[][][] W,Wm; float[][] Bm; float lr;
  final float MOM=0.9;

  NeuralNetwork(int[] layers, float lr) {
    L=layers.clone(); this.lr=lr; int n=L.length;
    A=new float[n][]; E=new float[n][];
    B=new float[n-1][]; Bm=new float[n-1][];
    W=new float[n-1][][]; Wm=new float[n-1][][];
    for(int i=0;i<n;i++){A[i]=new float[L[i]];E[i]=new float[L[i]];}
    for(int l=0;l<n-1;l++){
      int in=L[l],out=L[l+1];
      B[l]=new float[out]; Bm[l]=new float[out];
      W[l]=new float[out][in]; Wm[l]=new float[out][in];
      float lim=(float)Math.sqrt(6.0/(in+out));
      for(int j=0;j<out;j++) for(int i=0;i<in;i++) W[l][j][i]=random(-lim,lim);
    }
  }

  synchronized float[] forward(float[] inp) {
    for(int i=0;i<L[0];i++) A[0][i]=inp[i];
    int n=L.length;
    for(int l=1;l<n;l++){
      for(int j=0;j<L[l];j++){
        float s=B[l-1][j]; for(int i=0;i<L[l-1];i++) s+=W[l-1][j][i]*A[l-1][i];
        A[l][j]=sig(s);
      }
      if(l==n-1) softmax(A[l]);
    }
    return A[n-1];
  }

  synchronized float[] train(float[] inp, float[] tgt) {
    float[] out=forward(inp); int n=L.length-1;
    for(int i=0;i<L[n];i++) E[n][i]=tgt[i]-out[i];
    for(int l=n-1;l>=1;l--) for(int i=0;i<L[l];i++){
      float s=0; for(int j=0;j<L[l+1];j++) s+=W[l][j][i]*E[l+1][j];
      E[l][i]=s*A[l][i]*(1-A[l][i]);
    }
    for(int l=0;l<L.length-1;l++) for(int j=0;j<L[l+1];j++){
      float gb=lr*E[l+1][j]; Bm[l][j]=MOM*Bm[l][j]+gb; B[l][j]+=Bm[l][j];
      for(int i=0;i<L[l];i++){
        float gw=lr*E[l+1][j]*A[l][i];
        Wm[l][j][i]=MOM*Wm[l][j][i]+gw; W[l][j][i]+=Wm[l][j][i];
      }
    }
    return out;
  }

  float sig(float x){return 1.0/(1.0+exp(-x));}
  void softmax(float[] v){
    float m=v[0]; for(float x:v) if(x>m)m=x;
    float s=0; for(int i=0;i<v.length;i++){v[i]=exp(v[i]-m);s+=v[i];}
    for(int i=0;i<v.length;i++) v[i]/=s;
  }
}

// ─────────────────────────────────────────────────────────────
//  BUTTON
// ─────────────────────────────────────────────────────────────
class Btn {
  float x,y,w,h; String label;
  Btn(float x,float y,float w,float h,String label){this.x=x;this.y=y;this.w=w;this.h=h;this.label=label;}
  boolean hit(){return mouseX>x&&mouseX<x+w&&mouseY>y&&mouseY<y+h;}
  void draw(boolean dim){
    noStroke();
    fill(dim?color(50,68,42):hit()?color(72,92,122):color(34,44,60));
    rect(x,y,w,h,5);
    fill(dim?color(108,152,78):color(198));
    textSize(11); textAlign(CENTER,CENTER);
    text(label,x+w*0.5f,y+h*0.5f);
  }
}
